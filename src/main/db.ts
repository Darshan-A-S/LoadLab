import { DatabaseSync } from 'node:sqlite'
import { app } from 'electron'
import { join } from 'node:path'
import type { TestDefinition, TestResult, Scenario, HistoryEntry } from '../shared/types'

let db: DatabaseSync

export function initDb(): void {
  const file = join(app.getPath('userData'), 'loadlab.db')
  db = new DatabaseSync(file)
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS scenarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      config TEXT NOT NULL,
      created_at TEXT NOT NULL
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

export function insertScenario(test: TestDefinition): number {
  const now = new Date().toISOString()
  const res = db
    .prepare('INSERT INTO scenarios (name, config, created_at) VALUES (?, ?, ?)')
    .run(test.name, JSON.stringify(test), now)
  return Number(res.lastInsertRowid)
}

export function listScenarios(): Scenario[] {
  const rows = db.prepare('SELECT id, name, config, created_at FROM scenarios ORDER BY id DESC').all() as {
    id: number
    name: string
    config: string
    created_at: string
  }[]
  return rows.map((r) => ({ id: r.id, name: r.name, config: JSON.parse(r.config), createdAt: r.created_at }))
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