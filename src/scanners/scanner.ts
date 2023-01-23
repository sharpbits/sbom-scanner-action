import {GithubRepo} from '../clients/github'
import {ISettings} from '../settings'
import {ManifestScannerResult} from './manifest-scanner'

export interface IScanResult {
  scan_date: string
  scan_start_utc_time: number
  scan_elapsed_ms: number
  orgs: string[]
  repo_whitelist: string[]
  scanners: string[]

  repos: {
    [repo: string]: {
      [scannerName: string]: IScannerResult
    }
  }
}

export interface IScanner {
  readonly scannerName: string

  initialize(settings?: ISettings): void
  scan(repo: GithubRepo, manifest?: ManifestScannerResult): Promise<IScannerResult>
}

export interface IScannerResult {
  scanner_name: string
  messages: ScannerMessage[]
}

export interface ScannerMessage {
  level: 'debug' | 'info' | 'warning' | 'error'
  message: string
}
