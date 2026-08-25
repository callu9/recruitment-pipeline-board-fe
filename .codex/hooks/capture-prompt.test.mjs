import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { recordPrompt } from './capture-prompt.mjs'

test('records the exact user prompt in a session-specific JSONL file', async () => {
  const outputDirectory = await mkdtemp(join(tmpdir(), 'prompt-record-'))
  const prompt = 'first line\nsecond line with `code`'

  const result = await recordPrompt(
    {
      hook_event_name: 'UserPromptSubmit',
      session_id: 'session/../unsafe',
      turn_id: 'turn-1',
      prompt,
    },
    outputDirectory,
  )

  const files = await readdir(outputDirectory)
  assert.deepEqual(files, ['session_.._unsafe.jsonl'])

  const entry = JSON.parse(await readFile(join(outputDirectory, files[0]), 'utf8'))
  assert.equal(entry.prompt, prompt)
  assert.equal(entry.session_id, 'session/../unsafe')
  assert.equal(entry.turn_id, 'turn-1')
  assert.deepEqual(result, {
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: 'PROMPT_LOG_SESSION_ID=session_.._unsafe',
    },
  })
})

test('ignores events that cannot provide a prompt', async () => {
  const outputDirectory = await mkdtemp(join(tmpdir(), 'prompt-record-'))

  const result = await recordPrompt(
    { hook_event_name: 'Stop', session_id: 'session-1', prompt: 'not a user prompt' },
    outputDirectory,
  )

  assert.deepEqual(await readdir(outputDirectory), [])
  assert.equal(result, undefined)
})
