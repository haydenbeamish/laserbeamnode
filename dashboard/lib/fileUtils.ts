import fs from 'fs'
import path from 'path'
import { UpdateLog } from '@/types'

const DATA_DIR = process.env.DATA_STORAGE_PATH || './data'
const LOG_FILE = path.join(DATA_DIR, 'update-log.json')

export function ensureDataDirectory() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
}

export function saveFile(fileName: string, content: Buffer | string) {
  ensureDataDirectory()
  const filePath = path.join(DATA_DIR, fileName)
  fs.writeFileSync(filePath, content)
  return filePath
}

export function readFile(fileName: string): Buffer {
  const filePath = path.join(DATA_DIR, fileName)
  return fs.readFileSync(filePath)
}

export function fileExists(fileName: string): boolean {
  const filePath = path.join(DATA_DIR, fileName)
  return fs.existsSync(filePath)
}

export function logUpdate(file: string, status: 'success' | 'error', message: string) {
  ensureDataDirectory()

  let logs: UpdateLog[] = []

  if (fs.existsSync(LOG_FILE)) {
    const content = fs.readFileSync(LOG_FILE, 'utf-8')
    logs = JSON.parse(content)
  }

  const newLog: UpdateLog = {
    timestamp: new Date().toISOString(),
    file,
    status,
    message,
  }

  logs.push(newLog)

  // Keep only last 100 logs
  if (logs.length > 100) {
    logs = logs.slice(-100)
  }

  fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2))
}

export function getUpdateLogs(): UpdateLog[] {
  if (!fs.existsSync(LOG_FILE)) {
    return []
  }

  const content = fs.readFileSync(LOG_FILE, 'utf-8')
  return JSON.parse(content)
}

export function getLatestUpdateTime(fileName: string): string | null {
  const logs = getUpdateLogs()
  const fileLog = logs
    .filter((log) => log.file === fileName && log.status === 'success')
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]

  return fileLog ? fileLog.timestamp : null
}
