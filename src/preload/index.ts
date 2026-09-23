import { contextBridge, ipcRenderer } from 'electron'
import type {
  TestDefinition,
  Scenario,
  HistoryEntry,
  Collection,
  SampleEvent,
  ResultEvent
} from '../shared/types'

export type RunEvent = { type: 'sample'; data: SampleEvent } | { type: 'result'; data: ResultEvent }

const loadlab = {
  scenarios: {
    list: (): Promise<Scenario[]> => ipcRenderer.invoke('scenarios:list'),
    save: (test: TestDefinition, collectionId: number | null): Promise<{ id: number }> =>
      ipcRenderer.invoke('scenarios:save', test, collectionId),
    delete: (id: number): Promise<void> => ipcRenderer.invoke('scenarios:delete', id)
  },
  collections: {
    list: (): Promise<Collection[]> => ipcRenderer.invoke('collections:list'),
    create: (name: string): Promise<{ id: number }> => ipcRenderer.invoke('collections:create', name),
    rename: (id: number, name: string): Promise<void> => ipcRenderer.invoke('collections:rename', id, name),
    duplicate: (id: number): Promise<{ id: number }> => ipcRenderer.invoke('collections:duplicate', id),
    delete: (id: number): Promise<void> => ipcRenderer.invoke('collections:delete', id)
  },
  runs: {
    list: (): Promise<HistoryEntry[]> => ipcRenderer.invoke('runs:list'),
    start: (test: TestDefinition): Promise<number> => ipcRenderer.invoke('runs:start', test),
    stop: (runId: number): Promise<void> => ipcRenderer.invoke('runs:stop', runId),
    active: (): Promise<number[]> => ipcRenderer.invoke('runs:active'),
    export: (runId: number, format: 'json' | 'csv'): Promise<string | null> =>
      ipcRenderer.invoke('runs:export', runId, format)
  },
  onRunEvent: (cb: (ev: RunEvent) => void): (() => void) => {
    const listener = (_e: unknown, ev: RunEvent): void => cb(ev)
    ipcRenderer.on('run:event', listener)
    return () => ipcRenderer.removeListener('run:event', listener)
  },
  win: {
    minimize: (): void => {
      void ipcRenderer.invoke('win:minimize')
    },
    toggleMaximize: (): void => {
      void ipcRenderer.invoke('win:toggle-maximize')
    },
    close: (): void => {
      void ipcRenderer.invoke('win:close')
    },
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke('win:is-maximized'),
    onMaximizedState: (cb: (maximized: boolean) => void): (() => void) => {
      const listener = (_e: unknown, max: boolean): void => cb(max)
      ipcRenderer.on('win:maximize-state', listener)
      return () => ipcRenderer.removeListener('win:maximize-state', listener)
    }
  }
}

contextBridge.exposeInMainWorld('loadlab', loadlab)