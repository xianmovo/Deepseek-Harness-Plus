'use strict'

// Provisions the wallpaper plugin into the web profile so the desktop app
// (and `dsh web`) can offer wallpaper backgrounds from Settings -> 壁纸.
//
// Thin CLI wrapper over src/plugins.js: idempotent, re-run any time to
// repair/refresh.
//
// Usage: node scripts/install-wallpaper-plugin.js

const { spawnSync } = require('node:child_process')
const { catalogEntry, installPlugin, listPlugins, profileDir } = require('../src/plugins.js')

const WALLPAPER = catalogEntry('wallpaper')

async function main() {
  console.log('provisioning the wallpaper plugin into the web profile...')
  console.log('  profile:', profileDir())

  // The dsh plugin command spawns pnpm with a shell on Windows; make the
  // pre-flight version check match so the pnpm.cmd shim resolves on PATH.
  const probe = spawnSync('pnpm --version', { shell: process.platform === 'win32', stdio: 'ignore' })
  if (probe.error || probe.status !== 0) throw new Error('pnpm is required on PATH (try: corepack enable / npm i -g pnpm)')

  const before = listPlugins().find((entry) => entry.id === WALLPAPER.id)
  console.log(`  ${before && before.installed ? 'already installed' : 'installing...'}`)
  await installPlugin(WALLPAPER)
  const after = listPlugins().find((entry) => entry.id === WALLPAPER.id)
  console.log(`  installed: ${after && after.installed}, enabled: ${after && after.enabled}`)
  console.log('done. Restart the desktop app (or dsh web), then open 设置 -> 壁纸 to pick a wallpaper.')
}

try {
  void main()
} catch (error) {
  console.error(`install-wallpaper-plugin FAILED: ${error.message}`)
  process.exit(1)
}
