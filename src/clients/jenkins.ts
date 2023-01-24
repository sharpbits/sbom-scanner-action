import * as core from '@actions/core'
import fetch from 'node-fetch'

export interface JenkinsResult {
  last_successful_build_date?: string

  test_results_available?: boolean
  test_total_count?: number
  test_skip_count?: number
  test_fail_count?: number

  sonar_available?: boolean
  sonar_skipped?: boolean

  coverage_percent?: number
  coverage_lines_analyzed?: number
}

interface JenkinsBuildResult {
  actions: JenkinsBuildResultActions[]
}

interface JenkinsBuildResultActions {
  _class: string

  // Tests
  totalCount?: number
  skipCount?: number
  failCount?: number

  // Sonar
  new?: boolean
  skipped?: boolean
  serverUrl?: string
}

interface JenkinsCoverageResult {
  results: {
    elements: {
      name: string
      numerator: number
      denominator: number
      ratio: number
    }[]
  }
}

// jenkinsUrl will point to the lastest build job of the master branch
//    Target URL: "https://<host>/job/<org>/job/<repo>/job/<branch>/<build>/display/redirect"
export async function getJenkinsData(jenkinsUrl: string, jenkinsUser: string, jenkinsToken: string): Promise<JenkinsResult> {
  const result = {
    testResultsAvailable: false,
    sonarAvailable: false
  } as JenkinsResult

  // Break apart the URL (regex is overkill here)
  jenkinsUrl = jenkinsUrl.replace('/display/redirect', '')
  const urlArr = jenkinsUrl.split('/')

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_a, _b, host, _c, org, _d, repo, _e, branch, buildNum] = urlArr

  // const lastBuildUrl = `${jenkinsUrl}/api/json`
  const lastSuccessfulBuildUrl = `https://${host}/job/${org}/job/${repo}/job/${branch}/lastSuccessfulBuild/`
  const buildInfoUrl = `${lastSuccessfulBuildUrl}api/json`
  const coverageUrl = `${lastSuccessfulBuildUrl}cobertura/api/json?depth=2`
  const creds = Buffer.from(`${jenkinsUser}:${jenkinsToken}`).toString('base64')

  await fetchBuildData(buildInfoUrl, creds, result)
  await fetchCoverageData(coverageUrl, creds, result)

  return result
}

async function fetchBuildData(url: string, creds: string, result: JenkinsResult): Promise<void> {
  try {
    core.info(`Attempting to fetch ${url}`)
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${creds}`,
        Accept: 'application/json'
      }
    })

    if (res.status !== 200) {
      core.error(`Failed to retrieve Jenkins build result data from ${url} - ${res.status} ${res.statusText}`)
    }

    extractBuildData((await res.json()) as JenkinsBuildResult, result)
  } catch (err) {
    core.error(`Failed to retrieve Jenkins build result data from ${url} - ${err}`)
  }
}

function extractBuildData(data: JenkinsBuildResult, result: JenkinsResult): void {
  const testResults = data?.actions?.find(act => act._class === 'hudson.tasks.junit.TestResultAction')
  if (testResults) {
    result.test_results_available = (testResults.totalCount || 0) > 0
    result.test_total_count = testResults.totalCount
    result.test_skip_count = testResults.skipCount
    result.test_fail_count = testResults.failCount
  }

  const sonarResults = data?.actions?.find(act => act._class === 'hudson.plugins.sonar.action.SonarAnalysisAction')
  if (sonarResults) {
    result.sonar_available = true
    result.sonar_skipped = sonarResults.skipped
  }
}

async function fetchCoverageData(url: string, creds: string, result: JenkinsResult): Promise<void> {
  try {
    core.info(`Attempting to fetch ${url}`)
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${creds}`,
        Accept: 'application/json'
      }
    })

    if (res.status !== 200) {
      core.error(`Failed to retrieve Jenkins coverage data from ${url} - ${res.status} ${res.statusText}`)
    }

    extractCoverageData((await res.json()) as JenkinsCoverageResult, result)
  } catch (err) {
    core.error(`Failed to retrieve Jenkins coverage data from ${url} - ${err}`)
  }
}

function extractCoverageData(data: JenkinsCoverageResult, result: JenkinsResult): void {
  const lineCoverage = data?.results?.elements?.find(e => e.name === 'Lines')
  if (lineCoverage) {
    result.coverage_percent = lineCoverage.ratio
    result.coverage_lines_analyzed = lineCoverage.denominator
  }
}
