import * as autocannon from './engine/autocannon'
import { insertRun, updateRunDone, updateRunStatus } from './db'
import { validate } from '../shared/validation'
import type {
  TestDefinition,
  TimeSeriesSample,
  ResultEvent,
  TestResult
} from '../shared/types'

export type RunnerPush = (ev: { type: 'sample' | 'result'; data: unknown }) => void

const active = new Set<number>()
const stopped = new Set<number>()

export function startTest(
  def: TestDefinition,
  scenarioId: number | undefined,
  push: RunnerPush
): number {
  const verr = validate(def)
  if (!verr.ok) throw new Error(verr.errors.join('; '))
  const engineErrors = autocannon.validate(def)
  if (engineErrors.length) throw new Error(engineErrors.join('; '))

  const runId = insertRun({
    scenarioId,
    name: def.name,
    target: def.target.url,
    engine: def.engine,
    status: 'starting',
    startedAt: new Date().toISOString()
  })

  autocannon.start(def, runId, {
    onSample: (sample: TimeSeriesSample) =>
      push({ type: 'sample', data: { runId, sample } }),
    onDone: (err: Error | null, result: TestResult) => {
      active.delete(runId)
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
  autocannon.stop(runId)
}

export function isRunning(runId: number): boolean {
  return active.has(runId)
}

export function activeRunIds(): number[] {
  return [...active]
}