/* eslint-disable filenames/match-regex */

import { run } from '../src/action'

test('Runs scanner', async () => {
  await run()
}, 15000)
