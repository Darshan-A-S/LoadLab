import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { initDb, insertScenario, listScenarios, deleteScenario, listRuns } from './db'
import { startTest, stopTest, activeRunIds } from './runner'
import { renderJSON, renderCSV } from './export'
import type { TestDefinition } from '../shared/types'
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
      sandbox: false
    }
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
  win.on('maximize', () => send('win:maximize-state', true))
  win.on('unmaximize', () => send('win:maximize-state', false))
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

  ipcMain.handle('scenarios:list', () => listScenarios())
  ipcMain.handle('scenarios:save', (_e, test: TestDefinition) => ({
    id: insertScenario(test)
  }))
  ipcMain.handle('scenarios:delete', (_e, id: number) => {
    deleteScenario(id)
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

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})