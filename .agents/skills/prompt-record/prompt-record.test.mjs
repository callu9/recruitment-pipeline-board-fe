import assert from 'node:assert/strict'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const scriptPath = join(
  dirname(fileURLToPath(import.meta.url)),
  'scripts',
  'read-prompt-log.mjs',
)

async function createWorkspace(logs) {
  const workspace = await mkdtemp(join(tmpdir(), 'prompt-record-skill-'))
  const logDirectory = join(workspace, '.codex', 'session-logs')
  await mkdir(logDirectory, { recursive: true })

  for (const [sessionId, content] of Object.entries(logs)) {
    await writeFile(join(logDirectory, `${sessionId}.jsonl`), content)
  }

  return workspace
}

function runReader(workspace, sessionId) {
  return spawnSync(process.execPath, [scriptPath, sessionId].filter(Boolean), {
    cwd: workspace,
    encoding: 'utf8',
  })
}

test('reads only the prompt log selected by session id', async () => {
  const workspace = await createWorkspace({
    selected: '{"prompt":"selected prompt"}\n',
    newer: '{"prompt":"side conversation"}\n',
  })

  const result = runReader(workspace, 'selected')

  assert.equal(result.status, 0)
  assert.equal(result.stdout, '{"prompt":"selected prompt"}\n')
  assert.equal(result.stderr, '')
})

test('fails when the session id is missing', async () => {
  const workspace = await createWorkspace({})

  const result = runReader(workspace)

  assert.equal(result.status, 1)
  assert.match(result.stderr, /PROMPT_LOG_SESSION_ID is required/)
})

test('fails instead of selecting another log when the requested file is missing', async () => {
  const workspace = await createWorkspace({
    newer: '{"prompt":"side conversation"}\n',
  })

  const result = runReader(workspace, 'missing')

  assert.equal(result.status, 1)
  assert.match(result.stderr, /Prompt log not found for session: missing/)
  assert.doesNotMatch(result.stdout, /side conversation/)
})
