'use strict'

// Windows allocates a fresh console window for every console-subsystem child
// process of a parent that has none, unless the spawn passes CREATE_NO_WINDOW.
// Node maps that flag to `windowsHide`, which defaults to false, and the
// harness starts tool, sandbox, and job processes from many call sites, so
// each one would flash its own console window over the app.
//
// The desktop shell is a GUI process with no console, so the default is applied
// once here, process-wide, for the bundled runtime. main.js injects this file
// into the dsh child with `--require`, which also covers the plugins running
// inside that process.
//
// A call site that sets `windowsHide` explicitly keeps its value. Interactive
// terminals are unaffected: node-pty allocates a ConPTY instead of going
// through node:child_process.

/** child_process functions whose options object may follow an argument array. */
const PATCHED = ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork']

/**
 * Add `windowsHide: true` to one child_process call.
 * @param args - the call's arguments, mutated in place.
 * @returns the same array, carrying an options object with `windowsHide`.
 */
function hideWindowArguments(args) {
  let placeholder = -1
  for (let index = 1; index < args.length; index++) {
    const value = args[index]
    if (Array.isArray(value)) continue
    if (typeof value === 'function') break
    if (value === null || value === undefined) {
      // `spawn(file, null, options)` puts the real options object after the
      // placeholder, so a null only becomes the options object as a fallback.
      if (placeholder === -1) placeholder = index
      continue
    }
    if (typeof value !== 'object') break
    if (!('windowsHide' in value)) return replace(args, index, { ...value, windowsHide: true })
    return args
  }
  if (placeholder !== -1) return replace(args, placeholder, { windowsHide: true })
  const trailing = args[args.length - 1]
  if (typeof trailing === 'function') args.splice(args.length - 1, 0, { windowsHide: true })
  else args.push({ windowsHide: true })
  return args
}

/**
 * Replace one argument, keeping the array identity callers already hold.
 * @param args - the call's argument list.
 * @param index - position to replace.
 * @param value - replacement value.
 * @returns the same array.
 */
function replace(args, index, value) {
  args[index] = value
  return args
}

/**
 * Route every child_process launch through CREATE_NO_WINDOW.
 * @param childProcess - the `node:child_process` module to patch.
 * @returns the same module.
 */
function applyWindowsHideDefault(childProcess) {
  for (const name of PATCHED) {
    const original = childProcess[name]
    if (typeof original !== 'function') continue
    childProcess[name] = function patchedWindowsHide(...args) {
      return Reflect.apply(original, this, hideWindowArguments(args))
    }
  }
  return childProcess
}

if (process.platform === 'win32') applyWindowsHideDefault(require('node:child_process'))

module.exports = { applyWindowsHideDefault, hideWindowArguments }
