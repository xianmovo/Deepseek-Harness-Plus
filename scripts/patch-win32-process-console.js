'use strict'

// Adds CREATE_NO_WINDOW to the two CreateProcess calls in the bundled Win32
// process layer.
//
// A console-subsystem child of a process without a console gets a new console
// window unless its creation flags carry CREATE_NO_WINDOW. The desktop shell is
// a GUI process, and on Windows the harness runs ordinary subprocesses through
// this native path by default (the child_process layer, which sets windowsHide,
// is the fallback), so without the flag every tool call and every scheduled
// task opens a command window that flashes over the app.
//
// Idempotent. Wired as the package postinstall so a runtime upgrade cannot
// silently drop it, and re-run before packaging.
//
// Usage: node scripts/patch-win32-process-console.js

const fs = require('node:fs')
const path = require('node:path')

const TARGET = path.join(
  __dirname,'..','node_modules','@deepseek-ai','dsh-win32-process','lib','index.js',
)

/** CreateProcess flag that runs a console application without a console window. */
const CREATE_NO_WINDOW = '0x08000000'

/** Text that proves the flag is already present, however upstream spells it. */
const FLAG_PRESENT = /CREATE_NO_WINDOW|0x08000000|134217728/

/** One call site, pinned by the text around its creation flags. */
const SITES = [
  {
    label: 'CreateProcessAsUserW',
    from: '1, creationFlags, null, options.cwd',
    to: `1, creationFlags | ${CREATE_NO_WINDOW}, null, options.cwd`,
  },
  {
    label: 'CreateProcessW',
    from: '1, 1028, environment, options.cwd',
    to: `1, 1028 | ${CREATE_NO_WINDOW}, environment, options.cwd`,
  },
]

/** Add the flag to every site that still lacks it. */
function main() {
  if (!fs.existsSync(TARGET)) throw new Error(`win32 process layer not found: ${TARGET}`)
  let text = fs.readFileSync(TARGET, 'utf8')
  const patched = []
  const missing = []
  for (const site of SITES) {
    if (text.includes(site.to)) continue
    if (!text.includes(site.from)) {
      missing.push(site.label)
      continue
    }
    text = text.replace(site.from, site.to)
    patched.push(site.label)
  }
  if (patched.length === 0 && missing.length === 0) {
    console.log('patch-win32-process-console: already patched')
    return
  }
  if (missing.length > 0) {
    // Upstream may have fixed this itself, which changes the call sites.
    if (FLAG_PRESENT.test(text)) {
      console.log(`patch-win32-process-console: ${missing.join(', ')} already carry CREATE_NO_WINDOW upstream`)
      return
    }
    throw new Error(`${missing.join(
)}: creation flags call site not found; the bundled layer changed`)
  }
  fs.writeFileSync(TARGET, text, 'utf8')
  console.log(`patch-win32-process-console: added CREATE_NO_WINDOW to ${patched.join(
)}`)
}

try {
  main()
} catch (error) {
  console.error(`patch-win32-process-console FAILED: ${error.message}`)
  process.exit(1)
}
