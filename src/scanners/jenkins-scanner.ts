import * as core from '@actions/core'
import { GithubRepo } from '../clients/github'
import { getJenkinsData, JenkinsResult } from '../clients/jenkins'
import { ISettings } from '../settings'
import { ManifestScannerResult } from './manifest-scanner'
import { IScanner, IScannerResult } from './scanner'

export interface JenkinsScannerResult extends IScannerResult, JenkinsResult {}

export class JenkinsScanner implements IScanner {
  scannerName = 'jenkins'
  jenkinsUser = ''
  jenkinsToken = ''

  initialize(settings: ISettings): void {
    this.jenkinsUser = settings.jenkinsUser
    this.jenkinsToken = settings.jenkinsToken
  }

  async scan(repo: GithubRepo, manifest?: ManifestScannerResult): Promise<IScannerResult> {
    const result = {
      scanner_name: this.scannerName
    } as JenkinsScannerResult

    const jenkinsBuildUrl = manifest?.github?.master_status?.commit_status_target_url

    // TODO: Seek a better way to identify if this status is from a Jenkins CI system
    if (!jenkinsBuildUrl || !jenkinsBuildUrl.includes('/job/')) {
      core.info(`No Jenkins url available to scan ${repo.name}`)
      return result
    }

    const data = await getJenkinsData(jenkinsBuildUrl, this.jenkinsUser, this.jenkinsToken)

    return { ...result, ...data }
  }
}
