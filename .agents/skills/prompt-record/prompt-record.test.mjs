import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
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
const skillPath = join(dirname(fileURLToPath(import.meta.url)), 'SKILL.md')
const agentsPath = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'AGENTS.md')
const commitPlanPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'docs',
  'IMPLEMENTATION_AND_COMMIT_PLAN.md',
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

test('records the current feature automatically and defers hash sync to submission review', async () => {
  const [skill, agents, commitPlan] = await Promise.all([
    readFile(skillPath, 'utf8'),
    readFile(agentsPath, 'utf8'),
    readFile(commitPlanPath, 'utf8'),
  ])

  assert.match(skill, /Feature record mode/)
  assert.match(skill, /Final hash sync mode/)
  assert.doesNotMatch(skill, /immediately previous feature section/)
  assert.match(skill, /planned commit subject/)
  assert.match(agents, /without a separate request/)
  assert.match(commitPlan, /submission-review.*한 번에 동기화/s)
})

test('finalizes the prompt record after user validation and before staging', async () => {
  const [skill, agents, commitPlan] = await Promise.all([
    readFile(skillPath, 'utf8'),
    readFile(agentsPath, 'utf8'),
    readFile(commitPlanPath, 'utf8'),
  ])

  assert.doesNotMatch(skill, /before the completion report/)
  assert.match(skill, /user reports validation results or explicitly accepts the unverified scope/)
  assert.match(skill, /before staging/)
  assert.match(agents, /report the unstaged diff and manual validation scenarios/)

  const automatedVerification = commitPlan.indexOf('자동 검증 결과와 unstaged diff')
  const userValidation = commitPlan.indexOf('사용자 검증 결과')
  const promptRecord = commitPlan.indexOf('`prompt-record`로')
  const staging = commitPlan.indexOf('관련 파일만 stage한다')

  assert.ok(automatedVerification >= 0)
  assert.ok(automatedVerification < userValidation)
  assert.ok(userValidation < promptRecord)
  assert.ok(promptRecord < staging)
})
