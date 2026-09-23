'use strict'

// Checks the child_process patch that keeps Windows from opening a console
// window for every process the harness spawns: each call signature must end up
// with an options object carrying windowsHide, while an explicit value from the
// call site survives. Exits 0 on success, 1 on failure.

const { applyWindowsHideDefault } = require('../src/no-console-window.js')

const failures = []
let checks = 0

/** A stand-in child_process module recording the arguments of each call. */
function recorder() {
  const calls = []
  const stub = {}
  for (const name of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork']) {
    stub[name] = (...args) => { calls.push({ name, args }); return null }
  }
  return { stub, calls }
}

function check(label, actual, expected) {
  checks++
  const a = JSON.stringify(actual)
  const b = JSON.stringify(expected)
  if (a !== b) failures.push(`${label}: got ${a}, want ${b}`)
}

/** Find the options object a recorded call carries, skipping the argument array. */
function optionsOf(call) {
  return call.args.find((value) => value !== null && typeof value === 'object' && !Array.isArray(value) && typeof value !== 'function')
}

function hideOf(call) {
  const options = optionsOf(call)
  return options === undefined ? 'no options object' : options.windowsHide
}

const callback = () => {}
const { stub, calls } = recorder()
applyWindowsHideDefault(stub)

stub.spawn('cmd')
stub.spawn('cmd', ['a'])
stub.spawn('cmd', ['a'], { cwd: '/x' })
stub.spawn('cmd', { cwd: '/x' })
stub.spawn('cmd', ['a'], { windowsHide: false })
stub.spawnSync('cmd', ['a'])
stub.exec('cmd', callback)
stub.exec('cmd', { cwd: '/x' }, callback)
stub.execSync('cmd')
stub.execFile('tool', ['a'], callback)
stub.execFile('tool', ['a'], { cwd: '/x' })
stub.execFileSync('tool', ['a'])
stub.fork('./worker.js', ['a'], { cwd: '/x' })

const byIndex = (index) => calls[index]

check('spawn(file)', hideOf(byIndex(0)), true)
check('spawn(file, args)', hideOf(byIndex(1)), true)
check('spawn(file, args, options)', hideOf(byIndex(2)), true)
check('spawn(file, options)', hideOf(byIndex(3)), true)
check('spawn explicit false', hideOf(byIndex(4)), false)
check('spawnSync(file, args)', hideOf(byIndex(5)), true)
check('exec(command, callback)', hideOf(byIndex(6)), true)
check('exec(command, options, callback)', hideOf(byIndex(7)), true)
check('execSync(command)', hideOf(byIndex(8)), true)
check('execFile(file, args, callback)', hideOf(byIndex(9)), true)
check('execFile(file, args, options)', hideOf(byIndex(10)), true)
check('execFileSync(file, args)', hideOf(byIndex(11)), true)
check('fork(file, args, options)', hideOf(byIndex(12)), true)

check('spawn keeps cwd', optionsOf(byIndex(2)).cwd, '/x')
check('spawn keeps argument array', byIndex(2).args[1], ['a'])
check('exec keeps callback last', typeof byIndex(6).args[byIndex(6).args.length - 1], 'function')
check('execFile keeps callback last', typeof byIndex(9).args[byIndex(9).args.length - 1], 'function')

// The preload itself must patch the module it is required with.
const childProcess = require('node:child_process')
if (process.platform === 'win32' && childProcess.spawn.name !== 'patchedWindowsHide') {
  failures.push('preload did not patch the live node:child_process module')
}
checks++

if (failures.length > 0) {
  for (const failure of failures) console.error(`no-console-check: ${failure}`)
  console.error(`no-console-check: ${failures.length} of ${checks} checks failed`)
  process.exit(1)
}
console.log(`no-console-check: ok (${checks} checks)`)
