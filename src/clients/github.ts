import * as core from '@actions/core'
import * as github from '@actions/github'
import fetch from 'node-fetch'
import { RestEndpointMethodTypes } from '@octokit/plugin-rest-endpoint-methods'

export type GithubRepo = RestEndpointMethodTypes['repos']['get']['response']['data']
export type BranchProtection = RestEndpointMethodTypes['repos']['getBranchProtection']['response']['data']

export interface GithubCommitStatus {
  commit_sha: string
  commit_time?: string
  commit_status_state?: string
  commit_status_time?: string
  commit_status_context?: string
  commit_status_target_url?: string
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function getOctokit(githubUrl: string, token: string) {
  return github.getOctokit(token, {
    // baseUrl: `${githubUrl}/api/v3`
  })
}

// This code is being held for future enhancements
// export async function getOrgDetail(orgNames: string[], token: string): Promise<GithubOrg[]> {
//   const octo = getOctokit(token)
//   const orgs = [] as GithubOrg[]
//   for (const orgName of orgNames) {
//     const orgInfo = await octo.rest.orgs.get({
//       org: orgName
//     })
//     core.info(`Org: ${orgInfo.data.name}`)
//   }
//   return orgs
// }

export async function listRepos({
  orgs,
  repoWhitelist,
  githubUrl,
  token
}: {
  orgs: string[]
  repoWhitelist: string[]
  githubUrl: string
  token: string
}): Promise<GithubRepo[]> {
  const octo = getOctokit(githubUrl, token)
  const repos = [] as GithubRepo[]

  for (const orgName of orgs) {
    if (repoWhitelist.length > 0) {
      // Avoid scanning the entire org if a whitelist is provided
      for (const repoName of repoWhitelist) {
        try {
          const repoRes = await octo.rest.repos.get({ owner: orgName, repo: repoName })
          repos.push(repoRes.data)
        } catch (error) {
          core.error(`Error fetching repos detail for ${repoName}: ${error}`)
        }
      }
      return repos
    }

    core.info(`Scanning for repos in ${orgName}`)
    try {
      // 'GET /orgs/{org}/repos'
      return await octo.paginate('GET /repos/{org}', { org: orgName })
    } catch (error) {
      core.error(`Error listing repos for org ${orgName}: ${error}`)
    }
  }

  return repos
}

export async function getRawFile(repo: GithubRepo, filePath: string, githubRawUrl: string, token: string): Promise<string> {
  const fileUrl = `${githubRawUrl}/${repo.full_name}/master/${filePath}`
  core.info(`Attempting to fetch ${fileUrl}`)

  const res = await fetch(fileUrl, {
    method: 'GET',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3.raw'
    }
  })

  if (res.status !== 200) throw new Error(`Failed to fetch raw file: ${res.status} ${res.statusText}`)

  return res.text()
}

export async function getCommitStatus(repo: GithubRepo, githubUrl: string, token: string): Promise<GithubCommitStatus> {
  const octo = getOctokit(githubUrl, token)
  const result = {} as GithubCommitStatus

  const commits = await octo.rest.repos.listCommits({
    owner: repo.owner.login,
    repo: repo.name
    // TODO: branch ref, defaults to repo.default_branch
  })

  if (commits.data?.length > 0) {
    result.commit_sha = commits.data[0].sha
    result.commit_time = commits.data[0].commit?.author?.date

    // TODO: Future enhancement
    // This may return a 202 indicating it has to be retried "after a few moments"
    //const metrics = await octo.rest.repos.getCommitActivityStats()

    const status = await octo.rest.repos.listCommitStatusesForRef({
      owner: repo.owner.login,
      repo: repo.name,
      ref: result.commit_sha
    })

    // TODO: This is assuming only one check and that the check is from CI
    //       In real world repos, there may be mutiple checks and not all are from a CI build system
    if (status && status.data.length > 0) {
      const ciStatus = status.data[0]
      result.commit_status_time = ciStatus.created_at
      result.commit_status_context = ciStatus.context
      result.commit_status_target_url = ciStatus.target_url
      result.commit_status_state = ciStatus.state
    }
  }

  return result
}

export async function getPullRequestCount(repo: GithubRepo, githubUrl: string, token: string): Promise<{ open: number; total: number }> {
  const octo = getOctokit(githubUrl, token)

  const allPrSearch = await octo.rest.search.issuesAndPullRequests({
    q: `repo:${repo.full_name} is:pr archived:false draft:false`
  })

  const openPrSearch = await octo.rest.search.issuesAndPullRequests({
    q: `repo:${repo.full_name} is:pr is:open archived:false draft:false`
  })

  return {
    total: allPrSearch?.data?.total_count,
    open: openPrSearch?.data?.total_count
  }
}

export async function getBranchProtection(repo: GithubRepo, githubUrl: string, token: string): Promise<BranchProtection> {
  const octo = getOctokit(githubUrl, token)

  const branchProtection = await octo.rest.repos.getBranchProtection({
    owner: repo.owner.login,
    repo: repo.name,
    branch: repo.default_branch
  })

  return branchProtection.data
}
