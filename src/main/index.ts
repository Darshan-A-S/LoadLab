import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron'
import { writeFile, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { initDb, insertScenario, listScenarios, deleteScenario, updateScenarioTags, listRuns, updateRunTags, listCollections, createCollection, renameCollection, duplicateCollection, deleteCollection, importCollection, replaceCollection, clearCollectionScenarios } from './db'
import { startTest, stopTest, activeRunIds } from './runner'
import { renderJSON, renderCSV } from './export'
import { validate, getAvailableName } from '../shared/validation'
import type { TestDefinition, ImportResult } from '../shared/types'
import type { HistoryEntry } from '../shared/types'

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 900,
    minHeight: 600,
    title: 'LoadLab',
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      devTools: true
    }
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
  win.on('maximize', () => send('win:maximize-state', true))
  win.on('unmaximize', () => send('win:maximize-state', false))

  // Debugging shortcuts: F12 / Ctrl+Shift+I / Cmd+Option+I for DevTools, F5 / Ctrl+R for Reload
  win.webContents.on('before-input-event', (event, input) => {
    if (
      input.key === 'F12' ||
      ((input.control || input.meta) && input.shift && input.key.toLowerCase() === 'i')
    ) {
      win.webContents.toggleDevTools()
      event.preventDefault()
    }
    if (
      !app.isPackaged &&
      (input.key === 'F5' || ((input.control || input.meta) && input.key.toLowerCase() === 'r'))
    ) {
      win.webContents.reload()
      event.preventDefault()
    }
  })

  // Auto-open DevTools if requested
  if (
    !app.isPackaged &&
    (process.env.OPEN_DEVTOOLS === 'true' || process.argv.includes('--devtools'))
  ) {
    win.webContents.openDevTools({ mode: 'detach' })
  }

  return win
}

function send(event: string, data: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(event, data)
  }
}

const push = (ev: { type: 'sample' | 'result'; data: unknown }): void => {
  send('run:event', ev)
}


app.whenReady().then(() => {
  initDb()
  Menu.setApplicationMenu(null)

  ipcMain.handle('win:minimize', (e) => BrowserWindow.fromWebContents(e.sender)?.minimize())
  ipcMain.handle('win:toggle-maximize', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })
  ipcMain.handle('win:close', (e) => BrowserWindow.fromWebContents(e.sender)?.close())
  ipcMain.handle('win:is-maximized', (e) => BrowserWindow.fromWebContents(e.sender)?.isMaximized() ?? false)
  ipcMain.handle('win:toggle-devtools', (e) => {
    BrowserWindow.fromWebContents(e.sender)?.webContents.toggleDevTools()
  })

  ipcMain.handle('scenarios:list', () => listScenarios())
  ipcMain.handle('scenarios:save', (_e, test: TestDefinition, collectionId: number | null) => ({
    id: insertScenario(test, collectionId)
  }))
  ipcMain.handle('scenarios:delete', (_e, id: number) => {
    deleteScenario(id)
  })
  ipcMain.handle('scenarios:updateTags', (_e, id: number, tags: string[]) => {
    updateScenarioTags(id, tags)
  })
  ipcMain.handle('collections:list', () => listCollections())
  ipcMain.handle('collections:create', (_e, name: string) => ({
    id: createCollection(name)
  }))
  ipcMain.handle('collections:rename', (_e, id: number, name: string) => {
    renameCollection(id, name)
  })
  ipcMain.handle('collections:duplicate', (_e, id: number) => ({
    id: duplicateCollection(id)
  }))
  ipcMain.handle('collections:delete', (_e, id: number) => {
    deleteCollection(id)
  })
  ipcMain.handle('collections:export', async (e, id: number) => {
    const coll = listCollections().find((c) => c.id === id)
    if (!coll) throw new Error('Collection not found')
    const scenarios = listScenarios()
      .filter((s) => s.collectionId === id)
      .map((s) => s.config)
    const win = BrowserWindow.fromWebContents(e.sender) ?? BrowserWindow.getAllWindows()[0]
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      defaultPath: `${coll.name.replace(/[\\/:*?"<>|]/g, '_')}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (canceled || !filePath) return null
    await writeFile(filePath, JSON.stringify({ name: coll.name, scenarios }, null, 2), 'utf8')
    return filePath
  })
  ipcMain.handle('collections:import', async (e): Promise<ImportResult | null> => {
    const win = BrowserWindow.fromWebContents(e.sender) ?? BrowserWindow.getAllWindows()[0]
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (canceled || !filePaths[0]) return null
    let data: { name?: unknown; scenarios?: unknown }
    try {
      data = JSON.parse(await readFile(filePaths[0], 'utf8')) as { name?: unknown; scenarios?: unknown }
    } catch {
      throw new Error('File is not valid JSON')
    }
    if (!data || typeof data.name !== 'string' || !Array.isArray(data.scenarios)) {
      throw new Error('File is not a LoadLab collection export')
    }
    const name = data.name.trim() || 'Imported Collection'
    const skipped: string[] = []
    const configs: TestDefinition[] = []
    for (const entry of data.scenarios) {
      const t = entry as TestDefinition
      const res = validate(t)
      if (res.ok) configs.push(t)
      else skipped.push(typeof t?.name === 'string' ? t.name : '(unnamed)')
    }
    if (configs.length === 0 && data.scenarios.length > 0) {
      throw new Error(`No importable scenarios: ${skipped.join(', ')}`)
    }

    const existingCollections = listCollections()
    const importedCollections = existingCollections.filter((c) => Boolean(c.isImported))
    const existing = importedCollections.find(
      (c) => c.name.trim().toLowerCase() === name.toLowerCase()
    )

    if (existing) {
      const suggestedName = getAvailableName(
        name,
        importedCollections.map((c) => c.name)
      )
      return {
        status: 'collision',
        name,
        existingCollection: { id: existing.id, name: existing.name },
        suggestedName,
        configs,
        skipped
      }
    }

    const id = importCollection(name, configs)
    return { status: 'success', id, name, imported: configs.length, skipped }
  })
  ipcMain.handle('collections:clearScenarios', (_e, id: number) => {
    clearCollectionScenarios(id)
  })
  ipcMain.handle('collections:replace', (_e, id: number, name: string, configs: TestDefinition[]) => {
    replaceCollection(id, name, configs)
    return { id, name, imported: configs.length }
  })
  ipcMain.handle('collections:createImported', (_e, name: string, configs: TestDefinition[]) => {
    const id = importCollection(name, configs)
    return { id, name, imported: configs.length }
  })
  ipcMain.handle('runs:list', () => listRuns() as HistoryEntry[])
  ipcMain.handle('runs:start', (_e, test: TestDefinition) => startTest(test, undefined, push))
  ipcMain.handle('runs:stop', (_e, runId: number) => stopTest(runId))
  ipcMain.handle('runs:active', () => activeRunIds())
  ipcMain.handle('runs:export', async (_e, runId: number, format: 'json' | 'csv') => {
    const run = listRuns(500).find((r) => r.runId === runId)
    if (!run?.result) throw new Error('Run has no result to export')
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const ext = format === 'csv' ? 'csv' : 'json'
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      defaultPath: `loadlab-run-${runId}.${ext}`,
      filters: [{ name: format.toUpperCase(), extensions: [ext] }]
    })
    if (canceled || !filePath) return null
    await writeFile(filePath, format === 'csv' ? renderCSV(run.result) : renderJSON(run.result), 'utf8')
    return filePath
  })
  ipcMain.handle('runs:updateTags', (_e, runId: number, tags: string[]) => {
    updateRunTags(runId, tags)
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})