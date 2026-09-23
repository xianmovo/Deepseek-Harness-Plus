'use strict'

// Plugin catalog + provisioning for the dsh web profile, shared by the
// desktop preinstall scripts.
//
// Plugins install into ~/.dsh/profiles/web through `dsh plugin --profile web
// add <spec>` (a thin pnpm forwarder). That command reconciles
// `dsh.profile.bundles` against the installed dependencies and adds every
// dependency whose manifest declares `dsh.bundle`, so one plugin must be
// installed under exactly one name: installing its package both directly and
// under an alias applies the bundle patch twice and fails the boot with
// `duplicate loader entry id`.
//
// dsh-wallpaper-ui is that case. Its cordis patch inserts a loader entry that
// imports the name `dsh-wallpaper`, so the package installs under that alias
// only and never under its own name.

const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const PROFILE = 'web'
/** Dependency key the wallpaper plugin installs under. */
const WALLPAPER_ALIAS = 'dsh-wallpaper'
/** Install argument that points the wallpaper alias at the published package. */
const WALLPAPER_SPEC = `${WALLPAPER_ALIAS}@npm:dsh-wallpaper-ui@^0.1.3`

/** Catalog of preinstalled plugins. `spec` is the profile dependency key. */
const PLUGIN_CATALOG = [
  {
    id: 'wallpaper',
    spec: WALLPAPER_ALIAS,
    installSpec: WALLPAPER_SPEC,
    name: '壁纸背景',
    category: '外观',
    description:
      '图片 / GIF / MP4 / WebM 壁纸，五种铺满模式，透明度 / 亮度 / 模糊 / 遮罩调节，本地上传 + URL。',
  },
  {
    id: 'git-graph',
    spec: '@linxin666/dsh-client-ui-git-graph',
    name: 'Git 图谱',
    category: '开发',
    description: '空白会话的分支选择器 + Git 图谱，宿主侧真实 git 操作。',
  },
  {
    id: 'ssh',
    spec: '@linxin666/dsh-ssh',
    name: '远程 SSH',
    category: '开发',
    description: '远程主机配置、SSH 终端、SFTP 传输、本地端口转发。',
  },
  {
    id: 'config-manager',
    spec: 'dsh-config-manager',
    name: '配置备份 / 迁移',
    category: '工具',
    description: 'DSH 配置的备份、导出、导入与迁移（带 Web UI）。',
  },
  {
    id: 'task-board',
    spec: '@linxin666/dsh-client-ui-task-board',
    name: '任务看板',
    category: '效率',
    description: '宿主权威的任务看板，支持定时调度与空闲保护。',
  },
]

/** Directory of the web profile. */
function profileDir() {
  return path.join(os.homedir(), '.dsh', 'profiles', PROFILE)
}

/** One catalog entry by id. */
function catalogEntry(id) {
  const entry = PLUGIN_CATALOG.find((candidate) => candidate.id === id)
  if (!entry) throw new Error(`unknown plugin id: ${id}`)
  return entry
}

/** Install argument for an entry: the aliased spec where the package name differs. */
function installSpecOf(entry) {
  return entry.installSpec ?? entry.spec
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

/** Install one catalog entry and return the refreshed status list. */
async function installPlugin(entry) {
  await runDshPluginRetry(['add', installSpecOf(entry)])
  return listPlugins()
}

/** Remove one catalog entry and return the refreshed status list. */
async function uninstallPlugin(entry) {
  await runDshPluginRetry(['remove', entry.spec])
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
  catalogEntry,
  installPlugin,
  listPlugins,
  openPluginProfile,
  profileDir,
  runDshPluginRetry,
  uninstallPlugin,
  WALLPAPER_ALIAS,
  WALLPAPER_SPEC,
}
