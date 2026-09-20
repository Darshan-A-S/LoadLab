import type { TestDefinition } from './types'

export interface ValidationResult {
  ok: boolean
  errors: string[]
}

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

export function validateUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

function isLocalHostname(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local')
  )
}

export function validate(test: TestDefinition): ValidationResult {
  const errors: string[] = []
  if (!test.name?.trim()) errors.push('Test name is required')
  if (!validateUrl(test.target.url)) errors.push('Target must be a valid http(s) URL')
  if (!METHODS.includes(test.target.method)) errors.push('Unsupported HTTP method')
  const l = test.load
  if (!Number.isInteger(l.connections) || l.connections < 1) errors.push('Connections must be >= 1')
  if (!Number.isInteger(l.durationSeconds) || l.durationSeconds < 1) errors.push('Duration must be >= 1 second')
  if (!Number.isInteger(l.pipelining) || l.pipelining < 1) errors.push('Pipelining must be >= 1')
  if (l.rate !== undefined && (l.rate < 1 || !Number.isFinite(l.rate))) errors.push('Rate must be >= 1 req/sec')
  return { ok: errors.length === 0, errors }
}

export interface SafetyWarnings {
  /** true when generating load against a non-local host */
  remoteTarget: boolean
  /** true when config is aggressive enough to warrant a warning */
  aggressive: boolean
}

export function safetyWarnings(test: TestDefinition): SafetyWarnings {
  let hostname = ''
  try {
    hostname = new URL(test.target.url).hostname
  } catch {
    return { remoteTarget: false, aggressive: false }
  }
  const l = test.load
  const aggressive = l.connections * l.durationSeconds > 20000
  return { remoteTarget: !isLocalHostname(hostname), aggressive }
}