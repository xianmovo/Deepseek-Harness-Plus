'use strict'

// Headless check of the debug, appearance, about, and third-party pages: they must render their
// controls and round-trip the IPC bridge. Exits 0 on success, 1 on failure.
const { app, BrowserWindow, clipboard, ipcMain } = require('electron')
const { spawn } = require('node:child_process')
const os = require('node:os')
const path = require('node:path')
const { MESSAGES } = require('../src/i18n.js')

app.setPath('userData', path.join(os.tmpdir(), `dsh-pages-check-${process.pid}`))

let appearance = { theme: 'dark', accent: 'blue', fontFamily: 'system', fontFamilyCode: 'mono', fontSize: 13, customCss: '', lang: 'zh' }
const appearanceSetCalls = []

ipcMain.handle('appearance:get', () => ({ ...appearance }))
ipcMain.handle('appearance:set', (_event, patch) => {
  appearance = { ...appearance, ...patch }
  appearanceSetCalls.push(patch)
  return { ...appearance }
})
ipcMain.handle('i18n:get', () => ({ lang: appearance.lang, messages: MESSAGES[appearance.lang] || MESSAGES.zh }))
ipcMain.handle('thirdparty:get', () => ({
  items: [
    { name: 'electron', version: '43.4.1', license: 'MIT', link: 'https://electronjs.org/', category: 'runtime', zh: '桌面运行时', en: 'desktop runtime' },
    { name: 'dsh-wallpaper-ui', version: '0.1.3', license: 'MIT', link: 'https://www.npmjs.com/package/dsh-wallpaper-ui', category: 'plugin', zh: '壁纸背景', en: 'wallpaper' },
  ],
}))
ipcMain.handle('app:info', () => ({ version: '0.1.0', electron: '43', chrome: '120', node: '22' }))
ipcMain.handle('debug:get-state', () => ({
  running: true,
  url: 'http://127.0.0.1:12345',
  pid: 4242,
  startedAt: '2026-01-01T00:00:00.000Z',
  scenario: '通用开发',
  patch: 'C:\\scenarios\\active.yml',
  count: 1,
  logTail: [{ t: '2026-01-01T00:00:00.000Z', kind: 'sys', text: 'hello from stub' }],
}))
ipcMain.handle('debug:clear', () => ({ ok: true }))
ipcMain.handle('debug:copy', () => { clipboard.writeText('copied'); return { ok: true } })
ipcMain.handle('debug:restart', () => ({ ok: true }))
ipcMain.handle('debug:open-log', () => ({ ok: true }))
ipcMain.handle('desktop-open-app', () => ({ ok: true }))
ipcMain.handle('desktop-open-debug', () => ({ ok: true }))
ipcMain.handle('desktop-open-appearance', () => ({ ok: true }))
ipcMain.on('desktop-quit', () => {})

function cleanupTempUserData() {
  try {
    const helper = path.join(__dirname, 'rm-test-userdata.js')
    const child = spawn(process.execPath, [helper, app.getPath('userData')], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    })
    child.unref()
  } catch { /* best effort */ }
}

function fail(message) {
  console.error(`pages-check FAILED: ${message}`)
  cleanupTempUserData()
  app.exit(1)
}

function tick(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'src', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  try {
    // --- debug page ---
    await win.loadFile(path.join(__dirname, '..', 'src', 'debug.html'))
    const state = await win.webContents.executeJavaScript(`(() => ({
      status: document.getElementById('status').textContent,
      meta: document.getElementById('meta').textContent,
      lineCount: document.querySelectorAll('#log .line').length,
      hasStub: document.getElementById('log').textContent.indexOf('hello from stub') !== -1,
      bridge: typeof window.desktop.getDebugState === 'function' && typeof window.desktop.onDebugLog === 'function',
      hasOpenLog: document.getElementById('open-log') !== null,
    }))()`)
    if (!state.bridge) return fail('debug bridge missing')
    if (!state.hasOpenLog) return fail('debug open-log button missing')
    if (state.status !== '运行中') return fail(`debug status: ${state.status}`)
    if (state.meta.indexOf('4242') === -1) return fail('debug meta missing pid')
    if (state.lineCount !== 1 || !state.hasStub) return fail('debug log tail not rendered')

    win.webContents.send('debug:log', { t: '2026-01-01T00:00:01.000Z', kind: 'err', text: 'boom line' })
    await tick(200)
    const liveAppended = await win.webContents.executeJavaScript(
      `document.getElementById('log').textContent.indexOf('boom line') !== -1`
    )
    if (!liveAppended) return fail('debug live log event not appended')

    await win.webContents.executeJavaScript(`document.getElementById('clear').click()`)
    await tick(200)
    const afterClear = await win.webContents.executeJavaScript(
      `document.getElementById('log').querySelectorAll('.line').length`
    )
    if (afterClear !== 0) return fail('debug clear did not empty the view')
    console.log('pages-check: debug page ok')

    // --- appearance page ---
    await win.loadFile(path.join(__dirname, '..', 'src', 'appearance.html'))
    await tick(300)
    const a = await win.webContents.executeJavaScript(`(() => ({
      theme: document.querySelector('.theme-option.selected').dataset.theme,
      swatches: document.querySelectorAll('#swatches .swatch').length,
      font: document.getElementById('font').value,
      codeFont: document.getElementById('font-code').value,
      size: document.getElementById('size-val').textContent,
      customColor: document.getElementById('accent-custom').value,
      hasCssBox: document.getElementById('custom-css') !== null && document.getElementById('save-css') !== null,
    }))()`)
    if (a.theme !== 'dark') return fail(`appearance theme: ${a.theme}`)
    if (a.swatches !== 4) return fail(`appearance swatches: ${a.swatches}`)
    if (a.font !== 'system') return fail(`appearance font: ${a.font}`)
    if (a.codeFont !== 'mono') return fail(`appearance code font: ${a.codeFont}`)
    if (a.size !== '13px') return fail(`appearance size: ${a.size}`)
    if (a.customColor !== '#4d7cfe') return fail(`appearance custom color: ${a.customColor}`)
    if (!a.hasCssBox) return fail('appearance custom css box missing')

    await win.webContents.executeJavaScript(
      `document.querySelector('.theme-option[data-theme="light"]').click()`
    )
    await tick(200)
    const picked = appearanceSetCalls[appearanceSetCalls.length - 1]
    if (!picked || picked.theme !== 'light') return fail('appearance theme click did not reach main')
    win.webContents.send('appearance:changed', { ...appearance })
    await tick(200)
    const reflected = await win.webContents.executeJavaScript(
      `document.querySelector('.theme-option.selected').dataset.theme`
    )
    if (reflected !== 'light') return fail(`appearance page did not reflect broadcast (${reflected})`)

    await win.webContents.executeJavaScript(`(() => {
      const sel = document.getElementById('font-code')
      sel.value = 'serif'
      sel.dispatchEvent(new Event('change'))
    })()`)
    await tick(200)
    const codePicked = appearanceSetCalls[appearanceSetCalls.length - 1]
    if (!codePicked || codePicked.fontFamilyCode !== 'serif') return fail('appearance code font change did not reach main')

    await win.webContents.executeJavaScript(`(() => {
      const c = document.getElementById('accent-custom')
      c.value = '#ff0000'
      c.dispatchEvent(new Event('input'))
    })()`)
    await tick(200)
    const accentPicked = appearanceSetCalls[appearanceSetCalls.length - 1]
    if (!accentPicked || accentPicked.accent !== '#ff0000') return fail('appearance custom accent did not reach main')

    await win.webContents.executeJavaScript(`(() => {
      const t = document.getElementById('custom-css')
      t.value = 'body { background: red; }'
      document.getElementById('save-css').click()
    })()`)
    await tick(200)
    const cssPicked = appearanceSetCalls[appearanceSetCalls.length - 1]
    if (!cssPicked || cssPicked.customCss !== 'body { background: red; }') return fail('appearance custom css did not reach main')

    console.log('pages-check: appearance page ok')

    // --- language switch ---
    const langState = await win.webContents.executeJavaScript(`(() => {
      const sel = document.getElementById('lang')
      return { exists: sel !== null, options: sel ? sel.options.length : 0, value: sel ? sel.value : '' }
    })()`)
    if (!langState.exists) return fail('language selector missing on appearance page')
    if (langState.options !== 2) return fail('language selector should offer 2 options')
    if (langState.value !== 'zh') return fail('language default should be zh')

    await win.webContents.executeJavaScript(`(() => {
      const sel = document.getElementById('lang')
      sel.value = 'en'
      sel.dispatchEvent(new Event('change'))
    })()`)
    await tick(200)
    const langPicked = appearanceSetCalls[appearanceSetCalls.length - 1]
    if (!langPicked || langPicked.lang !== 'en') return fail('language change did not reach main')

    win.webContents.send('appearance:changed', { ...appearance })
    await tick(300)
    const enState = await win.webContents.executeJavaScript(`(() => ({
      lang: document.getElementById('lang').value,
      h1: document.querySelector('h1').textContent,
    }))()`)
    if (enState.lang !== 'en') return fail('language select did not reflect broadcast')
    if (enState.h1 !== 'Appearance') return fail('appearance heading did not switch to English (' + enState.h1 + ')')
    console.log('pages-check: language switch ok')

    // --- about page ---
    await win.loadFile(path.join(__dirname, '..', 'src', 'about.html'))
    await tick(300)
    const ab = await win.webContents.executeJavaScript(`(() => ({
      h1: document.querySelector('h1').textContent,
      disclaimer: document.querySelector('.disclaimer').textContent,
      license: document.querySelector('.license-note').textContent,
      links: Array.from(document.querySelectorAll('.links a')).map(function (a) { return a.href }),
      authorLinks: Array.from(document.querySelectorAll('.author a')).map(function (a) { return a.href }),
      authorLabel: document.querySelector('.author-label') ? document.querySelector('.author-label').textContent : '',
      logoOk: (function () { var img = document.querySelector('.logo'); return img !== null && img.complete && img.naturalWidth > 0 })(),
      meta: document.getElementById('meta').textContent,
    }))()`)
    if (ab.h1 !== 'Deepseek Harness +') return fail('about heading: ' + ab.h1)
    // The language-switch test left the stub in English; the about page must follow it.
    if (ab.disclaimer.indexOf('not affiliated') === -1) return fail('about disclaimer (en): ' + ab.disclaimer)
    if (ab.license.indexOf('MIT License') === -1) return fail('about license note (en): ' + ab.license)
    if (ab.links.length !== 2 || ab.links[0].indexOf('github.com/deepseek-ai/deepseek-harness') === -1 || ab.links[1].indexOf('deepseek.com') === -1) {
      return fail('about links: ' + ab.links.join(','))
    }
    if (!ab.logoOk) return fail('about logo did not load')
    if (ab.meta.indexOf('v0.1.0') === -1) return fail('about version meta missing: ' + ab.meta)
    if (ab.authorLinks.length !== 2) return fail('about author links count: ' + ab.authorLinks.length)
    if (ab.authorLinks[0].indexOf('space.bilibili.com/1514544877') === -1) return fail('about author profile link missing: ' + ab.authorLinks[0])
    if (ab.authorLinks[1].indexOf('github.com/xianmovo/Deepseek-Harness-Plus') === -1) return fail('about author repo link missing: ' + ab.authorLinks[1])
    if (ab.authorLabel.indexOf('Author') === -1) return fail('about author label (en): ' + ab.authorLabel)
    console.log('pages-check: about page ok')

    // --- third-party page ---
    await win.loadFile(path.join(__dirname, '..', 'src', 'thirdparty.html'))
    await tick(300)
    const tp = await win.webContents.executeJavaScript(`(() => ({
      runtimeRows: document.querySelectorAll('#runtime-table tbody tr').length,
      pluginRows: document.querySelectorAll('#plugin-table tbody tr').length,
      hasLink: document.querySelector('#runtime-table a') !== null,
      heading: document.querySelector('h1').textContent,
    }))()`)
    if (tp.runtimeRows !== 1 || tp.pluginRows !== 1) return fail('thirdparty rows: ' + tp.runtimeRows + '/' + tp.pluginRows)
    if (!tp.hasLink) return fail('thirdparty link missing')
    if (tp.heading.indexOf('Third-Party') === -1) return fail('thirdparty heading (en): ' + tp.heading)
    console.log('pages-check: thirdparty page ok')

    cleanupTempUserData()
    app.exit(0)
  } catch (error) {
    fail(error.message)
  }
})