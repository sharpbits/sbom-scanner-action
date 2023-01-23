import * as core from '@actions/core'
import fetch from 'node-fetch'
import { generateHeader } from './hmac'

export interface SearchQuery {
  resultSize?: number
  page?: number
  appName?: string
  scanType?: 'STATIC' | 'DYNAMIC' | 'MANUAL' | 'SCA'
  tag?: string
  ci?: string
}

export interface SearchResult {
  page: {
    number: number
    size: number
    total_elements: number
    total_pages: number
  }

  _embedded: {
    applications?: SearchResultItem[]
    workspaces?: SearchResultWorkspace[]
    projects?: SearchResultProject[]
  }
}

export interface SearchResultItem {
  id: number
  guid: string
  app_profile_url: string
  last_completed_scan_date: string
  last_policy_compliance_check_date: string
  modified: string
  profile: {
    business_criticality: string
    custom_fields: { name: string; value: string }[]
    description: string
    name: string
    policies: {
      guid: string
      is_default: boolean
      name: string
      policy_compliance_status: string
    }[]
  }
  settings: {
    sca_enabled: boolean
  }
  scans: ScanResult[]
}

export interface SearchResultWorkspace {
  id: string
  library_issues_count: number
  license_issues_count: number
  name: string
  projects_count: number
  sandbox: boolean
  site_id: string
  total_issues_count: number
  vulnerability_issues_count: number
}

export interface SearchResultProject {
  id: string
  languages: string[]
  last_scan_date: string
  library_issues_count: number
  license_issues_count: number
  name: string
  site_id: number
  total_issues_count: number
  vulnerability_issues_count: number
}

export interface ScanResult {
  internal_status: string
  modified_date: string
  scan_type: 'STATIC' | 'DYNAMIC' | 'MANUAL' | 'SCA'
  scan_url: string
  status: string
}

export async function searchApplications(apiHost: string, apiId: string, apiKey: string, query: SearchQuery): Promise<SearchResult | null> {
  query = {
    resultSize: 50,
    page: 0,
    ...query
  }

  let url = `/appsec/v1/applications?size=${query.resultSize}&page=${query.page}`

  if (query.appName) url += `&name=${encodeURIComponent(query.appName)}`
  if (query.scanType) url += `&scan_type=${query.scanType}`
  if (query.tag) url += `&tag=${encodeURIComponent(query.tag)}`
  if (query.ci) url += `&custom_field_names=CI&custom_field_values=${encodeURIComponent(query.ci)}`

  core.info(`Attempting to fetch veracode app details from ${url}`)

  try {
    const res = await fetch(`https://${apiHost}${url}`, {
      method: 'GET',
      headers: {
        Authorization: generateHeader(apiHost, apiId, apiKey, url, 'GET'),
        Accept: 'application/json'
      }
    })

    const data = (await res.json()) as SearchResult

    if (!data || !data?.page?.total_elements) {
      return null // No results
    }

    return data
  } catch (err) {
    core.error(`Failed to retrieve Veracode data from ${url} - ${err}`)
    return null
  }
}

export async function getScaWorkspaces(apiHost: string, apiId: string, apiKey: string): Promise<SearchResult | null> {
  const query = {
    resultSize: 100,
    page: 0
  }
  const url = `/srcclr/v3/workspaces?size=${query.resultSize}&page=${query.page}`

  try {
    const res = await fetch(`https://${apiHost}${url}`, {
      method: 'GET',
      headers: {
        Authorization: generateHeader(apiHost, apiId, apiKey, url, 'GET'),
        Accept: 'application/json'
      }
    })

    const data = (await res.json()) as SearchResult

    return data
  } catch (err) {
    core.error(`Failed to retrieve Veracode workspace data from ${url} - ${err}`)
    return null
  }
}

export async function getScaProjects(
  apiHost: string,
  apiId: string,
  apiKey: string,
  workspaceGuid: string
): Promise<SearchResultProject[] | null> {
  const query = {
    resultSize: 100,
    page: 0
  }
  const url = `/srcclr/v3/workspaces/${workspaceGuid}/projects?type=agent&size=${query.resultSize}&page=${query.page}`

  try {
    const res = await fetch(`https://${apiHost}${url}`, {
      method: 'GET',
      headers: {
        Authorization: generateHeader(apiHost, apiId, apiKey, url, 'GET'),
        Accept: 'application/json'
      }
    })

    const data = (await res.json()) as SearchResult

    return data?._embedded?.projects || null
  } catch (err) {
    core.error(`Failed to retrieve Veracode projects data from ${url} - ${err}`)
    return null
  }
}
