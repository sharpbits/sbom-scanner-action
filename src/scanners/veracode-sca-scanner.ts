import * as core from '@actions/core'
import { compareAsc, parseISO, subMonths } from 'date-fns'
import { GithubRepo } from '../clients/github'
import { getScaProjects, getScaWorkspaces, SearchResult, SearchResultProject, SearchResultWorkspace } from '../clients/veracode'
import { ISettings } from '../settings'
import { ManifestScannerResult } from './manifest-scanner'
import { IScanner, IScannerResult } from './scanner'

const lastValidScanCutoff = subMonths(new Date(), 1)

export interface VeracodeScaScannerResult extends IScannerResult {
  components: VeracodeScaComponentResult[]
}

type VeracodeScaStatusValues = 'Missing' | 'Outdated' | 'Vulnerable' | 'OK'

export interface VeracodeScaComponentResult {
  component_name: string
  status: VeracodeScaStatusValues
  last_scan_date?: string
  library_issues_count?: number
  license_issues_count?: number
  vulnerability_issue_count?: number
  profile_url?: string
}

export class VeracodeScaScanner implements IScanner {
  scannerName = 'veracode_sca'
  apiUrl = ''
  apiId = ''
  apiKey = ''
  uiUrl = ''
  workspaceName = ''
  workspaces = {} as SearchResult | null
  workspace = null as SearchResultWorkspace | null
  projects = null as SearchResultProject[] | null

  initialize(settings: ISettings): void {
    this.apiUrl = settings.veracodeApiUrl
    this.apiId = settings.veracodeApiId
    this.apiKey = settings.veracodeApiKey
    this.uiUrl = settings.veracodeUiUrl
    this.workspaceName = settings.veracodeScaWorkspace

    if (this.workspaceName) {
      void this.retrieveWorkspace()
    }
  }

  async retrieveWorkspace(): Promise<void> {
    try {
      this.workspaces = await getScaWorkspaces(this.apiUrl, this.apiId, this.apiKey)
      this.workspace = this.workspaces?._embedded?.workspaces?.find(w => w.name === this.workspaceName) || null
      if (this.workspace) {
        this.projects = await getScaProjects(this.apiUrl, this.apiId, this.apiKey, this.workspace.id)
      }
    } catch (err) {
      core.info(`Error retrieving workspace details: ${err}`)
    }
  }

  async scan(repo: GithubRepo, manifestData?: ManifestScannerResult): Promise<IScannerResult> {
    const result = {
      scanner_name: this.scannerName,
      components: [] as VeracodeScaComponentResult[]
    } as VeracodeScaScannerResult

    if (!this.workspaceName || !this.workspaces || !this.workspace) {
      return result
    }

    const componentManifests = manifestData?.manifest?.components
    if (!componentManifests) {
      return result
    }

    for (const manifest of componentManifests) {
      const projectName = manifest.veracode_sca_root ? `${repo.full_name}/${manifest.veracode_sca_root}` : repo.full_name
      const scaProject = this.projects?.find(p => p.name === projectName)

      const data = {
        component_name: manifest.name,
        status: 'Missing'
      } as VeracodeScaComponentResult
      result.components.push(data)

      if (!scaProject) {
        continue
      }

      data.status = 'OK'
      const lastScan = parseISO(scaProject.last_scan_date)
      if (compareAsc(lastScan, lastValidScanCutoff) < 0) {
        data.status = 'Outdated'
      }
      if (scaProject.vulnerability_issues_count > 0) {
        data.status = 'Vulnerable'
      }

      data.last_scan_date = scaProject.last_scan_date
      data.library_issues_count = scaProject.library_issues_count
      data.license_issues_count = scaProject.license_issues_count
      data.vulnerability_issue_count = scaProject.vulnerability_issues_count
      data.profile_url = `https://${this.uiUrl}/workspaces/${this.workspace.site_id}/projects/${scaProject.site_id}/issues`
    }

    return result
  }
}
