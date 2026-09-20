export function fmtMs(ms: number): string {
  if (!Number.isFinite(ms)) return '—'
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`
}

export function fmtBytes(bytes: number): string {
  if (!Number.isFinite(bytes)) return '—'
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB/s`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB/s`
  return `${Math.round(bytes)} B/s`
}

export function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('en-US')
}

export function fmtTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString()
}