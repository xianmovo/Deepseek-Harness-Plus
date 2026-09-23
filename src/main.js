'use strict'

const { app, BrowserWindow, Menu, Tray, clipboard, ipcMain, nativeImage, nativeTheme, shell } = require('electron')
const { spawn, spawnSync, execFileSync } = require('node:child_process')
const fs = require('node:fs')
const http = require('node:http')
const os = require('node:os')
const path = require('node:path')
const { SCENARIOS } = require('./scenarios.js')
const { LANGUAGES, MESSAGES, translate } = require('./i18n.js')
const { THIRD_PARTY } = require('./thirdparty.js')

/** Window icon / title-bar brand asset (repo-root 256x.png). */
// Packaged builds get the logo from resources/brand/ via extraResources;
// dev runs read it straight from the repo root.
const LOGO_PATH = app.isPackaged
  ? path.join(process.resourcesPath, 'brand', 'app-icon.png')
  : path.join(__dirname, '..', 'assets', 'app-icon.png')

const SMOKE_TEST = process.argv.includes('--smoke-test')
const WINDOW_TEST = process.argv.includes('--window-test')
const URL_LINE_RE = /^dsh web: (\S+)/
const START_TIMEOUT_MS = Number(process.env.DSH_DESKTOP_START_TIMEOUT_MS ?? 120_000)
const STALL_TIMEOUT_MS = 20_000
const STDOUT_BUFFER_MAX = 64 * 1024
const TASKKILL = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'taskkill.exe')

/** Preload that removes the console window Windows gives every child process. */
const NO_CONSOLE_WINDOW = path.join(__dirname, 'no-console-window.js')
const LOG_FILE_NAME = 'dsh-desktop.log'
const LOG_FILE_MAX_BYTES = 5 * 1024 * 1024
const SERVER_AUTO_RESTART_MAX = 3
const SERVER_CRASH_WINDOW_MS = 60_000
const RENDERER_CRASH_MAX = 3
const RENDERER_CRASH_WINDOW_MS = 60_000

// Window tests run against an isolated userData dir: the auto-selected
// scenario never touches real app state. Must be set before the single
// instance lock (which lives under userData) and before any getPath('userData').
const TEST_USER_DATA = WINDOW_TEST ? path.join(os.tmpdir(), `dsh-desktop-window-test-${process.pid}`) : null
if (TEST_USER_DATA) app.setPath('userData', TEST_USER_DATA)

let mainWindow = null
let serverProc = null
let serverUrl = null
let quitting = false
let smokeDone = false
let windowTestDone = false
let tray = null
let currentPage = 'loading' // wizard | loading | debug | appearance | about | thirdparty | error | web
let appearanceCssKey = null
let serverStartedAt = null
let serverCrashCount = 0
let lastServerCrashAt = 0
let rendererCrashCount = 0
let lastRendererCrashAt = 0

const LOG_ENTRY_MAX = 2000
const logEntries = []
function logFilePath() {
  return path.join(app.getPath('userData'), 'logs', LOG_FILE_NAME)
}

function appendLogFile(text) {
  try {
    const file = logFilePath()
    fs.mkdirSync(path.dirname(file), { recursive: true })
    let size = 0
    try { size = fs.statSync(file).size } catch { /* new file */ }
    if (size > LOG_FILE_MAX_BYTES) {
      fs.writeFileSync(`${file}.old`, fs.readFileSync(file))
      fs.writeFileSync(file, '')
    }
    fs.appendFileSync(file, text)
  } catch { /* log persistence is best effort */ }
}

const THEMES = ['dark', 'light', 'system']
const DEFAULT_APPEARANCE = { theme: 'dark', accent: 'blue', fontFamily: 'system', fontFamilyCode: 'mono', fontSize: 13, customCss: '', lang: 'zh' }
const ACCENTS = { blue: '#4d7cfe', green: '#22b573', purple: '#9b6bff', orange: '#f0903c' }
const ACCENT_HEX_RE = /^#[0-9a-fA-F]{6}$/
const CUSTOM_CSS_MAX = 20000

function isAccent(value) {
  return Boolean(ACCENTS[value]) || (typeof value === 'string' && ACCENT_HEX_RE.test(value))
}

function resolveAccent(a) {
  if (ACCENTS[a.accent]) return ACCENTS[a.accent]
  return typeof a.accent === 'string' && ACCENT_HEX_RE.test(a.accent) ? a.accent : ACCENTS.blue
}
const FONT_STACKS = {
  system: `system-ui, -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif`,
  yahei: `'Microsoft YaHei', '微软雅黑', system-ui, sans-serif`,
  pingfang: `'PingFang SC', '苹方', 'Microsoft YaHei', system-ui, sans-serif`,
  noto: `'Noto Sans SC', 'Source Han Sans SC', 'Microsoft YaHei', system-ui, sans-serif`,
  mono: `'Cascadia Mono', 'JetBrains Mono', Consolas, 'Courier New', monospace`,
  serif: `Georgia, 'Times New Roman', 'Songti SC', 'SimSun', serif`,
}

// --- appearance settings ---
//
// Persisted at <userData>/appearance.json. Theme/accent/font apply to the
// shell pages through injected CSS variables; on the harness web page the font
// is applied by overriding its root --dsw-font-family/--ds-font-family-code
// tokens and the theme by toggling body[data-ds-dark-theme].

function appearancePath() {
  return path.join(app.getPath('userData'), 'appearance.json')
}

function loadAppearance() {
  try {
    const raw = JSON.parse(fs.readFileSync(appearancePath(), 'utf8'))
    const next = { ...DEFAULT_APPEARANCE }
    if (THEMES.includes(raw.theme)) next.theme = raw.theme
    if (isAccent(raw.accent)) next.accent = raw.accent
    if (typeof raw.customCss === 'string') next.customCss = raw.customCss.slice(0, CUSTOM_CSS_MAX)
    if (FONT_STACKS[raw.fontFamily]) next.fontFamily = raw.fontFamily
    if (FONT_STACKS[raw.fontFamilyCode]) next.fontFamilyCode = raw.fontFamilyCode
    if (Number.isFinite(raw.fontSize)) next.fontSize = Math.min(16, Math.max(12, Math.round(raw.fontSize)))
    if (LANGUAGES.some((lang) => lang.id === raw.lang)) next.lang = raw.lang
    return next
  } catch {
    return { ...DEFAULT_APPEARANCE }
  }
}

let appearance = loadAppearance()

function saveAppearance(patch) {
  const prevLang = appearance.lang
  const next = { ...appearance, ...(patch ?? {}) }
  if (THEMES.includes(next.theme)) appearance.theme = next.theme
  if (isAccent(next.accent)) appearance.accent = next.accent
  if (typeof next.customCss === 'string') appearance.customCss = next.customCss.slice(0, CUSTOM_CSS_MAX)
  if (FONT_STACKS[next.fontFamily]) appearance.fontFamily = next.fontFamily
  if (FONT_STACKS[next.fontFamilyCode]) appearance.fontFamilyCode = next.fontFamilyCode
  if (Number.isFinite(next.fontSize)) appearance.fontSize = Math.min(16, Math.max(12, Math.round(next.fontSize)))
  if (LANGUAGES.some((lang) => lang.id === next.lang)) appearance.lang = next.lang

  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true })
    fs.writeFileSync(appearancePath(), JSON.stringify(appearance, null, 2) + '\n', 'utf8')
  } catch { /* appearance persistence is best effort */ }
  nativeTheme.themeSource = appearance.theme
  if (prevLang !== appearance.lang) refreshMenus()
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('appearance:changed', { ...appearance })
    applyAppearance()
  }
}

/** Translate a shell UI string for the current language. */
function t(key, params) {
  return translate(appearance.lang, key, params)
}

function resolveTheme(a) {
  return a.theme === 'system' ? (nativeTheme.shouldUseDarkColors ? 'dark' : 'light') : a.theme
}

function buildShellAppearanceCss(a) {
  const dark = resolveTheme(a) === 'dark'
  const accent = resolveAccent(a)
  const stack = FONT_STACKS[a.fontFamily] ?? FONT_STACKS.system
  const monoStack = FONT_STACKS[a.fontFamilyCode] ?? FONT_STACKS.mono
  return [
    `:root{color-scheme:${dark ? 'dark' : 'light'}}`,
    `:root{--dsh-bg:${dark ? '#0f1115' : '#f5f6f8'};--dsh-bg-card:${dark ? '#161a22' : '#ffffff'};--dsh-bg-hover:${dark ? '#182136' : '#eef1f7'}}`,
    `:root{--dsh-fg:${dark ? '#e6e6e6' : '#1c1e24'};--dsh-fg-dim:${dark ? '#9aa4b2' : '#5c6470'};--dsh-fg-soft:${dark ? '#c9d1dc' : '#3a4150'}}`,
    `:root{--dsh-border:${dark ? '#2a2f3a' : '#d9dce3'};--dsh-border-strong:${dark ? '#3d4e73' : '#b6c1d4'}}`,
    `:root{--dsh-accent:${accent};--dsh-accent-soft:${accent}33;--dsh-accent-fg:#ffffff}`,
    `:root{--dsh-danger:${dark ? '#ff8f8f' : '#d64545'}}`,
    `:root{--dsh-ui-font:${stack};--dsh-mono-font:${monoStack};--dsh-font-size:${a.fontSize}px}`,
    ...(a.customCss ? [a.customCss] : []),
  ].join('')
}

function buildWebAppearanceCss(a) {
  const stack = FONT_STACKS[a.fontFamily] ?? FONT_STACKS.system
  const codeStack = FONT_STACKS[a.fontFamilyCode] ?? FONT_STACKS.mono
  return [
    `:root{--dsw-font-family:${stack};--ds-font-family-code:${codeStack}}`,
    `:root{color-scheme:${resolveTheme(a)}}`,
    ...(a.customCss ? [a.customCss] : []),
  ].join('')
}

function applyAppearance() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  const url = mainWindow.webContents.getURL()
  const onLocal = url.startsWith('file:')
  const onWeb = Boolean(serverUrl) && url.startsWith(serverUrl)
  const css = onLocal ? buildShellAppearanceCss(appearance) : onWeb ? buildWebAppearanceCss(appearance) : null
  if (appearanceCssKey) {
    try { mainWindow.webContents.removeInsertedCSS(appearanceCssKey) } catch { /* already gone */ }
    appearanceCssKey = null
  }
  if (css) {
    mainWindow.webContents.insertCSS(css).then((key) => { appearanceCssKey = key }).catch(() => {})
  }
  if (onWeb && appearance.theme !== 'system') {
    const statement = appearance.theme === 'dark'
      ? "document.body.setAttribute('data-ds-dark-theme', '')"
      : "document.body.removeAttribute('data-ds-dark-theme')"
    mainWindow.webContents.executeJavaScript(`(() => { const b = document.body; if (!b) return; ${statement} })()`).catch(() => {})
  }
}

// --- running log (debug page) ---

/** Replace credential-shaped strings so they never reach logs or the UI. */
function redactSecrets(text) {
  return String(text).replace(/(sk-[A-Za-z0-9]{16,})/g, 'sk-***')
}

function pushLog(kind, text) {
  const now = new Date().toISOString()
  const lines = String(redactSecrets(text)).split(/\r?\n/)
  appendLogFile(lines.map((line) => `${now} [${kind}] ${line}\n`).join(''))
  for (const line of lines) logEntries.push({ t: now, kind, text: line })
  if (logEntries.length > LOG_ENTRY_MAX) logEntries.splice(0, logEntries.length - LOG_ENTRY_MAX)
  if (mainWindow && !mainWindow.isDestroyed()) {
    for (const line of lines) mainWindow.webContents.send('debug:log', { t: now, kind, text: line })
  }
}

function readInstalledVersion(pkgRoot, name) {
  try {
    return JSON.parse(fs.readFileSync(path.join(pkgRoot, name, 'package.json'), 'utf8')).version || ''
  } catch {
    return ''
  }
}

/** Curated third-party catalog enriched with the installed versions. */
function thirdPartyList() {
  const desktopRoot = path.join(__dirname, '..', 'node_modules')
  const profileRoot = path.join(os.homedir(), '.dsh', 'profiles', 'web', 'node_modules')
  return THIRD_PARTY.map((entry) => {
    const root = entry.category === 'plugin' ? profileRoot : desktopRoot
    const version = readInstalledVersion(root, entry.name) || entry.version || ''
    return { ...entry, version }
  })
}

function debugState() {
  return {
    running: Boolean(serverProc),
    url: serverUrl,
    pid: serverProc ? serverProc.pid : null,
    startedAt: serverStartedAt,
    scenario: scenarioTitle() ?? t('debug.notSelected'),
    patch: activeScenarioPatch(),
    count: logEntries.length,
    logTail: logEntries.slice(-500),
    logFile: logFilePath(),
  }
}

function clearDebugLog() {
  logEntries.length = 0
  pushLog('sys', '[dsh-desktop] log cleared')
}

function copyDebugLog() {
  clipboard.writeText(logEntries.map((entry) => `${entry.t} [${entry.kind}] ${entry.text}`).join('\n'))
}

async function restartServer() {
  pushLog('sys', '[dsh-desktop] restart requested; stopping current server')
  const child = serverProc
  serverProc = null
  serverUrl = null
  await killTree(child && child.pid)
  startServer()
}

// --- scenario onboarding ---
//
// The wizard persists two files under <userData>/scenarios:
//   state.json - { id }, where id is a scenario id or 'default' (no overlay)
//   active.yml - the generated cordis.patch.yml overlay for the scenario
// A fresh install has no state file, so the first run shows the wizard and
// the server is not started until a scenario is picked.

function scenariosDir() {
  return path.join(app.getPath('userData'), 'scenarios')
}

function scenarioStatePath() {
  return path.join(scenariosDir(), 'state.json')
}

function activePatchPath() {
  return path.join(scenariosDir(), 'active.yml')
}

function loadScenarioState() {
  try {
    return JSON.parse(fs.readFileSync(scenarioStatePath(), 'utf8'))
  } catch {
    return null
  }
}

function saveScenarioState(state) {
  fs.mkdirSync(scenariosDir(), { recursive: true })
  fs.writeFileSync(scenarioStatePath(), JSON.stringify(state, null, 2) + '\n', 'utf8')
}

// --- DeepSeek credentials ---
//
// dsh reads API keys from $HOME/.dsh/.credentials.yaml — the same store the
// Harness Models page writes. The first-run wizard lets users configure the
// key here so a fresh install never ships a test key; external edits are
// hot-reloaded by a running dsh process.

function dshCredentialsPath() {
  return path.join(os.homedir(), '.dsh', '.credentials.yaml')
}

function readDeepSeekApiKey() {
  try {
    const text = fs.readFileSync(dshCredentialsPath(), 'utf8')
    const match = text.match(/^\s*DEEPSEEK_API_KEY\s*:\s*(.+?)\s*$/m)
    if (!match) return null
    return String(match[1]).trim().replace(/^['"]|['"]$/g, '')
  } catch {
    return null
  }
}

function maskApiKey(key) {
  if (!key) return ''
  return key.length > 10 ? key.slice(0, 5) + '…' + key.slice(-4) : '***'
}

function writeDeepSeekApiKey(apiKey) {
  const file = dshCredentialsPath()
  const dir = path.dirname(file)
  fs.mkdirSync(dir, { recursive: true })
  const line = 'DEEPSEEK_API_KEY: ' + apiKey + '\n'
  let existing = ''
  try { existing = fs.readFileSync(file, 'utf8') } catch { /* new file */ }
  const next = existing.includes('DEEPSEEK_API_KEY')
    ? existing.replace(/^\s*DEEPSEEK_API_KEY\s*:.*$/m, line.trimEnd())
    : existing.trimEnd() + (existing.trimEnd() ? '\n\n' : '') + line
  const tmp = file + '.tmp-' + process.pid
  fs.writeFileSync(tmp, next, { encoding: 'utf8', mode: 0o600 })
  fs.renameSync(tmp, file)
}

/** Patch overlay for the current scenario, or null when none is active. */
function activeScenarioPatch() {
  const state = loadScenarioState()
  if (!state || !state.id || state.id === 'default') return null
  const file = activePatchPath()
  return fs.existsSync(file) ? file : null
}

function scenarioTitle() {
  const state = loadScenarioState()
  if (!state) return null
  if (state.id === 'default') return t('debug.defaultScenario')
  const scenario = SCENARIOS.find((entry) => entry.id === state.id)
  return scenario ? (appearance.lang === 'en' ? scenario.labelEn : scenario.label) : state.id
}

function writeScenarioPatch(id) {
  const scenario = SCENARIOS.find((entry) => entry.id === id)
  if (!scenario) throw new Error(`unknown scenario: ${id}`)
  const indexPath = path.join(app.getPath('userData'), 'search-index.sqlite')
  const yaml = scenario.build({ indexPath })
  fs.mkdirSync(scenariosDir(), { recursive: true })
  fs.writeFileSync(activePatchPath(), yaml + '\n', 'utf8')
}

function refreshMenus() {
  buildMenu()
  if (tray) tray.setContextMenu(buildTrayMenu())
}

/** Switch the shell UI language; menus/tray rebuild and pages refresh via broadcast. */
function setLanguage(id) {
  if (!LANGUAGES.some((lang) => lang.id === id) || appearance.lang === id) return
  saveAppearance({ lang: id })
}

function applyScenarioTitle() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.setTitle('Deepseek Harness +')
}

/** Absolute path of the locally installed dsh CLI bin, or null. */
function localDshBin() {
  const candidate = path.join(__dirname, '..', 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
  return fs.existsSync(candidate) ? candidate : null
}

function patchArgs(patchPath) {
  return patchPath ? ['--patch', patchPath] : []
}

/**
 * Insert `--patch <path>` right after the launcher's `web` alias (or the
 * `--profile <name>` pair). The rc.8 launcher uses passThroughOptions, so a
 * --patch placed after the first unknown option would be swallowed into the
 * web app's own argv and ignored.
 */
function insertPatchIntoArgs(args, patchPath) {
  if (!patchPath) return args
  const webIndex = args.indexOf('web')
  if (webIndex !== -1) {
    return [...args.slice(0, webIndex + 1), '--patch', patchPath, ...args.slice(webIndex + 1)]
  }
  const profileIndex = args.indexOf('--profile')
  if (profileIndex !== -1 && args[profileIndex + 1]) {
    return [...args.slice(0, profileIndex + 2), '--patch', patchPath, ...args.slice(profileIndex + 2)]
  }
  return [...args, '--patch', patchPath]
}

/**
 * Resolve the dsh launch command.
 * DSH_COMMAND overrides everything (a full command line, split on whitespace).
 * The default runs the locally installed CLI; npx is the fallback when the
 * dependency is missing.
 */
function resolveLaunch() {
  const override = process.env.DSH_COMMAND
  const patch = activeScenarioPatch()
  if (override && override.trim()) {
    const parts = override.trim().split(/\s+/)
    return { command: parts[0], args: insertPatchIntoArgs(parts.slice(1), patch) }
  }
  const binPath = localDshBin()
  if (binPath) {
    // ELECTRON_RUN_AS_NODE makes the bundled Electron executable act as a
    // plain Node process, so the harness runs on the Electron-bundled Node
    // with no external Node or GUI dependency. --expose-internals must come
    // first: the dsh base composition mounts cordis-plugin-hmr, which refuses
    // to start without it. --require then suppresses the console window
    // Windows would otherwise create for every process the harness spawns.
    return {
      command: process.execPath,
      args: ['--expose-internals', '--require', NO_CONSOLE_WINDOW, binPath, 'web', ...patchArgs(patch), '--no-open', '--port', '0'],
      envExtra: { ELECTRON_RUN_AS_NODE: '1' },
    }
  }
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'
  return {
    command: npx,
    args: ['--yes', '@deepseek-ai/dsh', 'web', ...patchArgs(patch), '--no-open', '--port', '0'],
    warning: 'Local dsh dependency missing; falling back to npx (first launch downloads the runtime).',
  }
}

/** Kill the dsh process tree and resolve when it is gone. */
function killTree(pid) {
  return new Promise((resolve) => {
    if (!pid) return resolve()
    if (process.platform === 'win32') {
      try {
        spawnSync(TASKKILL, ['/pid', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore', timeout: 5000 })
      } catch { /* already gone */ }
      return resolve()
    }
    try { process.kill(-pid, 'SIGTERM') } catch { /* already gone */ }
    setTimeout(() => {
      try { process.kill(-pid, 'SIGKILL') } catch { /* already gone */ }
      resolve()
    }, 1500)
  })
}

function showError(message) {
  if (SMOKE_TEST) return finishSmoke(false, message)
  pushLog('err', `[dsh-desktop] error: ${message}`)
  if (mainWindow && !mainWindow.isDestroyed()) {
    currentPage = 'error'
    mainWindow.loadFile(path.join(__dirname, 'error.html'), { query: { message } })
  }
}

function onServerReady() {
  if (SMOKE_TEST) {
    return verifyServer()
  }
  pushLog('sys', `[dsh-desktop] server ready: ${serverUrl}`)
  serverCrashCount = 0
  if (mainWindow && !mainWindow.isDestroyed()) {
    // Stay put when the user is reading logs or tweaking appearance; those
    // pages surface the ready state themselves.
    if (currentPage === 'debug' || currentPage === 'appearance' || currentPage === 'about' || currentPage === 'thirdparty') return
    mainWindow.loadURL(serverUrl)
    currentPage = 'web'
    if (WINDOW_TEST) watchWindowTest()
  }
}

// --- page navigation ---

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  if (!mainWindow.isVisible()) mainWindow.show()
  mainWindow.focus()
}

function openApp() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (serverUrl) {
    mainWindow.loadURL(serverUrl)
    currentPage = 'web'
  } else {
    mainWindow.loadFile(path.join(__dirname, 'loading.html'))
    currentPage = 'loading'
  }
}

function openDebug() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.loadFile(path.join(__dirname, 'debug.html'))
  currentPage = 'debug'
}

function openAppearance() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.loadFile(path.join(__dirname, 'appearance.html'))
  currentPage = 'appearance'
}

function openAbout() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.loadFile(path.join(__dirname, 'about.html'))
  currentPage = 'about'
}

function openThirdParty() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.loadFile(path.join(__dirname, 'thirdparty.html'))
  currentPage = 'thirdparty'
}

function buildMenu() {
  const template = [
    {
      label: t('menu.app'),
      submenu: [
        { label: t('menu.app.back'), accelerator: 'CmdOrCtrl+Shift+A', click: () => openApp() },
        { type: 'separator' },
        { label: t('menu.reload'), accelerator: 'CmdOrCtrl+R', click: () => { if (mainWindow) mainWindow.webContents.reload() } },
        { type: 'separator' },
        { role: 'quit', label: t('menu.quit') },
      ],
    },
    {
      label: t('menu.edit'),
      submenu: [
        { role: 'undo', label: t('menu.undo') },
        { role: 'redo', label: t('menu.redo') },
        { type: 'separator' },
        { role: 'cut', label: t('menu.cut') },
        { role: 'copy', label: t('menu.copy') },
        { role: 'paste', label: t('menu.paste') },
        { role: 'selectAll', label: t('menu.selectAll') },
      ],
    },
    {
      label: t('menu.view'),
      submenu: [
        { label: t('menu.debug'), accelerator: 'CmdOrCtrl+Shift+D', click: () => openDebug() },
        { label: t('menu.appearance'), accelerator: 'CmdOrCtrl+,', click: () => openAppearance() },
        { type: 'separator' },
        { label: t('menu.restartServer'), accelerator: 'CmdOrCtrl+Shift+R', click: () => void restartServer() },
      ],
    },
    {
      label: t('menu.language'),
      submenu: LANGUAGES.map((lang) => ({
        label: lang.label,
        type: 'radio',
        checked: appearance.lang === lang.id,
        click: () => setLanguage(lang.id),
      })),
    },
    {
      label: t('menu.about'),
      submenu: [
        { label: t('menu.about.about'), click: () => { showMainWindow(); openAbout() } },
        { label: t('menu.about.thirdParty'), click: () => { showMainWindow(); openThirdParty() } },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
// --- system tray ---
//
// The tray keeps the app reachable after the window is closed (closing hides
// to tray; quitting happens via the 退出 menu item or the tray menu). DevTools
// is deliberately not exposed in any menu.

function buildTrayMenu() {
  return Menu.buildFromTemplate([
    { label: t('tray.openApp'), click: () => { showMainWindow(); openApp() } },
    { label: t('menu.debug'), click: () => { showMainWindow(); openDebug() } },
    { label: t('menu.appearance'), click: () => { showMainWindow(); openAppearance() } },
    { type: 'separator' },
    { label: t('menu.restartServer'), click: () => void restartServer() },
    { type: 'separator' },
    {
      label: t('menu.language'),
      submenu: LANGUAGES.map((lang) => ({
        label: lang.label,
        type: 'radio',
        checked: appearance.lang === lang.id,
        click: () => setLanguage(lang.id),
      })),
    },
    {
      label: t('menu.about'),
      submenu: [
        { label: t('menu.about.about'), click: () => { showMainWindow(); openAbout() } },
        { label: t('menu.about.thirdParty'), click: () => { showMainWindow(); openThirdParty() } },
      ],
    },
    { type: 'separator' },
    { label: t('menu.quit'), click: () => app.quit() },
  ])
}
function createTray() {
  if (SMOKE_TEST || WINDOW_TEST) return
  let icon = nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'tray.png'))
  if (icon.isEmpty()) return
  if (process.platform === 'win32') icon = icon.resize({ width: 16, height: 16 })
  tray = new Tray(icon)
  tray.setToolTip('DeepSeek Harness')
  tray.setContextMenu(buildTrayMenu())
  tray.on('click', () => {
    showMainWindow()
    openApp()
  })
}

/** Window test: verify the window actually loads the served UI, then exit. */
function watchWindowTest() {
  const contents = mainWindow.webContents
  console.log(`window-test: navigating to ${serverUrl}`)
  for (const event of ['did-start-loading', 'did-stop-loading', 'dom-ready', 'did-navigate']) {
    contents.on(event, () => { console.log(`window-test: ${event} -> ${contents.getURL()}`) })
  }
  contents.on('render-process-gone', (_event, details) => finish(false, `renderer gone: ${details.reason}`))
  contents.on('console-message', (event) => { console.log(`window-test: renderer console: ${event.message}`) })
  const finish = (ok, message) => {
    if (windowTestDone) return
    windowTestDone = true
    console.log(`${ok ? 'window ok' : 'window FAILED'}: ${message}`)
    quitting = true
    const child = serverProc
    serverProc = null
    console.log(`window-test: killing dsh (pid ${String(child && child.pid)})`)
    void killTree(child && child.pid).finally(() => quitApp(ok ? 0 : 1))
  }
  contents.once('did-finish-load', () => {
    const url = contents.getURL()
    // The launch token buys the session cookie and redirects to the clean
    // origin root, so the loaded URL is never the announced token URL.
    const root = serverUrl === null ? null : new URL(serverUrl).origin + '/'
    finish(root !== null && url === root, `loaded ${url}`)
  })
  contents.once('did-fail-load', (_event, code, description, url) => {
    finish(false, `did-fail-load ${String(code)} ${description} ${url}`)
  })
  setTimeout(() => finish(false, 'window load timed out'), STALL_TIMEOUT_MS)
}

/** Read one probe response to completion and hand its byte count to the caller. */
function readProbeBody(response, done) {
  let bytes = 0
  response.on('data', (chunk) => { bytes += chunk.length })
  response.on('end', () => { done(bytes) })
}

/**
 * Smoke test: run the launch-token handshake (`/?token=` answers 303 with the
 * session cookie), then GET the application root the way the window does and
 * report HTTP 200 + a non-empty body.
 */
function verifyServer(attempt = 1) {
  const request = http.get(serverUrl, { timeout: STALL_TIMEOUT_MS }, (response) => {
    const location = response.headers.location
    const setCookie = response.headers['set-cookie']
    if (response.statusCode !== 303 || location === undefined || setCookie === undefined) {
      readProbeBody(response, (bytes) => {
        finishSmoke(false, `GET ${serverUrl} -> ${String(response.statusCode)}, ${bytes} bytes (expected 303 + launch cookie)`)
      })
      return
    }
    response.resume()
    verifyAuthenticatedRoot(new URL(location, serverUrl), setCookie[0].split(';')[0], attempt)
  })
  request.on('timeout', () => { request.destroy(new Error('GET timed out')) })
  request.on('error', (error) => { retryProbe(attempt, `GET ${serverUrl} failed: ${error.message}`) })
}

/** GET the cookie-authenticated application root; a non-empty 200 is the pass condition. */
function verifyAuthenticatedRoot(target, cookie, attempt) {
  const request = http.get(target, { timeout: STALL_TIMEOUT_MS, headers: { cookie } }, (response) => {
    readProbeBody(response, (bytes) => {
      const ok = response.statusCode === 200 && bytes > 0
      finishSmoke(ok, `GET ${target.href} (launch cookie) -> ${String(response.statusCode)}, ${bytes} bytes`)
    })
  })
  request.on('timeout', () => { request.destroy(new Error('GET timed out')) })
  request.on('error', (error) => { retryProbe(attempt, `GET ${target.href} failed: ${error.message}`) })
}

/** Retry the whole probe briefly: the announced URL can still race server readiness on loopback. */
function retryProbe(attempt, message) {
  if (attempt < 6) setTimeout(() => verifyServer(attempt + 1), 500)
  else finishSmoke(false, message)
}

/** Best-effort kill of this process's direct children and their trees. */
function killDescendants(pid) {
  try {
    const output = execFileSync('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-Command',
      `Get-CimInstance Win32_Process -Filter 'ParentProcessId=${pid}' | Select-Object -ExpandProperty ProcessId`,
    ], { encoding: 'utf8', timeout: 5000, windowsHide: true })
    for (const line of output.split(/\r?\n/)) {
      const childPid = Number(line.trim())
      if (Number.isInteger(childPid) && childPid > 0) {
        try {
          spawnSync(TASKKILL, ['/pid', String(childPid), '/T', '/F'], { windowsHide: true, stdio: 'ignore', timeout: 5000 })
        } catch { /* already gone */ }
      }
    }
  } catch { /* enumeration failed; best effort */ }
}

function cleanupTestUserData() {
  if (!TEST_USER_DATA) return
  // The main process still holds browser-storage handles until it exits, so
  // the delete runs in a detached helper that waits for this process to die.
  try { app.releaseSingleInstanceLock() } catch { /* best effort */ }
  try {
    const helper = path.join(__dirname, '..', 'test', 'rm-test-userdata.js')
    const child = spawn(process.execPath, [helper, TEST_USER_DATA], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    })
    child.unref()
  } catch { /* best effort */ }
}

function quitApp(code) {
  process.exitCode = code
  // destroy() (not close()) skips any beforeunload the loaded UI registers.
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.destroy()
  if (WINDOW_TEST || SMOKE_TEST) {
    // Hard exit for test modes: app.quit() can block the event loop once the
    // real UI is loaded, and app.exit() has been observed to wedge here.
    // Killing descendants first stops orphaned renderer/GPU processes from
    // holding inherited stdio pipes (which wedges the invoking npx wrapper),
    // and releases their handles on the isolated userData dir.
    killDescendants(process.pid)
    cleanupTestUserData()
    process.exit(code)
  }
  app.quit()
  // Belt-and-braces: if shutdown wedges (observed with the real UI loaded on
  // Windows), force a hard exit so the shell never lingers.
  setTimeout(() => {
    killDescendants(process.pid)
    process.exit(code)
  }, 5000).unref()
}

function finishSmoke(ok, detail) {
  if (smokeDone) return
  smokeDone = true
  console.log(`${ok ? 'smoke ok' : 'smoke FAILED'}: ${detail}`)
  quitting = true
  const child = serverProc
  serverProc = null
  void killTree(child && child.pid).then(() => quitApp(ok ? 0 : 1))
}

function startServer() {
  if (serverProc) return
  const launch = resolveLaunch()
  if (launch.warning) console.warn(`[dsh-desktop] ${launch.warning}`)
  if (WINDOW_TEST) console.log(`window-test: spawning ${launch.command} ${launch.args.join(' ')}`)
  pushLog('sys', `[dsh-desktop] spawning: ${launch.command} ${launch.args.join(' ')}`)
  serverStartedAt = new Date().toISOString()
  const child = spawn(launch.command, launch.args, {
    cwd: process.env.DSH_DESKTOP_CWD || process.cwd(),
    env: { ...process.env, ...(launch.envExtra ?? {}) },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    detached: process.platform !== 'win32',
  })
  serverProc = child

  let stdout = ''
  let stderrTail = ''
  const announced = () => serverUrl !== null

  child.stdout.on('data', (chunk) => {
    if (WINDOW_TEST) console.log(`window-test: stdout: ${String(chunk).trim().slice(0, 200)}`)
    pushLog('out', chunk.toString())
    stdout = (stdout + chunk).slice(-STDOUT_BUFFER_MAX)
    const lines = stdout.split(/\r?\n/)
    stdout = lines.pop() // keep the possibly-partial tail
    for (const line of lines) {
      const match = line.match(URL_LINE_RE)
      if (match && !announced()) {
        serverUrl = match[1]
        onServerReady()
        return
      }
    }
  })

  child.stderr.on('data', (chunk) => {
    pushLog('err', chunk.toString())
    stderrTail = (stderrTail + chunk).slice(-4000)
  })

  child.on('error', (error) => {
    pushLog('err', `spawn error: ${error.message}`)
    showError(`Failed to spawn "${launch.command}": ${error.message}`)
  })

  child.on('exit', (code, signal) => {
    pushLog('err', `dsh web exited (code ${String(code ?? signal)})`)
    clearTimeout(stallTimer)
    if (quitting) return
    if (child !== serverProc) return // superseded by a restart
    const tail = stderrTail.trim() || 'no stderr output'
    // Auto-restart on unexpected exits (max N within a window), except in the
    // isolated test modes where determinism matters more than recovery.
    if (!WINDOW_TEST && !SMOKE_TEST) {
      const now = Date.now()
      if (now - lastServerCrashAt > SERVER_CRASH_WINDOW_MS) serverCrashCount = 0
      lastServerCrashAt = now
      serverCrashCount++
      if (serverCrashCount <= SERVER_AUTO_RESTART_MAX) {
        pushLog('err', `[dsh-desktop] server exited unexpectedly; auto-restarting (${serverCrashCount}/${SERVER_AUTO_RESTART_MAX})`)
        serverProc = null
        serverUrl = null
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.loadFile(path.join(__dirname, 'loading.html'))
          currentPage = 'loading'
        }
        setTimeout(() => startServer(), Math.min(1500 * serverCrashCount, 6000))
        return
      }
    }
    if (!announced()) {
      showError(`dsh web exited before announcing a URL (code ${String(code ?? signal)}).\n\nstderr tail:\n${tail}`)
    } else {
      showError(`dsh web exited unexpectedly (code ${String(code ?? signal)}).\n\nstderr tail:\n${tail}`)
    }
  })

  const stallTimer = setTimeout(() => {
    if (announced() || quitting) return
    const tail = stderrTail.trim() || 'no stderr output'
    showError(`dsh web did not announce a URL within ${Math.round(START_TIMEOUT_MS / 1000)}s.\n\nstderr tail:\n${tail}`)
    void killTree(child.pid)
  }, START_TIMEOUT_MS)
  stallTimer.unref()
}

function createWindow() {
  const dark = resolveTheme(appearance) === 'dark'
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    show: false,
    title: 'DeepSeek Harness',
    backgroundColor: dark ? '#0f1115' : '#f5f6f8',
    // Brand logo as the window icon (title bar + taskbar); the frame stays
    // native so the OS renders the title bar, caption buttons, and menu bar.
    icon: nativeImage.createFromPath(LOGO_PATH),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  mainWindow.once('ready-to-show', () => { if (!WINDOW_TEST) mainWindow.show() })
  // Lock the native title bar to the brand regardless of each page's <title>.
  mainWindow.on('page-title-updated', (event) => {
    event.preventDefault()
    mainWindow.setTitle('Deepseek Harness +')
  })
  // Closing hides to tray instead of quitting; 退出 via menu/tray quits for real.
  mainWindow.on('close', (event) => {
    if (quitting) return
    event.preventDefault()
    mainWindow.hide()
  })
  // First run (no scenario state) shows the wizard and waits for a pick;
  // otherwise show the loading page while the server boots.
  const showWizard = !WINDOW_TEST && !loadScenarioState()
  currentPage = showWizard ? 'wizard' : 'loading'
  mainWindow.loadFile(path.join(__dirname, showWizard ? 'wizard.html' : 'loading.html'))
  applyScenarioTitle()

  mainWindow.webContents.on('dom-ready', () => applyAppearance())

  // Self-heal a crashed renderer: reload up to N times within a window, then
  // give up with the error page. Test modes keep the old deterministic paths.
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    if (quitting || WINDOW_TEST || SMOKE_TEST) return
    const now = Date.now()
    if (now - lastRendererCrashAt > RENDERER_CRASH_WINDOW_MS) rendererCrashCount = 0
    lastRendererCrashAt = now
    rendererCrashCount++
    pushLog('err', `[dsh-desktop] renderer crashed (${details.reason}); auto-reload (${rendererCrashCount}/${RENDERER_CRASH_MAX})`)
    if (rendererCrashCount > RENDERER_CRASH_MAX) {
      showError(`renderer crashed repeatedly (${details.reason}); please restart the app.`)
      return
    }
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed() && !quitting) mainWindow.webContents.reload()
    }, 1200)
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (serverUrl && url.startsWith(serverUrl)) return
    event.preventDefault()
    if (/^https?:/.test(url)) shell.openExternal(url)
  })
  mainWindow.on('closed', () => { mainWindow = null })
}

/** Wizard actions; both persist state, switch to the loading page, and boot. */
function selectScenario(id) {
  if (WINDOW_TEST || SMOKE_TEST) throw new Error('场景选择在测试模式下不可用')
  writeScenarioPatch(id)
  saveScenarioState({ id })
  pushLog('sys', `[dsh-desktop] scenario selected: ${id}`)
  runAfterScenarioPick()
}

function skipWizard() {
  if (WINDOW_TEST || SMOKE_TEST) throw new Error('场景选择在测试模式下不可用')
  saveScenarioState({ id: 'default' })
  pushLog('sys', '[dsh-desktop] scenario skipped (default configuration)')
  runAfterScenarioPick()
}

function runAfterScenarioPick() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    applyScenarioTitle()
    mainWindow.loadFile(path.join(__dirname, 'loading.html'))
    currentPage = 'loading'
  }
  startServer()
}

// --- app lifecycle ---

if (!SMOKE_TEST && !app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) showMainWindow()
  })

  ipcMain.on('desktop-quit', () => app.quit())
  ipcMain.handle('get-scenarios', () =>
    SCENARIOS.map(({ id, label, labelEn, description, descriptionEn, features, featuresEn }) => ({
      id,
      label,
      labelEn,
      description,
      descriptionEn,
      features,
      featuresEn,
      recommended: id === 'standard',
    }))
  )
  ipcMain.handle('select-scenario', (_event, id) => {
    try {
      selectScenario(id)
      return { ok: true }
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })
  ipcMain.handle('skip-wizard', () => {
    try {
      skipWizard()
      return { ok: true }
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })
  ipcMain.handle('desktop-open-app', () => {
    openApp()
    return { ok: true }
  })
  ipcMain.handle('desktop-open-debug', () => {
    openDebug()
    return { ok: true }
  })
  ipcMain.handle('desktop-open-appearance', () => {
    openAppearance()
    return { ok: true }
  })
  ipcMain.handle('appearance:get', () => ({ ...appearance }))
  ipcMain.handle('appearance:set', (_event, patch) => {
    saveAppearance(patch)
    return { ...appearance }
  })
  ipcMain.handle('i18n:get', () => ({
    lang: appearance.lang,
    messages: MESSAGES[appearance.lang] || MESSAGES.zh,
  }))
  ipcMain.handle('thirdparty:get', () => ({ items: thirdPartyList() }))
  ipcMain.handle('app:info', () => ({
    version: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  }))
  ipcMain.handle('debug:get-state', () => debugState())
  ipcMain.handle('debug:clear', () => {
    clearDebugLog()
    return { ok: true }
  })
  ipcMain.handle('debug:copy', () => {
    copyDebugLog()
    return { ok: true }
  })
  ipcMain.handle('debug:restart', () => {
    void restartServer()
    return { ok: true }
  })

  ipcMain.handle('debug:open-log', () => {
    void shell.openPath(logFilePath())
    return { ok: true }
  })
  ipcMain.handle('credentials:get', () => {
    const key = readDeepSeekApiKey()
    return { configured: Boolean(key), masked: maskApiKey(key) }
  })
  ipcMain.handle('credentials:set', (_event, apiKey) => {
    const key = String(apiKey ?? '').trim()
    if (!/^sk-[A-Za-z0-9]{16,}$/.test(key)) {
      return { ok: false, error: t('err.apiKeyFormat') }
    }
    try {
      writeDeepSeekApiKey(key)
      pushLog('sys', '[dsh-desktop] DeepSeek API Key saved (value never logged)')
      return { ok: true }
    } catch (error) {
      return { ok: false, error: t('err.saveFailed') + error.message }
    }
  })

  app.whenReady().then(() => {
    nativeTheme.themeSource = appearance.theme
    buildMenu()
    createTray()
    pushLog('sys', `[dsh-desktop] dsh-desktop starting (electron ${process.versions.electron}, node ${process.versions.node})`)
    if (WINDOW_TEST) {
      // Exercise the same patch path a real first-run takes, in isolation.
      try {
        writeScenarioPatch('standard')
        saveScenarioState({ id: 'standard' })
      } catch (error) {
        console.error(`window-test: failed to prepare scenario: ${error.message}`)
        cleanupTestUserData()
        process.exit(1)
        return
      }
    }
    if (!SMOKE_TEST) createWindow()
    const wizardNeeded = !WINDOW_TEST && !SMOKE_TEST && !loadScenarioState()
    if (!wizardNeeded) startServer()
    if (WINDOW_TEST) {
      setTimeout(() => {
        console.log('window-test: watchdog fired, forcing exit')
        cleanupTestUserData()
        app.exit(2)
      }, 60_000)
    }
  })

  app.on('window-all-closed', () => {
    // With a tray the app keeps running after the last window closes; without
    // one (tests, failed tray init) fall back to quitting.
    if (!tray) app.quit()
  })

  app.on('activate', () => {
    if (SMOKE_TEST) return
    if (mainWindow === null) createWindow()
    else showMainWindow()
  })

  app.on('before-quit', (event) => {
    if (tray) {
      tray.destroy()
      tray = null
    }
    if (quitting) return
    if (serverProc && serverProc.exitCode === null) {
      // Kill the dsh tree first, then finish quitting.
      event.preventDefault()
      quitting = true
      const child = serverProc
      serverProc = null
      void killTree(child.pid).finally(() => quitApp(0))
      return
    }
    // No server to tear down: let the close proceed (close handler allows it
    // once quitting is set).
    quitting = true
  })
}