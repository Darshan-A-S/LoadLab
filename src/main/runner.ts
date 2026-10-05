import * as autocannon from './engine/autocannon'
import * as loadtest from './engine/loadtest'
import * as artillery from './engine/artillery'
import * as oha from './engine/oha'
import * as bombardier from './engine/bombardier'
import { insertRun, updateRunDone, updateRunStatus } from './db'
import { validate } from '../shared/validation'
import type {
  TestDefinition,
  TimeSeriesSample,
  ResultEvent,
  TestResult,
  EngineType
} from '../shared/types'

export type RunnerPush = (ev: { type: 'sample' | 'result'; data: unknown }) => void

export interface EngineAdapter {
  validate(config: TestDefinition): string[]
  start(
    config: TestDefinition,
    runId: number,
    cb: {
      onSample: (sample: TimeSeriesSample) => void
      onDone: (err: Error | null, result: TestResult) => void
    }
  ): void
  stop(runId: number): void
  isRunning?(runId: number): boolean
}

const ENGINES: Record<EngineType, EngineAdapter> = {
  autocannon,
  loadtest,
  artillery,
  oha,
  bombardier
}

function getEngine(type: EngineType): EngineAdapter {
  const engine = ENGINES[type]
  if (!engine) throw new Error(`Unsupported engine: "${type}"`)
  return engine
}

const active = new Set<number>()
const stopped = new Set<number>()
const runEngines = new Map<number, EngineType>()

export function startTest(
  def: TestDefinition,
  scenarioId: number | undefined,
  push: RunnerPush
): number {
  const verr = validate(def)
  if (!verr.ok) throw new Error(verr.errors.join('; '))

  const engineType = def.engine || 'autocannon'
  const engine = getEngine(engineType)
  const engineErrors = engine.validate(def)
  if (engineErrors.length) throw new Error(engineErrors.join('; '))

  const runId = insertRun({
    scenarioId,
    name: def.name,
    target: def.target.url,
    engine: engineType,
    status: 'starting',
    startedAt: new Date().toISOString()
  })

  runEngines.set(runId, engineType)

  engine.start(def, runId, {
    onSample: (sample: TimeSeriesSample) =>
      push({ type: 'sample', data: { runId, sample } }),
    onDone: (err: Error | null, result: TestResult) => {
      active.delete(runId)
      runEngines.delete(runId)
      const wasStopped = stopped.delete(runId)
      if (err) {
        updateRunDone(runId, 'failed', null, err.message)
        push({ type: 'result', data: { runId, status: 'failed', error: err.message } satisfies ResultEvent })
        return
      }
      const status = wasStopped ? 'stopped' : 'completed'
      updateRunDone(runId, status, result)
      push({ type: 'result', data: { runId, status, result } satisfies ResultEvent })
    }
  })

  updateRunStatus(runId, 'running')
  active.add(runId)
  push({ type: 'result', data: { runId, status: 'running' } satisfies ResultEvent })
  return runId
}

export function stopTest(runId: number): void {
  if (!active.has(runId)) return
  stopped.add(runId)
  const engineType = runEngines.get(runId)
  if (engineType && ENGINES[engineType]) {
    ENGINES[engineType].stop(runId)
  } else {
    for (const eng of Object.values(ENGINES)) {
      eng.stop(runId)
    }
  }
}

export function isRunning(runId: number): boolean {
  return active.has(runId)
}

export function activeRunIds(): number[] {
  return [...active]
}