'use strict'

// Headless check of the onboarding wizard page: it must render one card per
// scenario, preselect the recommended one, and round-trip a selection through
// the preload bridge. Exits 0 on success, 1 on failure.
const { app, BrowserWindow, ipcMain } = require('electron')
const { spawn } = require('node:child_process')
const os = require('node:os')
const path = require('node:path')
const { SCENARIOS } = require('../src/scenarios.js')
const { MESSAGES } = require('../src/i18n.js')

app.setPath('userData', path.join(os.tmpdir(), `dsh-wizard-check-${process.pid}`))

ipcMain.handle('get-scenarios', () =>
  SCENARIOS.map(({ id, label, labelEn, description, descriptionEn, features, featuresEn }) => ({
    id, label, labelEn, description, descriptionEn, features, featuresEn,
    recommended: id === 'standard',
  }))
)
ipcMain.handle('i18n:get', () => ({ lang: 'zh', messages: MESSAGES.zh }))
ipcMain.handle('select-scenario', (_event, id) => ({ ok: true, id }))
ipcMain.handle('skip-wizard', () => ({ ok: true }))
let mockCredentialConfigured = false
ipcMain.handle('credentials:get', () => ({
  configured: mockCredentialConfigured,
  masked: mockCredentialConfigured ? 'sk-12…34' : null,
}))
ipcMain.handle('credentials:set', (_event, apiKey) => {
  const key = String(apiKey ?? '').trim()
  if (!/^sk-[A-Za-z0-9]{16,}$/.test(key)) return { ok: false, error: 'bad format' }
  mockCredentialConfigured = true
  return { ok: true }
})
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
  console.error(`wizard-check FAILED: ${message}`)
  cleanupTempUserData()
  app.exit(1)
}

app.whenReady().then(async () => {
  try {
    const win = new BrowserWindow({
      show: false,
      webPreferences: {
        preload: path.join(__dirname, '..', 'src', 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    })
    await win.loadFile(path.join(__dirname, '..', 'src', 'wizard.html'))

    const initial = await win.webContents.executeJavaScript(`(() => {
      const grid = document.getElementById('grid')
      const cards = grid.querySelectorAll('.card')
      const selected = document.querySelector('.card.selected')
      return {
        cards: cards.length,
        continueEnabled: !document.getElementById('continue').disabled,
        recommendedSelected: selected ? selected.getAttribute('data-id') : null,
      }
    })()`)
    if (initial.cards !== SCENARIOS.length) return fail(`expected ${SCENARIOS.length} cards, got ${initial.cards}`)
    if (!initial.continueEnabled) return fail('continue button not enabled for recommended card')
    if (initial.recommendedSelected !== 'standard') return fail(`recommended card not selected (${initial.recommendedSelected})`)
    console.log(`wizard-check: rendered ${initial.cards} cards, recommended selected`)

    const picked = await win.webContents.executeJavaScript(`(async () => {
      document.querySelectorAll('.card')[1].click()
      const result = await window.desktop.selectScenario('web-dev')
      return {
        selectedId: document.querySelector('.card.selected').getAttribute('data-id'),
        bridgeOk: result.ok && result.id === 'web-dev',
      }
    })()`)
    if (picked.selectedId !== 'web-dev') return fail(`selection did not move to web-dev (${picked.selectedId})`)
    if (!picked.bridgeOk) return fail('selectScenario bridge did not round-trip')
    console.log(`wizard-check: selection round-trip ok (${picked.selectedId})`)

    const keyInitial = await win.webContents.executeJavaScript(`(() => {
      return {
        status: document.getElementById('apiKeyStatus').textContent,
        rowVisible: document.getElementById('apiKeyRow').style.display !== 'none',
      }
    })()`)
    if (!keyInitial.rowVisible) return fail('api key input row should be visible when not configured')
    if (keyInitial.status.indexOf('尚未配置') === -1) return fail('api key status should read 尚未配置 (' + keyInitial.status + ')')

    const keySaved = await win.webContents.executeJavaScript(`(async () => {
      const input = document.getElementById('apiKeyInput')
      input.value = 'sk-abcdef0123456789abcdef0123456789'
      document.getElementById('saveKey').click()
      await new Promise(function (resolve) { setTimeout(resolve, 150) })
      return {
        status: document.getElementById('apiKeyStatus').textContent,
        rowVisible: document.getElementById('apiKeyRow').style.display !== 'none',
        err: document.getElementById('apiKeyErr').textContent,
      }
    })()`)
    if (keySaved.rowVisible) return fail('api key row should hide after saving (' + keySaved.status + ')')
    if (keySaved.status.indexOf('已配置') === -1) return fail('api key status should read 已配置 after save (' + keySaved.status + ')')
    console.log('wizard-check: api key onboarding ok')

    cleanupTempUserData()
    app.exit(0)
  } catch (error) {
    fail(error.message)
  }
})