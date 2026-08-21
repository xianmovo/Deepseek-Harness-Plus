'use strict'

// Detached cleanup helper for `--window-test`: the Electron main process holds
// browser-storage handles in its isolated userData dir until it exits, so the
// delete runs here after this helper starts. Retries until the dir is gone or
// a hard deadline passes; exits 0 either way.

const fs = require('node:fs')

const target = process.argv[2]
if (!target) process.exit(0)

const deadline = Date.now() + 10_000

;(function retry() {
  try {
    fs.rmSync(target, { recursive: true, force: true })
    process.exit(0)
  } catch { /* handles still locked; keep waiting */ }
  if (Date.now() >= deadline) process.exit(0)
  setTimeout(retry, 300)
})()