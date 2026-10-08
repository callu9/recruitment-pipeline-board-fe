import { useEffect, useRef, useState, type ReactNode } from 'react'
import { APPLICANT_OWNERS, SCHEDULE_STATUS_LABELS, LIFECYCLE_LABELS, OFFER_STATUS_LABELS, type Applicant, type ApplicantOwner, type Position } from './features/recruitment-board/model/applicant.types'
import type { ApplicantOperation } from './features/recruitment-board/model/operations'
import styles from './App.module.css'

export function OperationForm<T>({ id, title, pending, build, save, children, clearAfterSave = [] }: { id: string; title: string; pending: boolean; build: (data: FormData) => T; save: (operation: T) => Promise<string | null>; children: ReactNode; clearAfterSave?: string[] }) {
  const ref = useRef<HTMLFormElement>(null)
  const [error, setError] = useState('')
  const [draftError, setDraftError] = useState(false)
  const [saved, setSaved] = useState(false)
  const key = `recruitment-operation-draft:${id}:${title}`
  useEffect(() => {
    try {
      const values = JSON.parse(sessionStorage.getItem(key) ?? '{}') as Record<string, string>
      for (const [name, value] of Object.entries(values)) {
        const field = ref.current?.elements.namedItem(name)
        if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) field.value = value
      }
    } catch { /* A corrupt draft does not prevent editing the saved record. */ }
  }, [key])
  return <details className={styles.detailSection}><summary>{title}</summary><form ref={ref} className={styles.feedbackForm} aria-label={title} data-draft-error={draftError || undefined} aria-busy={pending} onChange={() => {
    setSaved(false)
    try { sessionStorage.setItem(key, JSON.stringify(Object.fromEntries(new FormData(ref.current!)))); setDraftError(false) } catch { setDraftError(true); setError('초안 저장 공간이 부족합니다. 창을 닫기 전에 저장해 주세요.') }
  }} onSubmit={async (event) => {
    event.preventDefault()
    const formElement = event.currentTarget
    setError(''); setSaved(false)
    try {
      const problem = await save(build(new FormData(event.currentTarget)))
      if (problem) setError(problem)
      else {
        for (const name of clearAfterSave) {
          const field = formElement.elements.namedItem(name)
          if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) field.value = ''
        }
        try { sessionStorage.removeItem(key) } catch { setError('저장했습니다. 초안 정리는 브라우저 저장소 제한으로 실패했습니다.') }
        setDraftError(false); setSaved(true)
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : '입력을 확인해 주세요.') }
  }}><fieldset disabled={pending}>{children}</fieldset><small>미저장 입력은 이 탭에 초안으로 보관됩니다.</small>{error && <p role="alert">{error}</p>}{saved && <p role="status">저장했습니다.</p>}<button className={styles.primaryButton} disabled={pending} type="submit">{pending ? '저장 중' : `${title} 저장`}</button></form></details>
}
const text = (data: FormData, key: string) => String(data.get(key) ?? '')

export function ApplicantOperations({ applicant, actor, pending, save, positions }: { positions: Position[]; applicant: Applicant; actor: ApplicantOwner; pending: boolean; save: (operation: ApplicantOperation, actor: ApplicantOwner) => Promise<string | null> }) {
  const form = (title: string, build: (data: FormData) => ApplicantOperation, children: ReactNode) => <OperationForm clearAfterSave={title === '담당 업무 편집' ? ['note'] : undefined} id={applicant.id} title={title} pending={pending} build={build} save={(operation) => save(operation, actor)}>{children}</OperationForm>
  return <>
    {form('포지션 배정 변경', (data) => ({ kind: 'transfer', positionId: text(data, 'positionId'), reason: text(data, 'reason') }), <><label>배정 포지션<select name="positionId" required defaultValue={applicant.positionId}><option value="">선택</option>{positions.filter(({ status }) => status === 'OPEN').map((position) => <option key={position.id} value={position.id}>{position.title}</option>)}</select></label><label>배정 변경 사유<input name="reason" required /></label></>)}
    {form('지원 정보 편집', (data) => ({ kind: 'profile', name: text(data, 'name'), email: text(data, 'email'), phone: text(data, 'phone'), resumeUrl: text(data, 'resumeUrl'), portfolioUrl: text(data, 'portfolioUrl'), source: text(data, 'source') }), <>
      <label>이름<input name="name" required defaultValue={applicant.name} /></label><label>이메일<input name="email" type="email" required defaultValue={applicant.email} /></label><label>연락처<input name="phone" required defaultValue={applicant.phone} /></label><label>접수 경로<input name="source" required defaultValue={applicant.source ?? '기존 접수'} /></label><label>이력서 링크<input name="resumeUrl" type="url" defaultValue={applicant.resumeUrl} /></label><label>포트폴리오 링크<input name="portfolioUrl" type="url" defaultValue={applicant.portfolioUrl} /></label>
    </>)}
    {form('담당 업무 편집', (data) => ({ kind: 'work', owner: text(data, 'owner') as ApplicantOwner, dueDate: text(data, 'dueDate'), nextAction: text(data, 'nextAction'), note: text(data, 'note') }), <>
      <label>담당자<select name="owner" defaultValue={applicant.owner ?? actor}>{APPLICANT_OWNERS.map((owner) => <option key={owner}>{owner}</option>)}</select></label><label>업무 기한<input name="dueDate" type="date" defaultValue={applicant.dueDate} /></label><label>다음 행동<input name="nextAction" defaultValue={applicant.nextAction} /></label><label>새 메모<textarea name="note" /></label>
    </>)}
    {applicant.resumeUrl && <p><a href={applicant.resumeUrl} target="_blank" rel="noreferrer">이력서 열기</a></p>}{applicant.portfolioUrl && <p><a href={applicant.portfolioUrl} target="_blank" rel="noreferrer">포트폴리오 열기</a></p>}
    {form('면접 일정 관리', (data) => ({ kind: 'schedule', schedule: { date: text(data, 'date'), startTime: text(data, 'startTime'), endTime: text(data, 'endTime'), format: text(data, 'format') as 'VIDEO' | 'ONSITE', interviewer: text(data, 'interviewer'), status: text(data, 'status') as NonNullable<Applicant['schedule']>['status'], round: Number(text(data, 'round')) } }), <>
    <label>면접 날짜<input name="date" type="date" required defaultValue={applicant.schedule?.date} /></label>
    <label>시작 시간<input name="startTime" type="time" required defaultValue={applicant.schedule?.startTime ?? '10:00'} /></label>
    <label>종료 시간<input name="endTime" type="time" required defaultValue={applicant.schedule?.endTime ?? '11:00'} /></label>
    <label>면접 형식<select name="format" defaultValue={applicant.schedule?.format ?? 'VIDEO'}><option value="VIDEO">화상</option><option value="ONSITE">대면</option></select></label>
    <label>면접관<input name="interviewer" required defaultValue={applicant.schedule?.interviewer ?? actor} /></label>
    <label>면접 회차<input name="round" type="number" min="1" max="20" required defaultValue={applicant.schedule?.round ?? 1} /></label>
    <label>면접 상태<select name="status" defaultValue={applicant.schedule?.status ?? 'PLANNED'}>{Object.entries(SCHEDULE_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
  </>)}
    {form('평가 계획·재평가', (data) => ({ kind: 'evaluation-plan', evaluationId: text(data, 'evaluationId'), reviewer: text(data, 'reviewer') as ApplicantOwner, dueDate: text(data, 'dueDate'), reassess: text(data, 'reassess') === 'true', reason: text(data, 'reason') }), <>
      <label>대상 평가<select name="evaluationId" required>{applicant.evaluations?.map((evaluation) => <option key={evaluation.id} value={evaluation.id}>{evaluation.type} · {evaluation.round ?? 1}회차 · {evaluation.status} · {evaluation.id}</option>)}</select></label><label>계획 평가자<select name="reviewer" defaultValue={actor}>{APPLICANT_OWNERS.map((owner) => <option key={owner}>{owner}</option>)}</select></label><label>평가 기한<input name="dueDate" type="date" required /></label><label>평가 계획 작업<select name="reassess"><option value="false">대기 평가 기한·담당 변경</option><option value="true">제출된 평가를 보존하고 재평가 등록</option></select></label><label>평가 계획 사유<input name="reason" required /></label>
    </>)}
    {form('연락 기록', (data) => ({ kind: 'contact', id: text(data, 'id') || undefined, channel: text(data, 'channel'), content: text(data, 'content'), date: text(data, 'date'), status: text(data, 'status') as 'PLANNED' | 'DONE', reply: text(data, 'reply'), followUpDate: text(data, 'followUpDate') }), <>
      <label>편집할 연락<select name="id" onChange={(event) => {
        const contact = applicant.contacts?.find(({ id }) => id === event.target.value)
        for (const name of ['channel', 'content', 'date', 'status', 'reply', 'followUpDate'] as const) (event.target.form!.elements.namedItem(name) as HTMLInputElement).value = contact?.[name] ?? (name === 'status' ? 'PLANNED' : '')
      }}><option value="">새 연락</option>{applicant.contacts?.map((contact) => <option key={contact.id} value={contact.id}>{contact.date} · {contact.content}</option>)}</select></label>
      <label>연락 채널<input name="channel" required placeholder="이메일 / 전화 / 문자" /></label><label>연락 날짜<input name="date" type="date" required /></label><label>연락 내용<textarea name="content" required /></label><label>실행 여부<select name="status"><option value="PLANNED">연락 예정</option><option value="DONE">연락 완료</option></select></label><label>응답<textarea name="reply" /></label><label>재연락 기한<input name="followUpDate" type="date" /></label><p>이 화면은 수동 기록입니다. 이메일·문자를 발송하지 않습니다.</p>
    </>)}
    {applicant.contacts?.map((contact) => <p key={contact.id}>{contact.date} · {contact.channel} · {contact.status === 'DONE' ? '실행 완료' : '예정'} · {contact.content} · 응답 {contact.reply || '대기'}</p>)}
    {form('오퍼 관리', (data) => ({ kind: 'offer', conditions: text(data, 'conditions'), proposedAt: text(data, 'proposedAt'), responseDueDate: text(data, 'responseDueDate'), status: text(data, 'status') as NonNullable<Applicant['offer']>['status'], reason: text(data, 'reason') }), <>
      <label>오퍼 조건<textarea name="conditions" required defaultValue={applicant.offer?.conditions} /></label><label>제안 날짜<input name="proposedAt" type="date" required defaultValue={applicant.offer?.proposedAt} /></label><label>응답 기한<input name="responseDueDate" type="date" required defaultValue={applicant.offer?.responseDueDate} /></label><label>오퍼 상태<select name="status" defaultValue={applicant.offer?.status ?? 'DRAFT'}><option value="DRAFT">작성 중</option><option value="SENT">제안 완료</option><option value="ACCEPTED">지원자 수락</option><option value="DECLINED">지원자 거절</option></select></label><label>변경·거절 사유<input name="reason" defaultValue={applicant.offer?.reason} /></label>
    </>)}
    {applicant.offer && <p>{applicant.offer.active === false ? '종료된 오퍼 이력' : '오퍼'}: {applicant.offer.conditions} · {OFFER_STATUS_LABELS[applicant.offer.status]} · 응답 기한 {applicant.offer.responseDueDate}</p>}
    {applicant.offer?.history?.map((offer, index) => <p key={index}>이전 오퍼: {offer.conditions} · {OFFER_STATUS_LABELS[offer.status as keyof typeof OFFER_STATUS_LABELS] ?? offer.status} · {offer.reason}</p>)}
    {form('지원 상태 관리', (data) => ({ kind: 'lifecycle', status: text(data, 'status') as NonNullable<Applicant['lifecycle']>, reason: text(data, 'reason') }), <>
      <p>철회·거절 후 재개해도 이전 오퍼와 입사 계획은 종료 기록으로 남습니다. 새 오퍼 수락과 입사 계획을 저장해 주세요. 실제 입사 후에는 지원 상태·단계와 실제 입사일을 변경할 수 없습니다.</p>
      <label>지원 상태<select name="status" defaultValue={applicant.lifecycle ?? 'ACTIVE'}><option value="ACTIVE">진행·재개</option><option value="ON_HOLD">보류</option><option value="WITHDRAWN">철회</option><option value="OFFER_DECLINED">오퍼 거절 종료</option></select></label><label>상태 변경 사유<input name="reason" required /></label>
    </>)}
    <p>지원 상태: {LIFECYCLE_LABELS[applicant.lifecycle ?? 'ACTIVE']} · {applicant.lifecycleReason}</p>
    {form('입사 관리', (data) => ({ kind: 'employment', plannedStartDate: text(data, 'plannedStartDate'), actualStartDate: text(data, 'actualStartDate') }), <>
      <p>회사 최종 합격({applicant.stage === 'HIRED' ? '완료' : '미완료'}) · 오퍼 수락({applicant.offer?.status === 'ACCEPTED' ? '완료' : '미완료'})</p><label>입사 예정일<input name="plannedStartDate" type="date" required defaultValue={applicant.employment?.plannedStartDate} /></label><label>실제 입사일<input name="actualStartDate" type="date" defaultValue={applicant.employment?.actualStartDate} /></label>
    </>)}
    {applicant.employment && <p>{applicant.employment.active === false ? '종료된 입사 계획' : '입사 예정'} {applicant.employment.plannedStartDate} · 실제 {applicant.employment.actualStartDate || '미입사'}</p>}
    {applicant.employment?.history?.map((record, index) => <p key={index}>이전 입사 계획 {record.plannedStartDate} · 실제 {record.actualStartDate || '미입사'}</p>)}
    {form('후속 업무 관리', (data) => ({ kind: 'task', id: text(data, 'id') || undefined, label: text(data, 'label'), dueDate: text(data, 'dueDate'), done: text(data, 'done') === 'true' }), <>
      <label>편집할 업무<select name="id" onChange={(event) => {
        const task = applicant.followUps?.find(({ id }) => id === event.target.value)
        for (const name of ['label', 'dueDate', 'done'] as const) (event.target.form!.elements.namedItem(name) as HTMLInputElement).value = String(task?.[name] ?? (name === 'done' ? 'false' : ''))
      }}><option value="">새 업무</option>{applicant.followUps?.map((task) => <option key={task.id} value={task.id}>{task.label} · {task.done ? '완료' : '대기'}</option>)}</select></label><label>후속 업무<input name="label" required /></label><label>후속 업무 기한<input name="dueDate" type="date" required /></label><label>완료 상태<select name="done"><option value="false">대기</option><option value="true">완료</option></select></label>
    </>)}
    {applicant.followUps?.map((task) => <p key={task.id}>{task.label} · {task.dueDate} · {task.active === false ? '종료된 업무 이력' : task.done ? '완료' : '대기'}</p>)}
    {form('보관·복원', (data) => ({ kind: 'archive', archived: text(data, 'archived') === 'true', talentPool: text(data, 'talentPool') === 'true', reconnectDate: text(data, 'reconnectDate'), reason: text(data, 'reason') }), <>
      <label>기록 보관<select name="archived" defaultValue={applicant.archivedAt ? 'true' : 'false'}><option value="false">활성 목록으로 복원</option><option value="true">종료 기록 보관</option></select></label><label>인재풀<select name="talentPool" defaultValue={applicant.talentPool ? 'true' : 'false'}><option value="false">미등록</option><option value="true">인재풀 등록</option></select></label><label>재접촉 날짜<input name="reconnectDate" type="date" defaultValue={applicant.reconnectDate} /></label><label>보관·복원 사유<input name="reason" required /></label>
    </>)}
    {form('지원 건 삭제', (data) => ({ kind: 'delete', confirmation: text(data, 'confirmation'), reason: text(data, 'reason') }), <>
      <p>보관된 지원 건 {applicant.id}와 그 연락·평가 기록을 영구 삭제합니다. 다른 지원 건은 남습니다.</p><label>삭제할 지원 건 ID 확인<input name="confirmation" required /></label><label>삭제 사유<input name="reason" required /></label>
    </>)}
    {applicant.schedule?.history?.map((schedule, index) => <p key={index}>일정 이력: {schedule.round ?? 1}회차 · {schedule.date} {schedule.startTime} · {SCHEDULE_STATUS_LABELS[schedule.status ?? 'PLANNED']}</p>)}</>
}
