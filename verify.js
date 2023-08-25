/* eslint-disable no-console */

import * as fs from 'fs'

const sbomJson = fs.readFileSync('sbom.json')
const sbom = JSON.parse(sbomJson)

if (!sbom || !sbom.scan_date || !sbom.orgs?.length === 1) {
  throw new Error('Failed to parse SBOM JSON')
}

const entry = sbom.repos['sbom-scanner-action']
if (
  !entry ||
  !entry?.manifest?.github?.master_status?.commit_sha ||
  entry?.manifest?.manifest?.project_name !== 'SBOM Scanner Action' ||
  entry?.manifest?.dockerfile?.base_image !== 'node'
) {
  throw new Error('Failed to verify data from SBOM')
}

console.log('Test output verified')
