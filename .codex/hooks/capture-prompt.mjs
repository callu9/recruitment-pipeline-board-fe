import { appendFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]

export async function recordPrompt(event, outputDirectory) {
  if (
    event?.hook_event_name !== 'UserPromptSubmit' ||
    typeof event.session_id !== 'string' ||
    typeof event.prompt !== 'string'
  ) {
    return
  }

  const directory = outputDirectory ?? join(event.cwd, '.codex', 'session-logs')
  const logSessionId = event.session_id.replace(/[^a-zA-Z0-9._-]/g, '_')
  const filename = `${logSessionId}.jsonl`
  const entry = {
    session_id: event.session_id,
    turn_id: event.turn_id,
    recorded_at: new Date().toISOString(),
    prompt: event.prompt,
  }

  await mkdir(directory, { recursive: true })
  await appendFile(join(directory, filename), `${JSON.stringify(entry)}\n`)

  return {
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: `PROMPT_LOG_SESSION_ID=${logSessionId}`,
    },
  }
}

async function main() {
  let input = ''
  for await (const chunk of process.stdin) input += chunk
  const output = await recordPrompt(JSON.parse(input))
  if (output) process.stdout.write(`${JSON.stringify(output)}\n`)
}

if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
