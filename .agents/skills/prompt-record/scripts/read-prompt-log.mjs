import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const sessionId = process.argv[2]

if (!sessionId || !/^[a-zA-Z0-9._-]+$/.test(sessionId)) {
  console.error('PROMPT_LOG_SESSION_ID is required and must be a safe file id')
  process.exitCode = 1
} else {
  const path = join(process.cwd(), '.codex', 'session-logs', `${sessionId}.jsonl`)

  try {
    process.stdout.write(await readFile(path, 'utf8'))
  } catch (error) {
    if (error?.code === 'ENOENT') {
      console.error(`Prompt log not found for session: ${sessionId}`)
    } else {
      console.error(error instanceof Error ? error.message : error)
    }
    process.exitCode = 1
  }
}
