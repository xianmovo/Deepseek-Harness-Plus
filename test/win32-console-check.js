'use strict'

// Asserts the bundled Win32 process layer passes CREATE_NO_WINDOW to
// CreateProcess, the flag that keeps a console window from opening for every
// ordinary subprocess the harness starts. Skips off Windows. Exits 0 on
// success, 1 on failure.

const path = require('node:path')

const CREATE_NO_WINDOW = 0x08000000

if (process.platform !== 'win32') {
  console.log('win32-console-check: skipped (not Windows)')
  process.exit(0)
}

const layer = path.join(__dirname, '..', 'node_modules', '@deepseek-ai', 'dsh-win32-process', 'lib', 'index.js')
const { loadWin32ProcessBindings, spawnCurrentTokenJobProcess } = require(layer)

const api = loadWin32ProcessBindings()
const calls = []
for (const name of ['createProcessW', 'createProcessAsUserW']) {
  const original = api[name]
  if (typeof original !== 'function') continue
  api[name] = (...args) => {
    calls.push({ name, flags: args[5] })
    return original.apply(api, args)
  }
}

// Creation flags are the sixth argument of both CreateProcess entry points.
spawnCurrentTokenJobProcess(api, {
  command: process.execPath,
  applicationName: process.execPath,
  args: ['-e', ''],
  cwd: process.cwd(),
  env: {
    SystemRoot: process.env.SystemRoot ?? 'C:\\Windows',
    PATH: process.env.PATH ?? '',
    TEMP: process.env.TEMP ?? '',
  },
  stdio: { stdin: 0, stdout: 1, stderr: 2 },
})

if (calls.length === 0) {
  console.error('win32-console-check: no CreateProcess call was recorded')
  process.exit(1)
}

const missing = calls.filter((call) => (call.flags & CREATE_NO_WINDOW) === 0)
if (missing.length > 0) {
  for (const call of missing) {
    console.error(`win32-console-check: ${call.name} flags ${call.flags} lack CREATE_NO_WINDOW`)
  }
  process.exit(1)
}

console.log('win32-console-check: ok (' + calls.map((call) => `${call.name}=${call.flags}`).join(', ') + ')')
