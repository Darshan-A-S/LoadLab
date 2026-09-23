import type { TestDefinition, Scenario, HistoryEntry, Collection, SampleEvent, ResultEvent } from '../shared/types'

export type RunEvent =
  | { type: 'sample'; data: SampleEvent }
  | { type: 'result'; data: ResultEvent }

declare global {
  interface Window {
    loadlab: {
      scenarios: {
        list: () => Promise<Scenario[]>
        save: (test: TestDefinition, collectionId: number | null) => Promise<{ id: number }>
        delete: (id: number) => Promise<void>
      }
      collections: {
        list: () => Promise<Collection[]>
        create: (name: string) => Promise<{ id: number }>
        rename: (id: number, name: string) => Promise<void>
        duplicate: (id: number) => Promise<{ id: number }>
        delete: (id: number) => Promise<void>
      }
      runs: {
        list: () => Promise<HistoryEntry[]>
        start: (test: TestDefinition) => Promise<number>
        stop: (runId: number) => Promise<void>
        active: () => Promise<number[]>
        export: (runId: number, format: 'json' | 'csv') => Promise<string | null>
      }
      onRunEvent: (cb: (ev: RunEvent) => void) => () => void
      win: {
        minimize: () => void
        toggleMaximize: () => void
        close: () => void
        isMaximized: () => Promise<boolean>
        onMaximizedState: (cb: (maximized: boolean) => void) => () => void
      }
    }
  }
}

export {}