import * as core from '@actions/core'

export interface ISettings {
  githubUrl: string
  githubRawUrl: string
  token: string
  tokenActor: string
  orgs: string[]
  repoWhitelist: string[]
  manifestFilename: string
  scanners: string[]
  outputDataFile: string

  veracodeApiUrl: string
  veracodeApiId: string
  veracodeApiKey: string
  veracodeUiUrl: string
  veracodeScaWorkspace: string

  jenkinsUser: string
  jenkinsToken: string
}

export async function getSettings(): Promise<ISettings> {
  const settings = {} as ISettings

  settings.githubUrl = core.getInput('githubUrl') || 'https://github.com'
  settings.githubRawUrl = core.getInput('githubRawUrl') || 'https://raw.github.com'

  settings.token = core.getInput('token') || process.env.GITHUB_TOKEN || ''
  settings.tokenActor = core.getInput('tokenActor') || ''
  settings.manifestFilename = core.getInput('manifestFilename') || 'manifest.yml'

  settings.scanners = splitInput(core.getInput('scanners')) || ['manifest']
  settings.orgs = splitInput(core.getInput('organizations'))
  settings.repoWhitelist = splitInput(core.getInput('repositoryWhitelist'))

  settings.outputDataFile = core.getInput('outputDataFile') || 'sbom.json'

  settings.jenkinsUser = core.getInput('jenkinsUser') || ''
  settings.jenkinsToken = core.getInput('jenkinsToken') || ''

  settings.veracodeUiUrl = 'sca.analysiscenter.veracode.com'
  settings.veracodeApiUrl = 'api.veracode.com'
  settings.veracodeApiId = core.getInput('veracodeApiId') || ''
  settings.veracodeApiKey = core.getInput('veracodeApiKey') || ''
  settings.veracodeScaWorkspace = core.getInput('veracodeScaWorkspace') || ''

  return settings
}

function splitInput(input: string): string[] {
  return (
    input
      .split(',')
      .filter(Boolean)
      .map(o => o.trim()) || []
  )
}
