'use strict'

// Plugin catalog + provisioning for the dsh web profile, shared by the
// desktop plugin page (IPC) and scripts/install-wallpaper-plugin.js.
//
// Plugins install into ~/.dsh/profiles/web via `dsh plugin --profile web
// add <spec>` (a thin pnpm forwarder). dsh-wallpaper-ui@0.1.3 ships a bundle
// patch that imports the module name `dsh-wallpaper` while the npm package is
// `dsh-wallpaper-ui`, so it needs an extra pnpm alias (dsh-wallpaper ->
// dsh-wallpaper-ui) and the alias must stay OUT of dsh.profile.bundles or the
// same patch applies twice and fails with `duplicate loader entry id`.

const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const PROFILE = 'web'
const WALLPAPER_SPEC = 'dsh-wallpaper-ui'
const WALLPAPER_ALIAS = 'dsh-wallpaper'

/** Catalog surfaced by the plugin page. `verified` = tested on @deepseek-ai/dsh rc.8. */
const PLUGIN_CATALOG = [
  {
    id: 'wallpaper',
    spec: WALLPAPER_SPEC,
    name: '壁纸背景',
    category: '外观',
    verified: true,
    description: '图片 / GIF / MP4 / WebM 壁纸，五种铺满模式，透明度 / 亮度 / 模糊 / 遮罩调节，本地上传 + URL。',
  },
  {
    id: 'live-stats',
    spec: '@linxin666/dsh-live-stats',
    name: '实时统计',
    category: '效率',
    verified: false,
    description: 'Web 界面实时显示 token 估算与生成吞吐。',
  },
  {
    id: 'git-graph',
    spec: '@linxin666/dsh-client-ui-git-graph',
    name: 'Git 图谱',
    category: '开发',
    verified: false,
    description: '空白会话的分支选择器 + Git 图谱，宿主侧真实 git 操作。',
  },
  {
    id: 'ssh',
    spec: '@linxin666/dsh-ssh',
    name: '远程 SSH',
    category: '开发',
    verified: false,
    description: '远程主机配置、SSH 终端、SFTP 传输、本地端口转发。',
  },
  {
    id: 'config-manager',
    spec: 'dsh-config-manager',
    name: '配置备份 / 迁移',
    category: '工具',
    verified: false,
    description: 'DSH 配置的备份、导出、导入与迁移（带 Web UI）。',
  },
  {
    id: 'task-board',
    spec: '@linxin666/dsh-client-ui-task-board',
    name: '任务看板',
    category: '效率',
    verified: false,
    description: '宿主权威的任务看板，支持定时调度与空闲保护。',
  },
]

function profileDir() {
  return path.join(os.homedir(), '.dsh', 'profiles', PROFILE)
}

function manifestPath() {
  return path.join(profileDir(), 'package.json')
}

function readManifest() {
  try {
    return JSON.parse(fs.readFileSync(manifestPath(), 'utf8'))
  } catch {
    return { dependencies: {} }
  }
}

function writeManifest(pkg) {
  fs.mkdirSync(profileDir(), { recursive: true })
  fs.writeFileSync(manifestPath(), JSON.stringify(pkg, null, 2) + '\n', 'utf8')
}

function dshBinPath() {
  return path.join(__dirname, '..', 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
}

/** Run one `dsh plugin --profile web <args>` and resolve with combined output. */
function runDshPlugin(args) {
  const bin = dshBinPath()
  if (!fs.existsSync(bin)) return Promise.reject(new Error(`dsh CLI not found: ${bin}`))
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [bin, 'plugin', '--profile', PROFILE, ...args], {
      windowsHide: true,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    })
    let output = ''
    child.stdout.on('data', (chunk) => { output += chunk })
    child.stderr.on('data', (chunk) => { output += chunk })
    child.on('error', (error) => reject(error))
    child.on('exit', (code) => {
      if (code === 0) resolve(output.trim())
      else reject(new Error(output.trim() || `dsh plugin ${args.join(' ')} exited with code ${String(code)}`))
    })
  })
}

/** Retry transient pnpm lockfile contention on Windows (EPERM renaming the lockfile). */
async function runDshPluginRetry(args) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await runDshPlugin(args)
    } catch (error) {
      if (attempt >= 2 || !/EPERM|EACCES/.test(String(error.message))) throw error
      await new Promise((resolve) => setTimeout(resolve, 1200))
    }
  }
}

/** Ensure the wallpaper alias stays out of dsh.profile.bundles (duplicate entry id). */
function enforceWallpaperBundles() {
  const pkg = readManifest()
  const bundles = pkg.dsh?.profile?.bundles ?? []
  const cleaned = bundles.filter((entry) => entry !== WALLPAPER_ALIAS)
  if (cleaned.length === bundles.length) return false
  pkg.dsh = { ...pkg.dsh, profile: { ...pkg.dsh.profile, bundles: cleaned } }
  writeManifest(pkg)
  return true
}

/** Install a catalog plugin by spec; returns the updated status list. */
async function installPlugin(spec) {
  await runDshPluginRetry(['add', spec])
  if (spec === WALLPAPER_SPEC) {
    await runDshPluginRetry(['add', `${WALLPAPER_ALIAS}@npm:${WALLPAPER_SPEC}@^0.1.3`])
    enforceWallpaperBundles()
  }
  return listPlugins()
}

/** Uninstall a catalog plugin by spec; returns the updated status list. */
async function uninstallPlugin(spec) {
  await runDshPluginRetry(['remove', spec])
  if (spec === WALLPAPER_SPEC) {
    await runDshPluginRetry(['remove', WALLPAPER_ALIAS]).catch(() => {})
    enforceWallpaperBundles()
  }
  return listPlugins()
}

/** Status for every catalog entry: installed = dependency present, enabled = profile bundle. */
function listPlugins() {
  const pkg = readManifest()
  const deps = pkg.dependencies ?? {}
  const bundles = pkg.dsh?.profile?.bundles ?? []
  return PLUGIN_CATALOG.map((entry) => ({
    ...entry,
    installed: Boolean(deps[entry.spec]),
    enabled: bundles.includes(entry.spec),
  }))
}



function openPluginProfile() {
  return profileDir()
}

module.exports = {
  PLUGIN_CATALOG,
  installPlugin,
  listPlugins,
  openPluginProfile,
  profileDir,
  runDshPluginRetry,
  uninstallPlugin,
  WALLPAPER_ALIAS,
  WALLPAPER_SPEC,
}
