import * as core from '@actions/core'
import { load } from 'js-yaml'
import { getBranchProtection, getCommitStatus, getPullRequestCount, getRawFile, GithubCommitStatus, GithubRepo } from '../clients/github'
import { ISettings } from '../settings'
import { IScanner, IScannerResult } from './scanner'

export interface ManifestScannerResult extends IScannerResult {
  manifest?: RepositoryManifest
  dockerfile?: DockerfileInfo
  github: GithubInfo
}

export interface RepositoryManifest {
  project_name: string
  project_type: string
  components: {
    component_key: string
    name: string
    root_directory?: string
    component_id?: string
    veracode_app?: string
    new_relic_app?: string
    veracode_sca_root?: string
    technologies: {
      type: 'language' | 'framework'
      name: string
      version: string
    }[]
  }[]
}

export interface DockerfileInfo {
  base_image: string
  base_version: string
  technologies: {
    type: 'language' | 'framework'
    name: string
    version: string
  }[]
}

export interface GithubInfo {
  master_status?: GithubCommitStatus
  open_pr_count?: number
  total_pr_count?: number
  is_private?: boolean
  has_main_branch_protection?: boolean
  main_branch_min_approvals?: number
  main_branch_req_status_checks?: boolean
  main_branch_allow_force?: boolean
}

// Attempts to gather basic information about the technology and configuration of a repository
//   Will determine this based on manifest.yml, Dockerfile, package.json
export class ManifestScanner implements IScanner {
  scannerName = 'manifest'
  manifestFilename = ''
  githubUrl = ''
  githubRawUrl = ''
  githubToken = ''

  initialize(settings: ISettings): void {
    this.manifestFilename = settings.manifestFilename
    this.githubToken = settings.token
    this.githubUrl = settings.githubUrl
    this.githubRawUrl = settings.githubRawUrl
  }

  async scan(repo: GithubRepo): Promise<IScannerResult> {
    const result = {
      scanner_name: this.scannerName,
      messages: [],
      github: {}
    } as ManifestScannerResult

    // Attempt to fetch and parse manifest
    try {
      const manifestContent = await getRawFile(repo, this.manifestFilename, this.githubRawUrl, this.githubToken)
      if (manifestContent) {
        result.manifest = load(manifestContent) as RepositoryManifest
      }
    } catch (error) {
      core.info(`Failed to find manifest for ${repo.name}: ${error}`)
      result.messages.push({ level: 'warning', message: 'Manifest document not found' })
    }

    // Fetch Dockerfile...
    // TODO: Perform this per-component and respect root_directory
    try {
      const dockerfileContent = await getRawFile(repo, 'Dockerfile', this.githubRawUrl, this.githubToken)
      if (dockerfileContent) {
        result.dockerfile = {
          base_image: '',
          base_version: '',
          technologies: []
        }
        this.parseDockerfile(result.dockerfile, dockerfileContent)
      }
    } catch (error) {
      core.info(`Failed to find dockerfile for ${repo.name}: ${error}`)
      result.messages.push({ level: 'warning', message: 'Dockerfile not found' })
    }

    // Fetch CI stats from last master branch build
    try {
      result.github.master_status = await getCommitStatus(repo, this.githubUrl, this.githubToken)
    } catch (error) {
      result.messages.push({ level: 'warning', message: 'Failed to retrieve master commit status' })
    }

    // Fetch PR stats
    try {
      const counts = await getPullRequestCount(repo, this.githubUrl, this.githubToken)
      result.github.open_pr_count = counts.open
      result.github.total_pr_count = counts.total
    } catch (error) {
      result.messages.push({ level: 'warning', message: 'Failed to retrieve pull request count' })
    }

    try {
      const protection = await getBranchProtection(repo, this.githubUrl, this.githubToken)
      result.github.has_main_branch_protection = (protection?.required_pull_request_reviews?.required_approving_review_count || 0) > 0
      result.github.main_branch_min_approvals = protection?.required_pull_request_reviews?.required_approving_review_count || 0
      result.github.main_branch_allow_force = protection.allow_force_pushes?.enabled || false
      result.github.main_branch_req_status_checks = (protection?.required_status_checks?.checks?.length || 0) > 0
    } catch (error) {
      result.messages.push({ level: 'warning', message: 'Failed to retrieve branch protection information' })
    }

    // TODO: Fetch package.json?
    // TODO: Fetch pyproject.toml?

    return result
  }

  parseDockerfile(result: DockerfileInfo, dockerfileContent: string): void {
    const commands = dockerfileContent.split('\n')

    // Example line: FROM public.ecr.aws/lambda/python:3.9 as runtime
    const firstFrom = commands.find(c => c.startsWith('FROM'))
    if (firstFrom) {
      const fromArr = firstFrom.split(' ')
      const img = fromArr[1].split(':')
      result.base_image = img[0]
      if (img.length > 1) {
        result.base_version = img[1]
      }

      result.technologies.push({
        type: 'language',
        name: result.base_image.substring(result.base_image.lastIndexOf('/') + 1),
        version: result.base_version
      })
    }

    // TODO: Exposed ports?
  }
}

export default ManifestScanner
