import * as core from '@actions/core'
import { run } from './action'

async function cleanup(): Promise<void> {
  try {
    // TODO: Cleanup from action run as needed
  } catch (error) {
    core.warning(`${(error as Error)?.message ?? error}`)
  }
}

// Actions are always invoked in two phases, run and and cleanup
if (!process.env['STATE_isPost']) {
  void run()
} else {
  void cleanup()
}
