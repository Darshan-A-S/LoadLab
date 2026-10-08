import type { TestDefinition, Scenario, HistoryEntry, Collection, SampleEvent, ResultEvent, RunEvent, ImportResult } from '../shared/types'

export type { RunEvent, ImportResult }

declare global {
  interface Window {
    loadlab: {
      scenarios: {
        list: () => Promise<Scenario[]>
        save: (test: TestDefinition, collectionId: number | null) => Promise<{ id: number }>
        delete: (id: number) => Promise<void>
        updateTags: (id: number, tags: string[]) => Promise<void>
      }
      collections: {
        list: () => Promise<Collection[]>
        create: (name: string) => Promise<{ id: number }>
        rename: (id: number, name: string) => Promise<void>
        duplicate: (id: number) => Promise<{ id: number }>
        delete: (id: number) => Promise<void>
        export: (id: number) => Promise<string | null>
        import: () => Promise<ImportResult | null>
        replace: (id: number, name: string, configs: TestDefinition[]) => Promise<{ id: number; name: string; imported: number }>
        createImported: (name: string, configs: TestDefinition[]) => Promise<{ id: number; name: string; imported: number }>
        clearScenarios: (id: number) => Promise<void>
      }
      runs: {
        list: () => Promise<HistoryEntry[]>
        start: (test: TestDefinition) => Promise<number>
        stop: (runId: number) => Promise<void>
        active: () => Promise<number[]>
        export: (runId: number, format: 'json' | 'csv') => Promise<string | null>
        updateTags: (runId: number, tags: string[]) => Promise<void>
      }
      onRunEvent: (cb: (ev: RunEvent) => void) => () => void
      win: {
        minimize: () => void
        toggleMaximize: () => void
        close: () => void
        isMaximized: () => Promise<boolean>
        onMaximizedState: (cb: (maximized: boolean) => void) => () => void
        toggleDevTools: () => void
      }
    }
  }
}

export {}