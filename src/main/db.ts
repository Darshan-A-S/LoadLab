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
      collection_id INTEGER,
      tags TEXT
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
      created_at TEXT NOT NULL,
      tags TEXT
    )
  `)
  migrate()
}

function migrate(): void {
  const scenCols = db.prepare('PRAGMA table_info(scenarios)').all() as { name: string }[]
  if (!scenCols.some((c) => c.name === 'collection_id')) {
    db.exec('ALTER TABLE scenarios ADD COLUMN collection_id INTEGER')
  }
  if (!scenCols.some((c) => c.name === 'tags')) {
    db.exec('ALTER TABLE scenarios ADD COLUMN tags TEXT')
  }
  const runCols = db.prepare('PRAGMA table_info(runs)').all() as { name: string }[]
  if (!runCols.some((c) => c.name === 'tags')) {
    db.exec('ALTER TABLE runs ADD COLUMN tags TEXT')
  }
  db.prepare('UPDATE scenarios SET collection_id = ? WHERE collection_id IS NULL').run(defaultCollectionId())
}

function parseRow(row: Record<string, unknown>): HistoryEntry {
  let tags: string[] = []
  if (typeof row.tags === 'string' && row.tags.trim()) {
    try {
      const parsed = JSON.parse(row.tags)
      if (Array.isArray(parsed) && parsed.length) tags = [String(parsed[0]).toLowerCase()]
    } catch {}
  }
  const result = row.result ? (JSON.parse(row.result as string) as TestResult) : null
  if (result) {
    result.tags = tags
  }
  return {
    runId: row.id as number,
    name: row.name as string,
    target: row.target as string,
    engine: row.engine as string,
    status: row.status as HistoryEntry['status'],
    startedAt: row.started_at as string,
    finishedAt: (row.finished_at as string | null) ?? null,
    result,
    tags
  }
}

function defaultCollectionId(): number {
  const row = db.prepare('SELECT id FROM collections ORDER BY id LIMIT 1').get() as { id: number } | undefined
  if (row) return row.id
  return createCollection('My Collection')
}

export function insertScenario(test: TestDefinition, collectionId: number | null): number {
  const now = new Date().toISOString()
  const single = test.tags && test.tags.length ? [test.tags[0].toLowerCase()] : []
  const tagsStr = single.length ? JSON.stringify(single) : null
  const cfg = { ...test, tags: single }
  const res = db
    .prepare('INSERT INTO scenarios (name, config, created_at, collection_id, tags) VALUES (?, ?, ?, ?, ?)')
    .run(test.name, JSON.stringify(cfg), now, collectionId ?? defaultCollectionId(), tagsStr)
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
    'INSERT INTO scenarios (name, config, created_at, collection_id, tags) SELECT name, config, created_at, ?, tags FROM scenarios WHERE collection_id = ?'
  ).run(newId, id)
  return newId
}

export function deleteCollection(id: number): void {
  db.prepare('DELETE FROM collections WHERE id = ?').run(id)
  db.prepare('UPDATE scenarios SET collection_id = ? WHERE collection_id = ?').run(defaultCollectionId(), id)
}

export function importCollection(name: string, configs: TestDefinition[]): number {
  const id = createCollection(name)
  for (const cfg of configs) insertScenario(cfg, id)
  return id
}

export function listScenarios(): Scenario[] {
  const rows = db.prepare('SELECT id, name, config, created_at, collection_id, tags FROM scenarios ORDER BY id DESC').all() as {
    id: number
    name: string
    config: string
    created_at: string
    collection_id: number | null
    tags?: string | null
  }[]
  return rows.map((r) => {
    let tags: string[] = []
    if (r.tags && r.tags.trim()) {
      try {
        const p = JSON.parse(r.tags)
        if (Array.isArray(p) && p.length) tags = [String(p[0]).toLowerCase()]
      } catch {}
    }
    const config = JSON.parse(r.config) as TestDefinition
    config.tags = tags
    return {
      id: r.id,
      name: r.name,
      config,
      createdAt: r.created_at,
      collectionId: r.collection_id,
      tags
    }
  })
}

export function deleteScenario(id: number): void {
  db.prepare('DELETE FROM scenarios WHERE id = ?').run(id)
}

export function updateScenarioTags(id: number, tags: string[]): void {
  const single = tags && tags.length ? [tags[0].toLowerCase()] : []
  const tagsStr = single.length ? JSON.stringify(single) : null
  db.prepare('UPDATE scenarios SET tags = ? WHERE id = ?').run(tagsStr, id)
  const row = db.prepare('SELECT config FROM scenarios WHERE id = ?').get(id) as { config: string } | undefined
  if (row) {
    try {
      const cfg = JSON.parse(row.config) as TestDefinition
      cfg.tags = single
      db.prepare('UPDATE scenarios SET config = ? WHERE id = ?').run(JSON.stringify(cfg), id)
    } catch {}
  }
}

export function insertRun(
  run: Omit<HistoryEntry, 'runId' | 'result' | 'finishedAt'> & { scenarioId?: number; tags?: string[] }
): number {
  const single = run.tags && run.tags.length ? [run.tags[0].toLowerCase()] : []
  const tagsStr = single.length ? JSON.stringify(single) : null
  const res = db
    .prepare(
      'INSERT INTO runs (scenario_id, name, target, engine, status, started_at, created_at, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .run(run.scenarioId ?? null, run.name, run.target, run.engine, run.status, run.startedAt, run.startedAt, tagsStr)
  return Number(res.lastInsertRowid)
}

export function listRuns(limit = 50): HistoryEntry[] {
  const rows = db
    .prepare(
      'SELECT id, name, target, engine, status, started_at, finished_at, result, tags FROM runs ORDER BY id DESC LIMIT ?'
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

export function updateRunTags(runId: number, tags: string[]): void {
  const single = tags && tags.length ? [tags[0].toLowerCase()] : []
  const tagsStr = single.length ? JSON.stringify(single) : null
  db.prepare('UPDATE runs SET tags = ? WHERE id = ?').run(tagsStr, runId)
  const row = db.prepare('SELECT result FROM runs WHERE id = ?').get(runId) as { result: string | null } | undefined
  if (row && row.result) {
    try {
      const res = JSON.parse(row.result) as TestResult
      res.tags = single
      db.prepare('UPDATE runs SET result = ? WHERE id = ?').run(JSON.stringify(res), runId)
    } catch {}
  }
}