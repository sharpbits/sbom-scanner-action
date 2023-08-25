import type { JestConfigWithTsJest } from 'ts-jest'

const config: JestConfigWithTsJest = {
  clearMocks: true,
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  preset: 'ts-jest/presets/default-esm',
  verbose: true
}

export default config
