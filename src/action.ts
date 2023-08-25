import 'dotenv/config'
import * as core from '@actions/core'
import * as fs from 'fs'
import { getSettings } from './settings'
import { IScanner, IScanResult } from './scanners/scanner'

import ManifestScanner, { ManifestScannerResult } from './scanners/manifest-scanner'
import { listRepos } from './clients/github'
import { JenkinsScanner } from './scanners/jenkins-scanner'
import { VeracodeScanner } from './scanners/veracode-static-scanner'
import { VeracodeScaScanner } from './scanners/veracode-sca-scanner'

export async function run(): Promise<void> {
  try {
    const settings = await getSettings()
    const scanners = [] as IScanner[]

    const scanResult = {
      scan_date: new Date().toISOString(),
      scan_start_utc_time: Date.now(),
      orgs: settings.orgs,
      repo_whitelist: settings.repoWhitelist,
      repos: {}
    } as IScanResult

    settings.scanners.forEach(scanner => {
      switch (scanner) {
        case 'jenkins':
          scanners.push(new JenkinsScanner())
          break
        case 'veracode':
          scanners.push(new VeracodeScanner())
          break
        case 'veracode_sca':
          scanners.push(new VeracodeScaScanner())
          break
        default:
          break
      }
    })

    for (const scanner of scanners) {
      scanner.initialize(settings)
    }

    const startTime = Date.now()

    if (settings.orgs.length === 0) {
      core.setFailed('No orgs to scan')
      return
    }

    // Retrieve orgs and repos
    const repos = await listRepos(settings)
    core.info(`Found ${repos.length} repos to scan`)

    // Perform the manifest scan
    const manifestScanner = new ManifestScanner()
    manifestScanner.initialize(settings)

    for (const repo of repos) {
      scanResult.repos[repo.name] = { [manifestScanner.scannerName]: {} as ManifestScannerResult }
      const manifest = (await manifestScanner.scan(repo)) as ManifestScannerResult
      scanResult.repos[repo.name][manifestScanner.scannerName] = manifest
    }

    // Run all other scanners and aggregate results
    for (const repo of repos) {
      const manifest = scanResult.repos[repo.name][manifestScanner.scannerName] as ManifestScannerResult
      for (const scanner of scanners) {
        scanResult.repos[repo.name][scanner.scannerName] = await scanner.scan(repo, manifest)
      }
    }

    scanResult.scan_elapsed_ms = Date.now() - startTime

    // Persist scanner data
    core.info(`Writing results to ${settings.outputDataFile}`)
    fs.writeFileSync(settings.outputDataFile, JSON.stringify(scanResult, null, 2))
  } catch (error) {
    core.setFailed(`${(error as Error)?.message ?? error}`)
  }
}
