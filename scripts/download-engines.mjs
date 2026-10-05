import { existsSync, mkdirSync, createWriteStream } from 'node:fs'
import { join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'

const BIN_DIR = join(process.cwd(), 'bin')
if (!existsSync(BIN_DIR)) {
  mkdirSync(BIN_DIR, { recursive: true })
}

const isWin = process.platform === 'win32'
const isMac = process.platform === 'darwin'
const isArm = process.arch === 'arm64'

const OHA_URL = isWin
  ? 'https://github.com/hatoo/oha/releases/download/v1.16.0/oha-windows-amd64.exe'
  : isMac
    ? isArm
      ? 'https://github.com/hatoo/oha/releases/download/v1.16.0/oha-macos-arm64'
      : 'https://github.com/hatoo/oha/releases/download/v1.16.0/oha-macos-amd64'
    : isArm
      ? 'https://github.com/hatoo/oha/releases/download/v1.16.0/oha-linux-arm64'
      : 'https://github.com/hatoo/oha/releases/download/v1.16.0/oha-linux-amd64'

const BOMBARDIER_URL = isWin
  ? 'https://github.com/codesenberg/bombardier/releases/download/v2.0.2/bombardier-windows-amd64.exe'
  : isMac
    ? isArm
      ? 'https://github.com/codesenberg/bombardier/releases/download/v2.0.2/bombardier-darwin-arm64'
      : 'https://github.com/codesenberg/bombardier/releases/download/v2.0.2/bombardier-darwin-amd64'
    : isArm
      ? 'https://github.com/codesenberg/bombardier/releases/download/v2.0.2/bombardier-linux-arm64'
      : 'https://github.com/codesenberg/bombardier/releases/download/v2.0.2/bombardier-linux-amd64'

async function downloadFile(url, destName) {
  const destPath = join(BIN_DIR, isWin ? `${destName}.exe` : destName)
  if (existsSync(destPath)) {
    console.log(`[OK] ${destName} already exists at ${destPath}`)
    return
  }
  console.log(`Downloading ${destName} from ${url}...`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to download ${destName}: ${res.statusText}`)
  const fileStream = createWriteStream(destPath, { mode: 0o755 })
  await pipeline(Readable.fromWeb(res.body), fileStream)
  console.log(`[DONE] ${destName} downloaded successfully!`)
}

async function main() {
  await downloadFile(OHA_URL, 'oha')
  await downloadFile(BOMBARDIER_URL, 'bombardier')
}

main().catch((err) => {
  console.error('Download failed:', err)
  process.exit(1)
})
