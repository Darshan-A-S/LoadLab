import { DatabaseSync } from 'node:sqlite'
import { app } from 'electron'
import { join } from 'node:path'
import type { TestDefinition, TestResult, Scenario, HistoryEntry, Collection } from '../shared/types'

let db: DatabaseSync

export function initDb(): void {
  const file = join(app.getPath('userData'), 'loadlab.db')
  db = new DatabaseSync(file)
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS scenarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      config TEXT NOT NULL,
      created_at TEXT NOT NULL,
      collection_id INTEGER
    );
    CREATE TABLE IF NOT EXISTS runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scenario_id INTEGER,
      name TEXT NOT NULL,
      target TEXT NOT NULL,
      engine TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      error TEXT,
      result TEXT,
      created_at TEXT NOT NULL
    )
  `)
  migrate()
}

function migrate(): void {
  const cols = db.prepare('PRAGMA table_info(scenarios)').all() as { name: string }[]
  if (!cols.some((c) => c.name === 'collection_id')) {
    db.exec('ALTER TABLE scenarios ADD COLUMN collection_id INTEGER')
  }
  const any = db.prepare('SELECT id FROM collections LIMIT 1').get()
  if (!any) {
    const id = createCollection('My Collection')
    db.prepare('UPDATE scenarios SET collection_id = ? WHERE collection_id IS NULL').run(id)
  }
}

function parseRow(row: Record<string, unknown>): HistoryEntry {
  return {
    runId: row.id as number,
    name: row.name as string,
    target: row.target as string,
    engine: row.engine as string,
    status: row.status as HistoryEntry['status'],
    startedAt: row.started_at as string,
    finishedAt: (row.finished_at as string | null) ?? null,
    result: row.result ? (JSON.parse(row.result as string) as TestResult) : null
  }
}

export function insertScenario(test: TestDefinition, collectionId: number | null): number {
  const now = new Date().toISOString()
  const res = db
    .prepare('INSERT INTO scenarios (name, config, created_at, collection_id) VALUES (?, ?, ?, ?)')
    .run(test.name, JSON.stringify(test), now, collectionId)
  return Number(res.lastInsertRowid)
}

export function listCollections(): Collection[] {
  const rows = db.prepare('SELECT id, name, created_at FROM collections ORDER BY name COLLATE NOCASE').all() as {
    id: number
    name: string
    created_at: string
  }[]
  return rows.map((r) => ({ id: r.id, name: r.name, createdAt: r.created_at }))
}

export function createCollection(name: string): number {
  const now = new Date().toISOString()
  const res = db.prepare('INSERT INTO collections (name, created_at) VALUES (?, ?)').run(name, now)
  return Number(res.lastInsertRowid)
}

export function renameCollection(id: number, name: string): void {
  db.prepare('UPDATE collections SET name = ? WHERE id = ?').run(name, id)
}

export function duplicateCollection(id: number): number {
  const now = new Date().toISOString()
  const res = db
    .prepare("INSERT INTO collections (name, created_at) SELECT name || ' Copy', ? FROM collections WHERE id = ?")
    .run(now, id)
  const newId = Number(res.lastInsertRowid)
  db.prepare(
    'INSERT INTO scenarios (name, config, created_at, collection_id) SELECT name, config, created_at, ? FROM scenarios WHERE collection_id = ?'
  ).run(newId, id)
  return newId
}

export function deleteCollection(id: number): void {
  db.prepare('UPDATE scenarios SET collection_id = NULL WHERE collection_id = ?').run(id)
  db.prepare('DELETE FROM collections WHERE id = ?').run(id)
}

export function listScenarios(): Scenario[] {
  const rows = db.prepare('SELECT id, name, config, created_at, collection_id FROM scenarios ORDER BY id DESC').all() as {
    id: number
    name: string
    config: string
    created_at: string
    collection_id: number | null
  }[]
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    config: JSON.parse(r.config),
    createdAt: r.created_at,
    collectionId: r.collection_id
  }))
}

export function deleteScenario(id: number): void {
  db.prepare('DELETE FROM scenarios WHERE id = ?').run(id)
}

export function insertRun(
  run: Omit<HistoryEntry, 'runId' | 'result' | 'finishedAt'> & { scenarioId?: number }
): number {
  const res = db
    .prepare(
      'INSERT INTO runs (scenario_id, name, target, engine, status, started_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .run(run.scenarioId ?? null, run.name, run.target, run.engine, run.status, run.startedAt, run.startedAt)
  return Number(res.lastInsertRowid)
}

export function listRuns(limit = 50): HistoryEntry[] {
  const rows = db
    .prepare(
      'SELECT id, name, target, engine, status, started_at, finished_at, result FROM runs ORDER BY id DESC LIMIT ?'
    )
    .all(limit) as Record<string, unknown>[]
  return rows.map(parseRow)
}

export function updateRunDone(
  runId: number,
  status: HistoryEntry['status'],
  result: TestResult | null,
  error?: string
): void {
  db.prepare('UPDATE runs SET status = ?, finished_at = ?, result = ?, error = ? WHERE id = ?').run(
    status,
    new Date().toISOString(),
    result ? JSON.stringify(result) : null,
    error ?? null,
    runId
  )
}

export function updateRunStatus(runId: number, status: HistoryEntry['status']): void {
  db.prepare('UPDATE runs SET status = ? WHERE id = ?').run(status, runId)
}