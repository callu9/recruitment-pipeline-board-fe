import { beforeEach, afterEach, expect, test, vi } from 'vitest'
import { createSeedApplicants, SEED_POSITIONS } from './seedApplicants'
import { loadApplicants, saveApplicants, STORAGE_KEY, POSITIONS_STORAGE_KEY } from './mockDb'
import { resetMockApiTestConfig, setMockApiTestConfig } from './mockConfig'
import type { Applicant, ApplicantIntake } from '../features/recruitment-board/model/applicant.types'
import { getMissingEvaluations, getTodayActionableApplicants } from '../features/recruitment-board/model/workspaceSelectors'
import type { ApplicantOperation } from '../features/recruitment-board/model/operations'

beforeEach(() => { localStorage.clear(); setMockApiTestConfig({ delayMs: 0, failureRate: 0 }); saveApplicants(createSeedApplicants(1, '2026-10-07')); localStorage.setItem(POSITIONS_STORAGE_KEY, JSON.stringify(SEED_POSITIONS)) })
afterEach(() => { localStorage.clear(); resetMockApiTestConfig(); vi.restoreAllMocks() })
const patch = (operation: ApplicantOperation, id = 'applicant-001') => fetch(`http://localhost/api/applicants/${id}/operations`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ operation, actor: '이서준' }) })
const move = (stage: Applicant['stage'], extra = {}) => fetch('http://localhost/api/applicants/applicant-001/stage', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage, actor: '이서준', ...extra }) })
const feedback = async (type: string) => { const evaluation = loadApplicants()[0].evaluations!.findLast((item) => item.type === type)!; const result = await fetch(`http://localhost/api/applicants/applicant-001/evaluations/${evaluation.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reviewer: '김하나', score: 80, comment: '충분한 근거', actor: '이서준' }) }); expect(result.status).toBe(200) }
const intake: ApplicantIntake = { name: '신규 지원자', email: 'new@example.com', phone: '010', source: '직접 접수', positionId: 'position-frontend' }
const create = (inputs: ApplicantIntake[]) => fetch('http://localhost/api/applicants', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inputs, actor: '김하나' }) })

test('runs evaluation, interview, offer acceptance, company approval, actual start and handoff through persisted API', async () => {
  expect((await move('INTERVIEW')).status).toBe(409)
  await feedback('SCREEN'); expect((await move('INTERVIEW')).status).toBe(200)
  expect((await patch({ kind: 'schedule', schedule: { date: '2026-10-07', startTime: '10:00', endTime: '11:00', format: 'VIDEO', interviewer: '김하나', status: 'COMPLETED', round: 1 } })).status).toBe(200)
  await feedback('INTERVIEW'); expect((await move('OFFER')).status).toBe(200)
  await feedback('FINAL')
  expect((await patch({ kind: 'offer', conditions: '연봉 5000', proposedAt: '2026-10-07', responseDueDate: '2026-10-14', status: 'ACCEPTED', reason: '수락 확인' })).status).toBe(200)
  expect((await move('HIRED')).status).toBe(200)
  expect((await patch({ kind: 'employment', plannedStartDate: '2026-10-07', actualStartDate: '2026-10-07' })).status).toBe(200)
  expect((await patch({ kind: 'archive', archived: true, talentPool: false, reconnectDate: '', reason: '완료' })).status).toBe(400)
  for (const task of loadApplicants()[0].followUps!) expect((await patch({ kind: 'task', ...task, done: true })).status).toBe(200)
  expect((await patch({ kind: 'archive', archived: true, talentPool: false, reconnectDate: '', reason: '완료' })).status).toBe(200)
  const read = await fetch('http://localhost/api/applicants')
  expect((await read.json())[0]).toMatchObject({ stage: 'HIRED', offer: { status: 'ACCEPTED' }, employment: { actualStartDate: '2026-10-07' }, archivedAt: expect.any(String) })
})
test('links a reapplication as a separate application and rejects duplicate intake without linking atomically', async () => {
  const response = await create([intake]); expect(response.status).toBe(201)
  const [first] = await response.json() as Applicant[]
  const before = localStorage.getItem(STORAGE_KEY)
  expect((await create([{ ...intake, email: 'unique@example.com' }, intake])).status).toBe(400)
  expect(localStorage.getItem(STORAGE_KEY)).toBe(before)
  const reapplied = await create([{ ...intake, linkedApplicationId: first.id, positionId: 'position-backend' }]); expect(reapplied.status).toBe(201)
  const [second] = await reapplied.json() as Applicant[]
  expect(second.id).not.toBe(first.id); expect(second.personId).toBe(first.personId); expect(second.previousApplicationId).toBe(first.id)
})
test('closing recruitment rejects new intake but permits existing applicant processing with explicit rationale', async () => {
  const response = await fetch('http://localhost/api/positions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...SEED_POSITIONS[0], status: 'CLOSED' }) })
  expect(response.status).toBe(200)
  expect((await create([intake])).status).toBe(400)
  expect((await move('INTERVIEW', { overrideReason: '미완료 업무 확인' })).status).toBe(200)
})
test('retains rejection grounds during correction and keeps withdrawal separate from stage', async () => {
  expect((await move('REJECTED', { rejectionReason: '기준 미달', rejectionMemo: '재검토 가능' })).status).toBe(200)
  expect((await move('INTERVIEW', { correction: true })).status).toBe(200)
  expect(loadApplicants()[0].timeline?.some((item) => item.rejectionReason === '기준 미달')).toBe(true)
  expect((await patch({ kind: 'lifecycle', status: 'WITHDRAWN', reason: '지원자 요청' })).status).toBe(200)
  expect((await move('OFFER', { overrideReason: '강제 진행' })).status).toBe(409)
  expect(loadApplicants()[0]).toMatchObject({ stage: 'INTERVIEW', lifecycle: 'WITHDRAWN', lifecycleReason: '지원자 요청' })
})
test('preserves storage on forced failure and saves the retry without corrupting another applicant', async () => {
  const before = localStorage.getItem(STORAGE_KEY)
  setMockApiTestConfig({ delayMs: 0, failureRate: 1 })
  expect((await patch({ kind: 'work', owner: '박민지', dueDate: '2026-11-01', nextAction: '확인', note: '메모' })).status).toBe(503)
  expect(localStorage.getItem(STORAGE_KEY)).toBe(before)
  setMockApiTestConfig({ delayMs: 0, failureRate: 0 })
  expect((await patch({ kind: 'work', owner: '박민지', dueDate: '2026-11-01', nextAction: '확인', note: '메모' })).status).toBe(200)
  expect(loadApplicants()[0].notes?.at(-1)).toMatchObject({ author: '이서준', text: '메모' })
})
test('requires archive and exact confirmation to delete only the chosen application', async () => {
  const original = loadApplicants()[0]
  saveApplicants([ { ...original, stage: 'REJECTED', archivedAt: '2026-10-01' }, { ...original, id: 'preserve-this' } ])
  expect((await patch({ kind: 'delete', confirmation: 'bad', reason: '삭제 요청' })).status).toBe(400)
  expect((await patch({ kind: 'delete', confirmation: original.id, reason: '삭제 요청' })).status).toBe(200)
  expect(loadApplicants()).toEqual([{ ...original, id: 'preserve-this' }])
})
test('reports local storage quota failure without mutating persisted data', async () => {
  const before = localStorage.getItem(STORAGE_KEY)
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('QuotaExceededError', 'QuotaExceededError') })
  const response = await patch({ kind: 'work', owner: '박민지', dueDate: '', nextAction: '확인', note: '' })
  expect(response.status).toBe(503)
  expect(localStorage.getItem(STORAGE_KEY)).toBe(before)
})
const hiringFixture = (): Applicant => ({ ...loadApplicants()[0], stage: 'HIRED', evaluations: [], dueDate: undefined, offer: { conditions: '조건', proposedAt: '2026-10-01', responseDueDate: '2026-10-15', status: 'ACCEPTED', reason: '' }, employment: { plannedStartDate: '2026-11-01', actualStartDate: '' }, followUps: [{ id: 'handoff-test', label: '입사 인계', dueDate: '2026-10-10', done: false }] })
test.each(['WITHDRAWN', 'OFFER_DECLINED'] as const)('enforces lifecycle %s and renewed acceptance across persisted API', async (status) => {
  saveApplicants([hiringFixture()])
  expect((await patch({ kind: 'lifecycle', status, reason: '종료' })).status).toBe(200)
  expect(loadApplicants()[0].employment).toMatchObject({ plannedStartDate: '2026-11-01', active: false })
  expect(loadApplicants()[0].followUps?.find(({ id }) => id === 'handoff-test')?.active).toBe(false)
  expect((await patch({ kind: 'employment', plannedStartDate: '2026-10-01', actualStartDate: '2026-10-01' })).status).toBe(400)
  expect((await patch({ kind: 'lifecycle', status: 'ACTIVE', reason: '재개' })).status).toBe(200)
  expect((await patch({ kind: 'employment', plannedStartDate: '2026-10-01', actualStartDate: '2026-10-01' })).status).toBe(400)
  expect((await patch({ kind: 'offer', conditions: '새 조건', proposedAt: '2026-10-01', responseDueDate: '2026-10-15', status: 'ACCEPTED', reason: '재수락' })).status).toBe(200)
  expect((await patch({ kind: 'employment', plannedStartDate: '2026-10-01', actualStartDate: '2026-10-01' })).status).toBe(200)
  const before = localStorage.getItem(STORAGE_KEY)
  expect((await patch({ kind: 'lifecycle', status, reason: '종료 재시도' })).status).toBe(400)
  expect((await move('REJECTED', { correction: true, rejectionReason: '정정' })).status).toBe(409)
  expect((await move('INTERVIEW', { correction: true })).status).toBe(409)
  expect((await patch({ kind: 'offer', conditions: '조건', proposedAt: '2026-10-01', responseDueDate: '2026-10-15', status: 'DECLINED', reason: '거절' })).status).toBe(400)
  expect((await patch({ kind: 'employment', plannedStartDate: '2026-10-01', actualStartDate: '' })).status).toBe(400)
  expect(localStorage.getItem(STORAGE_KEY)).toBe(before)
})
test('retires unanswered offer work on rejection correction and preserves it as history', async () => {
  saveApplicants([{ ...hiringFixture(), stage: 'OFFER', offer: { ...hiringFixture().offer!, status: 'SENT' } }])
  expect((await move('REJECTED', { correction: true, rejectionReason: '정정' })).status).toBe(200)
  expect(loadApplicants()[0]).toMatchObject({ stage: 'REJECTED', offer: { status: 'SENT', active: false }, employment: { active: false } })
  expect(loadApplicants()[0].followUps?.filter((task) => task.active !== false && !task.done)).toEqual([expect.objectContaining({ label: '종료 확인 통보' })])
})

test.each([false, true])('resumes the same stage through hold=%s and permits normal progress after persisted feedback', async (viaHold) => {
  expect((await patch({ kind: 'lifecycle', status: 'WITHDRAWN', reason: '철회' })).status).toBe(200)
  expect(getMissingEvaluations(loadApplicants())).toEqual([])
  if (viaHold) expect((await patch({ kind: 'lifecycle', status: 'ON_HOLD', reason: '검토 보류' })).status).toBe(200)
  expect((await patch({ kind: 'lifecycle', status: 'ACTIVE', reason: '재개' })).status).toBe(200)
  const [resumed] = await (await fetch('http://localhost/api/applicants')).json() as Applicant[]
  expect(resumed.stage).toBe('DOCUMENT_REVIEW')
  expect(getMissingEvaluations([resumed])).toEqual([resumed])
  expect(getTodayActionableApplicants([resumed], '2026-10-08')).toEqual([resumed])
  const id = resumed.evaluations![0].id
  expect((await patch({ kind: 'evaluation-plan', evaluationId: id, reviewer: '박민지', dueDate: '2026-10-09', reassess: false, reason: '재배정' })).status).toBe(200)
  expect(loadApplicants()[0].evaluations![0]).toMatchObject({ id, active: true, reviewer: '박민지', dueDate: '2026-10-09' })
  await feedback('SCREEN')
  expect(getMissingEvaluations(loadApplicants())).toEqual([])
  expect((await move('INTERVIEW')).status).toBe(200)
  expect(loadApplicants()[0].evaluations![0]).toMatchObject({ id, status: 'SUBMITTED', comment: '충분한 근거', active: false })
})

const cancelledHistoryPaths = (['CANCELLED', 'POSTPONED', 'NO_SHOW'] as const).flatMap((scheduleStatus) => (['ON_HOLD', 'WITHDRAWN'] as const).map((status) => ({ scheduleStatus, status })))
test.each(cancelledHistoryPaths)('keeps past $scheduleStatus work inactive when resuming $status through persisted API', async ({ scheduleStatus, status }) => {
  await feedback('SCREEN'); expect((await move('INTERVIEW')).status).toBe(200)
  const schedule = { date: '2026-10-08', startTime: '10:00', endTime: '11:00', format: 'VIDEO' as const, interviewer: '김하나', round: 1 }
  expect((await patch({ kind: 'schedule', schedule: { ...schedule, status: scheduleStatus } })).status).toBe(200)
  expect((await patch({ kind: 'schedule', schedule: { ...schedule, round: 2, status: 'COMPLETED' } })).status).toBe(200)
  await feedback('INTERVIEW')
  const before = loadApplicants()[0]
  expect((await patch({ kind: 'lifecycle', status, reason: '중단' })).status).toBe(200)
  expect((await patch({ kind: 'lifecycle', status: 'ACTIVE', reason: '재개' })).status).toBe(200)
  const [resumed] = await (await fetch('http://localhost/api/applicants')).json() as Applicant[]
  expect(resumed.evaluations).toEqual(before.evaluations)
  expect(resumed.schedule?.history).toEqual(before.schedule?.history)
  expect(getMissingEvaluations([resumed])).toEqual([])
  expect((await move('OFFER')).status).toBe(200)
})
