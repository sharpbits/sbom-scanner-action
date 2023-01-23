import * as core from '@actions/core'
import { subMonths, compareAsc, parseISO } from 'date-fns'
import { GithubRepo } from '../clients/github'
import { searchApplications } from '../clients/veracode'
import { ISettings } from '../settings'
import { ManifestScannerResult } from './manifest-scanner'
import { IScanner, IScannerResult } from './scanner'

const veracodeBaseUrl = 'https://analysiscenter.veracode.com/auth/index.jsp#'
const lastValidScanCutoff = subMonths(new Date(), 1)

export interface VeracodeStaticScannerResult extends IScannerResult {
  components: VeracodeComponentResult[]
}

type VeracodeStatusValues = 'Compliant' | 'Missing' | 'Outdated' | 'Noncompliant'

export interface VeracodeComponentResult {
  component_name: string
  veracode_app_name: string
  veracode_app_name_actual: string // Exact name of the app used, important if CI used to look this up
  veracode_status: VeracodeStatusValues
  last_static_scan_date?: string
  last_static_scan_result?: string
  last_compliance_check?: string
  veracode_app_profile_url?: string
}

export class VeracodeScanner implements IScanner {
  scannerName = 'veracode'
  apiUrl = ''
  apiId = ''
  apiKey = ''

  initialize(settings: ISettings): void {
    this.apiUrl = settings.veracodeApiUrl
    this.apiId = settings.veracodeApiId
    this.apiKey = settings.veracodeApiKey
  }

  async scan(repo: GithubRepo, manifestData?: ManifestScannerResult): Promise<IScannerResult> {
    const result = {
      scanner_name: this.scannerName,
      components: [] as VeracodeComponentResult[]
    } as VeracodeStaticScannerResult

    const componentManifests = manifestData?.manifest?.components
    if (!componentManifests) {
      return result
    }

    for (const manifest of componentManifests) {
      const vcProject = {
        component_name: manifest.name,
        veracode_app_name: manifest.veracode_app,
        veracode_status: 'Missing'
      } as VeracodeComponentResult
      result.components.push(vcProject)

      if (!vcProject.veracode_app_name) {
        continue
      }

      const searchResult = await searchApplications(this.apiUrl, this.apiId, this.apiKey, { appName: vcProject.veracode_app_name })

      // Name search is wildcard so it may return inexact matches, filter for exact name match
      let appResult = searchResult?._embedded?.applications?.find(
        c => c.profile.name.toLowerCase() === vcProject.veracode_app_name.toLowerCase()
      )

      if (!appResult) {
        continue
      }

      const lastStaticScan = appResult?.scans?.filter(s => s.scan_type === 'STATIC').shift()
      if (!lastStaticScan) {
        continue
      }

      const lastScan = parseISO(lastStaticScan.modified_date)
      let veracodeStatus = 'Compliant' as VeracodeStatusValues
      if (compareAsc(lastScan, lastValidScanCutoff) < 0) {
        veracodeStatus = 'Outdated'
      }
      if (
        appResult.profile.policies &&
        !appResult.profile.policies.every(p => p.policy_compliance_status === 'PASSED' || p.policy_compliance_status === 'CONDITIONAL_PASS')
      ) {
        veracodeStatus = 'Noncompliant'
      }

      vcProject.veracode_app_name_actual = appResult.profile.name
      vcProject.veracode_status = veracodeStatus
      vcProject.last_static_scan_date = lastStaticScan.modified_date
      vcProject.last_static_scan_result = lastStaticScan.status
      vcProject.last_compliance_check = appResult.last_policy_compliance_check_date
      vcProject.veracode_app_profile_url = `${veracodeBaseUrl}${appResult.app_profile_url}`
    }

    return result
  }
}
