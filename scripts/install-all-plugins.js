'use strict'

// Pre-install every catalog plugin into the dsh web profile (~/.dsh/profiles/web).
// Idempotent: plugins already installed are skipped. Run from desktop/:
//   node scripts/install-all-plugins.js
//
// dsh-ssh depends on ssh2/cpu-features, whose native build scripts pnpm blocks
// by default; this script pre-seeds allowBuilds: true for those two packages so
// the `dsh plugin add` step succeeds on the first run.

const fs = require('node:fs')
const path = require('node:path')
const { PLUGIN_CATALOG, installPlugin, listPlugins, profileDir } = require('../src/plugins.js')

const NATIVE_BUILD_DEPS = ['ssh2', 'cpu-features']

/** Ensure pnpm-workspace.yaml allows the native build scripts dsh-ssh needs. */
function ensureAllowBuilds() {
  const file = path.join(profileDir(), 'pnpm-workspace.yaml')
  let text = ''
  try { text = fs.readFileSync(file, 'utf8') } catch { text = 'packages:\n  - .\n' }
  const block = 'allowBuilds:\n' + NATIVE_BUILD_DEPS.map((key) => `  ${key}: true`).join('\n') + '\n'
  if (/allowBuilds:/m.test(text)) {
    text = text.replace(/allowBuilds:[\s\S]*$/, block)
  } else {
    text = text.replace(/\s*$/, '\n' + block)
  }
  fs.writeFileSync(file, text, 'utf8')
}

async function main() {
  ensureAllowBuilds()
  console.log('Installing plugins into web profile:', profileDir())
  for (const entry of PLUGIN_CATALOG) {
    const before = listPlugins().find((p) => p.id === entry.id)
    if (before && before.installed) {
      console.log(`  [ok] ${entry.name} (${entry.spec}) already installed`)
      continue
    }
    process.stdout.write(`  installing ${entry.name} (${entry.spec}) ... `)
    try {
      await installPlugin(entry)
      console.log('ok')
    } catch (error) {
      console.log('FAILED')
      console.error('    ' + String(error.message).split('\n').slice(0, 3).join('\n'))
      process.exitCode = 1
    }
  }
  console.log('\nResult:')
  for (const p of listPlugins()) {
    console.log(`  [${p.installed ? 'x' : ' '}] ${p.name} (${p.spec}) enabled=${p.enabled}`)
  }
  if (process.exitCode) {
    console.error('\nSome plugins failed to install; see the messages above.')
    process.exit(process.exitCode)
  }
}

void main()
