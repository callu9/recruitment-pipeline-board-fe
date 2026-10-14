import { formatWorkspaceDate } from './features/recruitment-board/model/workspaceSelectors'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { EVALUATION_TYPE_LABELS, EVALUATION_STATUS_LABELS } from './features/recruitment-board/model/stages'
import { Button } from '@/components/ui/button'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { applicantsQueryKey } from './features/recruitment-board/api/useApplicantsQuery'
import { APPLICANT_OWNERS, SCHEDULE_STATUS_LABELS, LIFECYCLE_LABELS, OFFER_STATUS_LABELS, type Applicant, type ApplicantOwner, type Position } from './features/recruitment-board/model/applicant.types'
import { contactVersion, getAssignmentStatus, type ApplicantOperation } from './features/recruitment-board/model/operations'
import styles from './App.module.css'

/** A form that edits one stored record chosen in a select; '' in that select means a new record. */
export interface RecordSelection<T> {
  field: string
  /** Stored field values of a record (defaults for ''); undefined while the record is not loaded yet. */
  values: (id: string) => Record<string, string> | undefined
  /** The record the form edits after a successful save, e.g. the ID a create returned. */
  savedId?: (operation: T) => string | undefined
  /** Fields that the selected record does not allow editing here. */
  locked?: (id: string) => string[]
}
// Saved record IDs by draft key, for a form instance remounted while its save was in flight. The key scopes it to one applicant's form.
const savedSelections = new Map<string, string>()
type Field = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
const isField = (value: unknown): value is Field => value instanceof HTMLInputElement || value instanceof HTMLTextAreaElement || value instanceof HTMLSelectElement

export function OperationForm<T>({ id, title, pending, build, save, children, clearAfterSave = [], selection }: { id: string; title: string; pending: boolean; build: (data: FormData) => T; save: (operation: T) => Promise<string | null>; children: ReactNode; clearAfterSave?: string[]; selection?: RecordSelection<T> }) {
  const ref = useRef<HTMLFormElement>(null)
  const [error, setError] = useState('')
  const [draftError, setDraftError] = useState(false)
  const [saved, setSaved] = useState(false)
  const key = `recruitment-operation-draft:${id}:${title}`
  // Record fields always come from stored data; a draft only overrides what the user typed. Filling waits until the record is loaded.
  const waiting = useRef<{ id: string; draft: Record<string, string> } | null>(null)
  const selectionRef = useRef(selection)
  selectionRef.current = selection
  function fill(recordId: string, draft: Record<string, string>) {
    const current = selectionRef.current!
    const stored = current.values(recordId)
    const form = ref.current
    const select = form?.elements.namedItem(current.field)
    // The record's option renders after the parent receives the saved data; until then the select could not hold its ID.
    if (!stored || !form || (recordId && !(select instanceof HTMLSelectElement && Array.from(select.options).some(({ value }) => value === recordId)))) return false
    const locked = current.locked?.(recordId) ?? []
    for (const [name, value] of Object.entries({ ...stored, ...draft, [current.field]: recordId })) {
      const field = form.elements.namedItem(name)
      if (isField(field)) field.value = value
    }
    for (const element of Array.from(form.elements)) if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) element.readOnly = locked.includes(element.name)
    return true
  }
  useEffect(() => {
    // A fresh mount restores the saved ID from the draft; the registry only serves instances that lived through the save.
    savedSelections.delete(key)
    let values: Record<string, string> = {}
    try { values = JSON.parse(sessionStorage.getItem(key) ?? '{}') as Record<string, string> } catch { /* A corrupt draft does not prevent editing the saved record. */ }
    const current = selectionRef.current
    if (current) {
      const { [current.field]: recordId = '', ...draft } = values
      if (!fill(recordId, draft)) waiting.current = { id: recordId, draft }
      return
    }
    for (const [name, value] of Object.entries(values)) {
      const field = ref.current?.elements.namedItem(name)
      if (isField(field)) field.value = value
    }
  }, [key])
  useEffect(() => {
    const savedId = savedSelections.get(key)
    if (savedId !== undefined && selectionRef.current) { savedSelections.delete(key); waiting.current = { id: savedId, draft: {} } }
    if (waiting.current && fill(waiting.current.id, waiting.current.draft)) waiting.current = null
  })
  function persistDraft() {
    try {
      const values = Object.fromEntries(new FormData(ref.current!)) as Record<string, string>
      // A record still loading keeps its ID in the draft even though its option is not rendered yet.
      sessionStorage.setItem(key, JSON.stringify(waiting.current && selection ? { ...values, [selection.field]: waiting.current.id } : values)); setDraftError(false)
    } catch { setDraftError(true); setError('초안 저장 공간이 부족합니다. 창을 닫기 전에 저장해 주세요.') }
  }
  return <details data-operation-title={title} className={styles.detailSection}><summary>{title}</summary><form ref={ref} className={styles.feedbackForm} aria-label={title} data-draft-error={draftError || undefined} aria-busy={pending} onChange={(event) => {
    setSaved(false)
    if (selection && isField(event.target) && event.target.name === selection.field) { waiting.current = null; fill(event.target.value, {}) }
    persistDraft()
  }} onSubmit={async (event) => {
    event.preventDefault()
    const formElement = event.currentTarget
    setError(''); setSaved(false)
    if (waiting.current) { setError('편집할 대상을 불러온 뒤 저장해 주세요.'); return }
    try {
      const operation = build(new FormData(event.currentTarget))
      const problem = await save(operation)
      if (problem) setError(problem)
      else {
        for (const name of clearAfterSave) {
          const field = formElement.elements.namedItem(name)
          if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) field.value = ''
        }
        // Only this form's own draft key changes: a late response never touches another applicant's or form's fields.
        const savedId = selection?.savedId?.(operation)
        if (savedId) savedSelections.set(key, savedId)
        try { if (savedId && selection) sessionStorage.setItem(key, JSON.stringify({ [selection.field]: savedId })); else sessionStorage.removeItem(key) } catch { setError('저장했습니다. 초안 정리는 브라우저 저장소 제한으로 실패했습니다.') }
        setDraftError(false); setSaved(true)
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : '입력을 확인해 주세요.') }
  }}><fieldset disabled={pending}>{children}</fieldset><small>미저장 입력은 이 탭에 초안으로 보관됩니다.</small>{error && <p role="alert">{error}</p>}{saved && <p role="status">저장했습니다.</p>}<Button disabled={pending} type="submit">{pending ? '저장 중' : `${title} 저장`}</Button></form></details>
}
const text = (data: FormData, key: string) => String(data.get(key) ?? '')

export function ApplicantOperations({ applicant, actor, pending, save, positions, pane = 'work' }: { pane?: 'work' | 'support'; positions: Position[]; applicant: Applicant; actor: ApplicantOwner; pending: boolean; save: (operation: ApplicantOperation, actor: ApplicantOwner) => Promise<string | null> }) {
  // scope separates remounts and drafts when the same form edits a different record (e.g. another position's assignment).
  const form = (title: string, build: (data: FormData) => ApplicantOperation, children: ReactNode, scope?: string, selection?: RecordSelection<ApplicantOperation>) => <div key={scope} hidden={( ['포지션 배정 변경', '지원 정보 편집', '지원 상태 관리', '보관·복원', '지원 건 삭제'].includes(title) ? 'support' : 'work') !== pane}><OperationForm clearAfterSave={title === '담당 업무 편집' ? ['note'] : undefined} id={scope ? `${applicant.id}:${scope}` : applicant.id} title={title} pending={pending} build={build} save={(operation) => save(operation, actor)} selection={selection}>{children}</OperationForm></div>
  const client = useQueryClient()
  // Read from the Query cache so a save's result is visible before this component re-renders.
  const latest = () => client.getQueryData<Applicant[]>(applicantsQueryKey)?.find(({ id }) => id === applicant.id) ?? applicant
  const contactSelection: RecordSelection<ApplicantOperation> = {
    field: 'id',
    values: (id) => {
      if (!id) return { channel: '', content: '', date: '', status: 'PLANNED', reply: '', followUpDate: '', base: '' }
      const contact = latest().contacts?.find((item) => item.id === id)
      return contact && { channel: contact.channel, content: contact.content, date: contact.date, status: contact.status, reply: contact.reply, followUpDate: contact.followUpDate ?? '', base: contactVersion(contact) }
    },
    savedId: (operation) => operation.kind === 'contact' ? operation.id ?? latest().contacts?.at(-1)?.id : undefined,
  }
  const taskSelection: RecordSelection<ApplicantOperation> = {
    field: 'id',
    values: (id) => {
      if (!id) return { label: '', dueDate: '', done: 'false' }
      const task = latest().followUps?.find((item) => item.id === id)
      return task && { label: task.label, dueDate: task.dueDate, done: String(task.done) }
    },
    savedId: (operation) => operation.kind === 'task' ? operation.id ?? latest().followUps?.at(-1)?.id : undefined,
    // Dates of contact-linked tasks belong to the contact record.
    locked: (id) => latest().contacts?.some((contact) => contact.id === id) ? ['dueDate'] : [],
  }
  const { assignment, task: assignmentTask, id: assignmentId, label: assignmentLabel } = getAssignmentStatus(applicant, positions) ?? {}
  return <>
    {form('포지션 배정 변경', (data) => ({ kind: 'transfer', positionId: text(data, 'positionId'), reason: text(data, 'reason') }), <><label>배정 포지션<NativeSelect name="positionId" required defaultValue={applicant.positionId}><NativeSelectOption value="">선택</NativeSelectOption>{positions.filter(({ status }) => status === 'OPEN').map((position) => <NativeSelectOption key={position.id} value={position.id}>{position.title}</NativeSelectOption>)}</NativeSelect></label><label>배정 변경 사유<Input name="reason" required /></label></>)}
    {form('지원 정보 편집', (data) => ({ kind: 'profile', name: text(data, 'name'), email: text(data, 'email'), phone: text(data, 'phone'), resumeUrl: text(data, 'resumeUrl'), portfolioUrl: text(data, 'portfolioUrl'), source: text(data, 'source') }), <>
      <label>이름<Input name="name" required defaultValue={applicant.name} /></label><label>이메일<Input name="email" type="email" required defaultValue={applicant.email} /></label><label>연락처<Input name="phone" required defaultValue={applicant.phone} /></label><label>접수 경로<Input name="source" required defaultValue={applicant.source ?? '기존 접수'} /></label><label>이력서 링크<Input name="resumeUrl" type="url" defaultValue={applicant.resumeUrl} /></label><label>포트폴리오 링크<Input name="portfolioUrl" type="url" defaultValue={applicant.portfolioUrl} /></label>
    </>)}
    {form('담당 업무 편집', (data) => ({ kind: 'work', owner: text(data, 'owner') as ApplicantOwner, dueDate: text(data, 'dueDate'), nextAction: text(data, 'nextAction'), note: text(data, 'note') }), <>
      <label>담당자<NativeSelect name="owner" defaultValue={applicant.owner ?? actor}>{APPLICANT_OWNERS.map((owner) => <NativeSelectOption key={owner}>{owner}</NativeSelectOption>)}</NativeSelect></label><label>업무 기한<Input name="dueDate" type="date" defaultValue={applicant.dueDate} /></label><label>다음 행동<Input name="nextAction" defaultValue={applicant.nextAction} /></label><label>새 메모<textarea name="note" /></label>
    </>)}
    {applicant.resumeUrl && <p><a href={applicant.resumeUrl} target="_blank" rel="noreferrer">이력서 열기</a></p>}{applicant.portfolioUrl && <p><a href={applicant.portfolioUrl} target="_blank" rel="noreferrer">포트폴리오 열기</a></p>}
    {form('면접 일정 관리', (data) => ({ kind: 'schedule', schedule: { date: text(data, 'date'), startTime: text(data, 'startTime'), endTime: text(data, 'endTime'), format: text(data, 'format') as 'VIDEO' | 'ONSITE', interviewer: text(data, 'interviewer'), status: text(data, 'status') as NonNullable<Applicant['schedule']>['status'], round: Number(text(data, 'round')) } }), <>
    <label>면접 날짜<Input name="date" type="date" required defaultValue={applicant.schedule?.date} /></label>
    <label>시작 시간<Input name="startTime" type="time" required defaultValue={applicant.schedule?.startTime ?? '10:00'} /></label>
    <label>종료 시간<Input name="endTime" type="time" required defaultValue={applicant.schedule?.endTime ?? '11:00'} /></label>
    <label>면접 형식<NativeSelect name="format" defaultValue={applicant.schedule?.format ?? 'VIDEO'}><NativeSelectOption value="VIDEO">화상</NativeSelectOption><NativeSelectOption value="ONSITE">대면</NativeSelectOption></NativeSelect></label>
    <label>면접관<Input name="interviewer" required defaultValue={applicant.schedule?.interviewer ?? actor} /></label>
    <label>면접 회차<Input name="round" type="number" min="1" max="20" required defaultValue={applicant.schedule?.round ?? 1} /></label>
    <label>면접 상태<NativeSelect name="status" defaultValue={applicant.schedule?.status ?? 'PLANNED'}>{Object.entries(SCHEDULE_STATUS_LABELS).map(([value, label]) => <NativeSelectOption key={value} value={value}>{label}</NativeSelectOption>)}</NativeSelect></label>
  </>)}
    {form('평가 계획·재평가', (data) => ({ kind: 'evaluation-plan', evaluationId: text(data, 'evaluationId'), reviewer: text(data, 'reviewer') as ApplicantOwner, dueDate: text(data, 'dueDate'), reassess: text(data, 'reassess') === 'true', reason: text(data, 'reason') }), <>
      <label>대상 평가<NativeSelect name="evaluationId" required>{applicant.evaluations?.map((evaluation) => <NativeSelectOption key={evaluation.id} value={evaluation.id}>{EVALUATION_TYPE_LABELS[evaluation.type]} · {evaluation.round ?? 1}회차 · {EVALUATION_STATUS_LABELS[evaluation.status]} · {evaluation.id}</NativeSelectOption>)}</NativeSelect></label><label>계획 평가자<NativeSelect name="reviewer" defaultValue={actor}>{APPLICANT_OWNERS.map((owner) => <NativeSelectOption key={owner}>{owner}</NativeSelectOption>)}</NativeSelect></label><label>평가 기한<Input name="dueDate" type="date" required /></label><label>평가 계획 작업<NativeSelect name="reassess"><NativeSelectOption value="false">대기 평가 기한·담당 변경</NativeSelectOption><NativeSelectOption value="true">제출된 평가를 보존하고 재평가 등록</NativeSelectOption></NativeSelect></label><label>평가 계획 사유<Input name="reason" required /></label>
    </>)}
    {form('연락 기록', (data) => ({ kind: 'contact', id: text(data, 'id') || undefined, base: text(data, 'id') ? text(data, 'base') : undefined, channel: text(data, 'channel'), content: text(data, 'content'), date: text(data, 'date'), status: text(data, 'status') as 'PLANNED' | 'DONE', reply: text(data, 'reply'), followUpDate: text(data, 'followUpDate') }), <>
      <label>편집할 연락<NativeSelect name="id"><NativeSelectOption value="">새 연락</NativeSelectOption>{applicant.contacts?.map((contact) => <NativeSelectOption key={contact.id} value={contact.id}>{formatWorkspaceDate(contact.date)} · {contact.content}</NativeSelectOption>)}</NativeSelect></label>
      <label>연락 채널<Input name="channel" required placeholder="이메일 / 전화 / 문자" /></label><label>연락 날짜<Input name="date" type="date" required /></label><label>연락 내용<textarea name="content" required /></label><label>실행 여부<NativeSelect name="status"><NativeSelectOption value="PLANNED">연락 예정</NativeSelectOption><NativeSelectOption value="DONE">연락 완료</NativeSelectOption></NativeSelect></label><label>응답<textarea name="reply" /></label><label>재연락 기한<Input name="followUpDate" type="date" /></label><input type="hidden" name="base" /><p>이 화면은 수동 기록입니다. 이메일·문자를 발송하지 않습니다.</p>
    </>, undefined, contactSelection)}
    {applicant.contacts?.map((contact) => <p key={contact.id}>{formatWorkspaceDate(contact.date)} · {contact.channel} · {contact.status === 'DONE' ? '실행 완료' : '예정'} · {contact.content} · 응답 {contact.reply || '대기'}</p>)}
    {form('오퍼 관리', (data) => ({ kind: 'offer', conditions: text(data, 'conditions'), proposedAt: text(data, 'proposedAt'), responseDueDate: text(data, 'responseDueDate'), status: text(data, 'status') as NonNullable<Applicant['offer']>['status'], reason: text(data, 'reason') }), <>
      <label>오퍼 조건<textarea name="conditions" required defaultValue={applicant.offer?.conditions} /></label><label>제안 날짜<Input name="proposedAt" type="date" required defaultValue={applicant.offer?.proposedAt} /></label><label>응답 기한<Input name="responseDueDate" type="date" required defaultValue={applicant.offer?.responseDueDate} /></label><label>오퍼 상태<NativeSelect name="status" defaultValue={applicant.offer?.status ?? 'DRAFT'}><NativeSelectOption value="DRAFT">작성 중</NativeSelectOption><NativeSelectOption value="SENT">제안 완료</NativeSelectOption><NativeSelectOption value="ACCEPTED">지원자 수락</NativeSelectOption><NativeSelectOption value="DECLINED">지원자 거절</NativeSelectOption></NativeSelect></label><label>변경·거절 사유<Input name="reason" defaultValue={applicant.offer?.reason} /></label>
    </>)}
    {applicant.offer && <p>{applicant.offer.active === false ? '종료된 오퍼 이력' : '오퍼'}: {applicant.offer.conditions} · {OFFER_STATUS_LABELS[applicant.offer.status]} · 응답 기한 {applicant.offer.responseDueDate}</p>}
    {applicant.offer?.history?.map((offer, index) => <p key={index}>이전 오퍼: {offer.conditions} · {OFFER_STATUS_LABELS[offer.status as keyof typeof OFFER_STATUS_LABELS] ?? offer.status} · {offer.reason}</p>)}
    {form('지원 상태 관리', (data) => ({ kind: 'lifecycle', status: text(data, 'status') as NonNullable<Applicant['lifecycle']>, reason: text(data, 'reason') }), <>
      <p>철회·거절 후 재개해도 이전 오퍼와 입사 계획은 종료 기록으로 남습니다. 새 오퍼 수락과 입사 계획을 저장해 주세요. 실제 입사 후에는 지원 상태·단계와 실제 입사일을 변경할 수 없습니다.</p>
      <label>지원 상태<NativeSelect name="status" defaultValue={applicant.lifecycle ?? 'ACTIVE'}><NativeSelectOption value="ACTIVE">진행·재개</NativeSelectOption><NativeSelectOption value="ON_HOLD">보류</NativeSelectOption><NativeSelectOption value="WITHDRAWN">철회</NativeSelectOption><NativeSelectOption value="OFFER_DECLINED">오퍼 거절 종료</NativeSelectOption></NativeSelect></label><label>상태 변경 사유<Input name="reason" required /></label>
    </>)}
    <p>지원 상태: {LIFECYCLE_LABELS[applicant.lifecycle ?? 'ACTIVE']} · {applicant.lifecycleReason}</p>
    {form('입사 관리', (data) => ({ kind: 'employment', plannedStartDate: text(data, 'plannedStartDate'), actualStartDate: text(data, 'actualStartDate') }), <>
      <p>회사 최종 합격({applicant.stage === 'HIRED' ? '완료' : '미완료'}) · 오퍼 수락({applicant.offer?.status === 'ACCEPTED' ? '완료' : '미완료'})</p><label>입사 예정일<Input name="plannedStartDate" type="date" required defaultValue={applicant.employment?.plannedStartDate} /></label><label>실제 입사일<Input name="actualStartDate" type="date" defaultValue={applicant.employment?.actualStartDate} /></label>
    </>)}
    {applicant.employment && <p>{applicant.employment.active === false ? '종료된 입사 계획' : '입사 예정'} {formatWorkspaceDate(applicant.employment.plannedStartDate)} · 실제 {applicant.employment.actualStartDate ? formatWorkspaceDate(applicant.employment.actualStartDate) : '미입사'}</p>}
    {applicant.employment?.history?.map((record, index) => <p key={index}>이전 입사 계획 {formatWorkspaceDate(record.plannedStartDate)} · 실제 {record.actualStartDate ? formatWorkspaceDate(record.actualStartDate) : '미입사'}</p>)}
    {assignment && form('과제 관리', (data) => ({ kind: 'assignment', assignment: text(data, 'assignment'), dueDate: text(data, 'dueDate'), submitted: text(data, 'submitted') === 'true' }), <>
      <p>과제: {assignment} · {assignmentTask?.done ? '제출 확인' : '제출 미확인'}</p><label>과제 제출 기한<Input name="dueDate" type="date" required defaultValue={assignmentTask?.dueDate} /></label><label>제출 여부<NativeSelect name="submitted" defaultValue={String(assignmentTask?.done ?? false)}><NativeSelectOption value="false">안내·제출 대기</NativeSelectOption><NativeSelectOption value="true">제출 확인</NativeSelectOption></NativeSelect></label><input type="hidden" name="assignment" value={assignment} />
    </>, `${assignmentId}:${assignmentLabel}`)}
    {form('후속 업무 관리', (data) => ({ kind: 'task', id: text(data, 'id') || undefined, label: text(data, 'label'), dueDate: text(data, 'dueDate'), done: text(data, 'done') === 'true' }), <>
      <label>편집할 업무<NativeSelect name="id"><NativeSelectOption value="">새 업무</NativeSelectOption>{applicant.followUps?.filter(({ id }) => !id.startsWith('assignment-')).map((task) => <NativeSelectOption key={task.id} value={task.id}>{task.label} · {task.done ? '완료' : '대기'}</NativeSelectOption>)}</NativeSelect></label><label>후속 업무<Input name="label" required /></label><label>후속 업무 기한<Input name="dueDate" type="date" required /></label><small>연락에서 만든 업무의 날짜는 '연락 기록'에서 바꿉니다.</small><label>완료 상태<NativeSelect name="done"><NativeSelectOption value="false">대기</NativeSelectOption><NativeSelectOption value="true">완료</NativeSelectOption></NativeSelect></label>
    </>, undefined, taskSelection)}
    {applicant.followUps?.map((task) => <p key={task.id}>{task.label} · {formatWorkspaceDate(task.dueDate)} · {task.active === false ? '종료된 업무 이력' : task.done ? '완료' : '대기'}</p>)}
    {form('보관·복원', (data) => ({ kind: 'archive', archived: text(data, 'archived') === 'true', talentPool: text(data, 'talentPool') === 'true', reconnectDate: text(data, 'reconnectDate'), reason: text(data, 'reason') }), <>
      <label>기록 보관<NativeSelect name="archived" defaultValue={applicant.archivedAt ? 'true' : 'false'}><NativeSelectOption value="false">활성 목록으로 복원</NativeSelectOption><NativeSelectOption value="true">종료 기록 보관</NativeSelectOption></NativeSelect></label><label>인재풀<NativeSelect name="talentPool" defaultValue={applicant.talentPool ? 'true' : 'false'}><NativeSelectOption value="false">미등록</NativeSelectOption><NativeSelectOption value="true">인재풀 등록</NativeSelectOption></NativeSelect></label><label>재접촉 날짜<Input name="reconnectDate" type="date" defaultValue={applicant.reconnectDate} /></label><label>보관·복원 사유<Input name="reason" required /></label>
    </>)}
    {form('지원 건 삭제', (data) => ({ kind: 'delete', confirmation: text(data, 'confirmation'), reason: text(data, 'reason') }), <>
      <p>보관된 지원 건 {applicant.id}와 그 연락·평가 기록을 영구 삭제합니다. 다른 지원 건은 남습니다.</p><label>삭제할 지원 건 ID 확인<Input name="confirmation" required /></label><label>삭제 사유<Input name="reason" required /></label>
    </>)}
    {applicant.schedule?.history?.map((schedule, index) => <p key={index}>일정 이력: {schedule.round ?? 1}회차 · {formatWorkspaceDate(schedule.date)} {schedule.startTime} · {SCHEDULE_STATUS_LABELS[schedule.status ?? 'PLANNED']}</p>)}</>
}
