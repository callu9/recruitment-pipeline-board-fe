import { getApplicantWork, isSupportWork, type ApplicantWorkTarget } from './features/recruitment-board/model/applicantWork'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { formatWorkspaceDueDate } from './features/recruitment-board/model/workspaceSelectors'
import { EVALUATION_TYPE_LABELS } from './features/recruitment-board/model/stages'
import { Button } from '@/components/ui/button'
import { useWorkspaceNavigation } from './features/recruitment-board/model/useWorkspaceNavigation'
import { RecruitmentInsights } from './RecruitmentInsights'
import { RecruitmentManagement } from './RecruitmentManagement'
import { ApplicantOperations } from './ApplicantOperations'
import { useApplicantOperation } from './features/recruitment-board/api/useApplicantOperation'
import { personKey, getTransitionIssues, type ApplicantOperation } from './features/recruitment-board/model/operations'
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import styles from './App.module.css'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'
import { ApplicantsView, StageActionButtons } from './features/recruitment-board/components/ApplicantsView'
import { useApplicantsQuery } from './features/recruitment-board/api/useApplicantsQuery'
import { useMoveApplicantStage } from './features/recruitment-board/api/useMoveApplicantStage'
import { usePositionsQuery } from './features/recruitment-board/api/usePositionsQuery'
import { useSubmitApplicantFeedback } from './features/recruitment-board/api/useSubmitApplicantFeedback'
import { SCHEDULE_STATUS_LABELS, APPLICANT_OWNERS, APPLICANT_ROLES, type Applicant, type ApplicantEvaluation, type ApplicantOwner, type ApplicantRole, type ApplicantStage, type EvaluationType, type Position, type SubmitApplicantFeedbackRequest } from './features/recruitment-board/model/applicant.types'
import { getLocalDateString, STAGES } from './features/recruitment-board/model/stages'
import { EMPTY_FILTERS, isArchiveOrTalentPool, isActiveEvaluation, isCurrentInterviewSchedule, filterWorkspaceApplicants, sortWorkspaceApplicants, type ApplicantSort, paginateApplicants, type ApplicantPageSize, getCalendarEvents, getMissingEvaluations, getPositionSummaries, getTodayActionableApplicants, getDueOfferResponses, getDueStartConfirmations, getWorkDueDates, isPendingFollowUp, getTodayInterviews, getUnscheduledApplicants, getWorkspaceHeaderLabel, getWorkspaceWeekDays, isOverdue, isRecruiting, type CalendarEvent, type WorkspaceFilters } from './features/recruitment-board/model/workspaceSelectors'

import type { View } from './features/recruitment-board/model/useWorkspaceNavigation'
type MoveDetails = { actor?: ApplicantOwner; overrideReason?: string; correction?: boolean; rejectionReason?: string; rejectionMemo?: string }
type PendingConfirmation = { applicant: Applicant; targetStage: ApplicantStage; trigger: HTMLButtonElement | null; correction?: boolean; warnings?: string[] }

function dateLabel(value?: string) { return value ? getLocalDateString(value).replaceAll('-', '.') : '미정' }
function fullDateLabel(value?: string) { return value ? getLocalDateString(value).replaceAll('-', '.') : '미정' }
function stageLabel(stage: ApplicantStage) { return STAGES.find(({ code }) => code === stage)?.label ?? stage }
function stageLabelForEvaluation(type: EvaluationType) { return EVALUATION_TYPE_LABELS[type] }
function typeLabel(type: CalendarEvent['type']) { return { INTERVIEW: '인터뷰', EVALUATION: '평가', OFFER: '처우', START_DATE: '입사', FOLLOW_UP: '후속 업무' }[type] }
function accessibleApplicantName(applicant: Applicant) { return `${applicant.name} · ${applicant.id}` }

function StatusPill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'blue' | 'green' | 'red' | 'amber' }) {
  return <span className={`${styles.pill} ${styles[`pill${tone[0].toUpperCase()}${tone.slice(1)}`]}`}>{children}</span>
}

function StageConfirmationDialog({ confirmation, onCancel, onConfirm }: { confirmation: PendingConfirmation; onCancel: () => void; onConfirm: (targetStage: ApplicantStage, details: MoveDetails) => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const onCancelRef = useRef(onCancel)
  const onConfirmRef = useRef(onConfirm)
  const finalizedRef = useRef(false)
  const [targetStage, setTargetStage] = useState<ApplicantStage>(confirmation.targetStage)
  const [rejectionReason, setRejectionReason] = useState('')
  const [rejectionMemo, setRejectionMemo] = useState('')
  const [overrideReason, setOverrideReason] = useState('')
  const [validationError, setValidationError] = useState('')
  const titleId = `confirm-stage-${confirmation.applicant.id}`
  onCancelRef.current = onCancel
  onConfirmRef.current = onConfirm

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const close = () => { if (!finalizedRef.current) { finalizedRef.current = true; onCancelRef.current() } }
    if (!dialog.open) dialog.showModal()
    dialog.addEventListener('close', close)
    dialog.querySelector<HTMLButtonElement>('button')?.focus()
    return () => dialog.removeEventListener('close', close)
  }, [])

  const isRejection = targetStage === 'REJECTED'
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isRejection && !rejectionReason.trim()) { setValidationError('불합격 사유를 입력해 주세요.'); return }
    if (confirmation.warnings?.length && !overrideReason.trim()) { setValidationError('미완료 업무를 확인한 진행 사유를 입력해 주세요.'); return }
    finalizedRef.current = true
    onConfirmRef.current(targetStage, { correction: confirmation.correction, overrideReason: overrideReason.trim() || undefined, rejectionReason: rejectionReason.trim() || undefined, rejectionMemo: rejectionMemo.trim() || undefined })
  }

  return <dialog ref={dialogRef} className={styles.confirmationDialog} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); dialogRef.current?.close() }}>
    <form onSubmit={submit} noValidate>
    <h2 id={titleId}>{confirmation.correction ? '단계 정정 확인' : '단계 변경 확인'}</h2>
    <p><strong>{confirmation.applicant.name}</strong>님을 {stageLabel(confirmation.applicant.stage)}에서 {stageLabel(targetStage)}으로 {confirmation.correction ? '정정' : '변경'}할까요?</p>
    {confirmation.correction && <label>정정할 단계<NativeSelect aria-label="정정할 단계" value={targetStage} onChange={(event) => { setTargetStage(event.target.value as ApplicantStage); setValidationError('') }}>{STAGES.filter(({ code }) => code !== confirmation.applicant.stage).map(({ code, label }) => <NativeSelectOption value={code} key={code}>{label}</NativeSelectOption>)}</NativeSelect></label>}
    {isRejection && <><label>불합격 사유<Input aria-label="불합격 사유" value={rejectionReason} required onChange={(event) => { setRejectionReason(event.target.value); setValidationError('') }} /></label><label>추가 메모 (선택)<textarea aria-label="추가 메모 (선택)" value={rejectionMemo} onChange={(event) => setRejectionMemo(event.target.value)} /></label></>}
    {confirmation.warnings?.length ? <><ul>{confirmation.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul><label>미완료 업무 확인 및 진행 사유<Input required value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} /></label></> : null}
    {validationError && <p className={styles.dialogError} role="alert">{validationError}</p>}
    <p className={styles.muted}>{confirmation.correction ? '정정 이력은 타임라인에 남습니다.' : '종료 단계로 이동하면 일반 화면에서 되돌릴 수 없습니다.'}</p>
    <div className={styles.dialogActions}><Button type="button" variant="outline" onClick={() => dialogRef.current?.close()}>취소</Button><Button type="submit" variant={isRejection ? 'destructive' : 'default'}>확인</Button></div>
    </form>
  </dialog>
}

function FeedbackForm({ evaluation, isPending, error, onSubmit }: {
  evaluation: ApplicantEvaluation
  isPending: boolean
  error?: string
  onSubmit: (values: SubmitApplicantFeedbackRequest) => void
}) {
  const draftKey = `recruitment-feedback-draft:${evaluation.id}`
  const [draft] = useState(() => { try { return JSON.parse(sessionStorage.getItem(draftKey) ?? 'null') as { reviewer?: ApplicantOwner; score?: string; comment?: string; correctionReason?: string } | null } catch { return null } })
  const [draftError, setDraftError] = useState(false)
  const [editing, setEditing] = useState(evaluation.status === 'PENDING')
  const [correctionReason, setCorrectionReason] = useState(draft?.correctionReason ?? '')
  const [reviewer, setReviewer] = useState<ApplicantOwner>(draft?.reviewer ?? evaluation.reviewer)
  const [score, setScore] = useState(draft?.score ?? evaluation.score?.toString() ?? '')
  const [comment, setComment] = useState(draft?.comment ?? evaluation.comment ?? '')

  function persistDraft(next: { reviewer: ApplicantOwner; score: string; comment: string; correctionReason: string }) {
    try { sessionStorage.setItem(draftKey, JSON.stringify(next)); setDraftError(false) } catch { setDraftError(true) }
  }
  if (!editing) return <button type="button" disabled={isPending} onClick={() => setEditing(true)}>평가 정정</button>
  return <form className={styles.feedbackForm} aria-label={`${stageLabelForEvaluation(evaluation.type)} 피드백`} data-draft-error={draftError || undefined} aria-busy={isPending} onSubmit={(event) => {
    event.preventDefault()
    onSubmit({ reviewer, score: Number(score), comment, correctionReason: correctionReason.trim() || undefined })
  }}>
    <label>평가자<NativeSelect value={reviewer} disabled={isPending} onChange={(event) => { setReviewer(event.target.value as ApplicantOwner); persistDraft({ reviewer: event.target.value as ApplicantOwner, score, comment, correctionReason }) }}>{APPLICANT_OWNERS.map((owner) => <NativeSelectOption key={owner}>{owner}</NativeSelectOption>)}</NativeSelect></label>
    <label>점수<Input type="number" min="0" max="100" required value={score} disabled={isPending} onChange={(event) => { setScore(event.target.value); persistDraft({ reviewer, score: event.target.value, comment, correctionReason }) }} /></label>
    <label>코멘트<textarea required value={comment} disabled={isPending} onChange={(event) => { setComment(event.target.value); persistDraft({ reviewer, score, comment: event.target.value, correctionReason }) }} /></label>
    {evaluation.status === 'SUBMITTED' && <label>평가 정정 사유<Input required value={correctionReason} onChange={(event) => { setCorrectionReason(event.target.value); persistDraft({ reviewer, score, comment, correctionReason: event.target.value }) }} /></label>}
    {draftError && <p role="alert">초안 저장 공간이 부족합니다. 창을 닫기 전에 평가를 저장해 주세요.</p>}
    <small>초안은 이 탭에 보관되어 상세를 다시 열면 이어서 작성할 수 있습니다.</small>
    {error && <p role="alert">{error}</p>}
    <Button type="submit" disabled={isPending}>{isPending ? '저장 중' : '피드백 저장'}</Button>
  </form>
}

function ApplicantDetail({ initialTarget, applicant, positions, onClose, onMove, onReject, onCorrection, onSubmitFeedback, isPending, feedbackPending, feedbackError, actor, onOperation, applications, onRelatedSelect }: { initialTarget?: ApplicantWorkTarget; applications: Applicant[]; onRelatedSelect: (id: string) => void; actor: ApplicantOwner; onOperation: (operation: ApplicantOperation, actor: ApplicantOwner) => Promise<string | null>; applicant: Applicant; positions: Position[]; onClose: () => void; onMove: (stage: ApplicantStage, trigger?: HTMLButtonElement) => void; onReject: (trigger?: HTMLButtonElement) => void; onCorrection: (trigger?: HTMLButtonElement) => void; onSubmitFeedback: (evaluationId: string, values: SubmitApplicantFeedbackRequest) => void; isPending: boolean; feedbackPending: boolean; feedbackError?: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const onCloseRef = useRef(onClose)
  const titleId = `detail-title-${applicant.id}`
  const positionTitle = positions.find((position) => position.id === applicant.positionId)?.title
  const work = getApplicantWork(applicant)
  const [pane, setPane] = useState<'work' | 'support' | 'history'>(initialTarget && isSupportWork(initialTarget) ? 'support' : 'work')
  onCloseRef.current = onClose
  function focusWork(target: ApplicantWorkTarget) {
    const dialog = dialogRef.current
    if (!dialog) return
    const section = target === 'evaluation' ? dialog.querySelector<HTMLElement>('[data-work-target="evaluation"] [data-current-work="true"]') : target === 'progress' ? dialog.querySelector<HTMLElement>('[aria-label="현재 채용 단계"]') : dialog.querySelector<HTMLElement>(`[data-operation-title="${target}"]`)
    if (section instanceof HTMLDetailsElement) section.open = true
    const control = section?.querySelector<HTMLElement>('input:not(:disabled),select:not(:disabled),textarea:not(:disabled),button:not(:disabled)')
    control?.focus({ preventScroll: true })
    section?.scrollIntoView?.({ block: 'nearest' })
  }
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const close = () => onCloseRef.current()
    if (!dialog.open) dialog.show()
    dialog.addEventListener('close', close)
    dialog.querySelector<HTMLButtonElement>('button')?.focus()
    if (initialTarget) focusWork(initialTarget)
    return () => dialog.removeEventListener('close', close)
  }, [initialTarget])
  function canLeave() { return !dialogRef.current?.querySelector('[data-draft-error="true"]') || window.confirm('초안을 보관하지 못했습니다. 작성 내용을 버리고 이동할까요?') }
  function close() { if (canLeave()) dialogRef.current?.close() }
  function openWork() { setPane(isSupportWork(work.target) ? 'support' : 'work'); requestAnimationFrame(() => focusWork(work.target)) }
  return <dialog ref={dialogRef} className={styles.detailPanel} role="dialog" aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); close() }} onKeyDown={(event) => { if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); close() } }}>
    <div className={styles.detailHeader}><div><span className={styles.eyebrow}>APPLICANT DETAIL</span><h2 id={titleId}>{applicant.name}</h2><p>{applicant.role}</p></div><Button type="button" variant="outline" aria-label="상세 패널 닫기" onClick={close}>닫기</Button></div>
    <p className={styles.muted}>{positionTitle ?? '포지션 미지정'} · 담당 {applicant.owner ?? '미지정'}</p>
    <div role="tablist" aria-label="지원자 상세 영역" className={styles.detailTabs}>{([['work', '업무'], ['support', '지원 정보'], ['history', '이력']] as const).map(([value, label], index) => <Button key={value} id={`${titleId}-tab-${value}`} role="tab" aria-selected={pane === value} aria-controls={`${titleId}-pane-${value}`} tabIndex={pane === value ? 0 : -1} variant={pane === value ? 'secondary' : 'ghost'} onClick={() => setPane(value)} onKeyDown={(event) => {
      const values = ['work', 'support', 'history'] as const
      const next = event.key === 'ArrowRight' ? (index + 1) % 3 : event.key === 'ArrowLeft' ? (index + 2) % 3 : event.key === 'Home' ? 0 : event.key === 'End' ? 2 : -1
      if (next < 0) return
      event.preventDefault(); setPane(values[next]); document.getElementById(`${titleId}-tab-${values[next]}`)?.focus()
    }}>{label}</Button>)}</div>
    <div role="tabpanel" id={`${titleId}-pane-work`} aria-labelledby={`${titleId}-tab-work`} hidden={pane !== 'work'}>
      <section className={styles.workSummary}><h3>{work.label}</h3><p>{work.reason}</p><p>{formatWorkspaceDueDate(work.dueDate, Boolean(work.dueDate))}</p><Button type="button" disabled={isPending} onClick={openWork}>{work.label}</Button></section>
    <section data-work-target="evaluation" className={styles.detailSection} aria-labelledby={`${titleId}-evaluation`}><h3 id={`${titleId}-evaluation`}>평가</h3><div className={styles.evaluationList}>{(applicant.evaluations ?? []).map((evaluation) => <div data-current-work={isActiveEvaluation(applicant, evaluation) && evaluation.status === "PENDING" && evaluation.dueDate === work.dueDate || undefined} className={styles.evaluation} key={evaluation.id}>
      <span>{EVALUATION_TYPE_LABELS[evaluation.type]}</span>
      <StatusPill tone={evaluation.status === 'PENDING' ? 'amber' : 'green'}>{evaluation.status === 'PENDING' ? '작성 필요' : `${evaluation.score ?? '—'}점`}</StatusPill>
      <small>{evaluation.reviewer} · {evaluation.submittedAt ? `작성 ${fullDateLabel(evaluation.submittedAt)}` : `마감 ${dateLabel(evaluation.dueDate)}`}</small>
      {evaluation.comment && <p className={styles.evaluationComment}>{evaluation.comment}</p>}
      {evaluation.active === false && <small>이전 단계 기록 · 운영 큐에서 제외</small>}
      <FeedbackForm key={`${evaluation.id}:${evaluation.submittedAt ?? ''}:${evaluation.score ?? ''}`} evaluation={evaluation} isPending={feedbackPending} error={feedbackError} onSubmit={(values) => onSubmitFeedback(evaluation.id, values)} />
      {evaluation.revisions?.map((revision, index) => <p key={index}>이전 평가: {revision.score}점 · {revision.reviewer} · {revision.comment} · 정정 사유: {revision.reason}</p>)}
    </div>)}</div></section>
    <section className={styles.detailSection} aria-labelledby={`${titleId}-schedule`}><h3 id={`${titleId}-schedule`}>{applicant.schedule && !isCurrentInterviewSchedule(applicant) ? '이전 면접 일정' : '일정'}</h3>{applicant.schedule ? <p>{fullDateLabel(applicant.schedule.date)} · {applicant.schedule.startTime}–{applicant.schedule.endTime}<br />{applicant.schedule.format === 'VIDEO' ? '화상 인터뷰' : '대면 인터뷰'} · {applicant.schedule.interviewer} · {SCHEDULE_STATUS_LABELS[applicant.schedule.status ?? 'PLANNED']}</p> : <p className={styles.muted}>등록된 일정이 없습니다.</p>}</section>
    <div className={styles.detailActions} role="group" aria-label="현재 채용 단계"><StatusPill tone={applicant.stage === 'HIRED' ? 'green' : applicant.stage === 'REJECTED' ? 'red' : 'blue'}>{stageLabel(applicant.stage)}</StatusPill><StageActionButtons secondary applicant={applicant} isPending={isPending} onMove={onMove} onReject={onReject} /></div>
    </div>
    <div role="tabpanel" id={`${titleId}-pane-support`} aria-labelledby={`${titleId}-tab-support`} hidden={pane !== 'support'}>
    <div className={styles.detailActions}><span className={styles.muted}>예외적인 상태 정정</span><Button type="button" variant="outline" onClick={(event) => onCorrection(event.currentTarget)}>단계 정정</Button></div>
    <section className={styles.detailSection}><h3>동일인의 지원 건</h3><details><summary>기술 식별정보</summary><p>사람: {personKey(applicant)} · 지원 건: {applicant.id}</p></details>{applications.filter((item) => personKey(item) === personKey(applicant)).map((item) => <p key={item.id}><Button variant="outline" type="button" aria-label={`연결 지원 보기: ${item.name} · ${item.id}`} disabled={item.id === applicant.id} onClick={() => onRelatedSelect(item.id)}>{item.name} · {positions.find((position) => position.id === item.positionId)?.title ?? '미지정'} · {stageLabel(item.stage)} · {fullDateLabel(item.appliedAt)}{item.previousApplicationId && ' · 재지원'}</Button></p>)}</section>
    <section className={styles.detailSection}><h3>포지션별 전형 기준</h3><p>{positions.find((position) => position.id === applicant.positionId)?.evaluationCriteria || '공통 기준: 평가자·점수·근거 코멘트'}</p><p>과제: {positions.find((position) => position.id === applicant.positionId)?.assignment || '없음'}</p><p>필요 면접 회차: {positions.find((position) => position.id === applicant.positionId)?.requiredInterviewRounds ?? 1}</p><p>JD: {positions.find((position) => position.id === applicant.positionId)?.description || '미등록'}</p></section>
    <section className={styles.detailSection} aria-labelledby={`${titleId}-summary`}><h3 id={`${titleId}-summary`}>기본 정보</h3><dl className={styles.detailList}><div><dt>담당자</dt><dd>{applicant.owner ?? '미지정'}</dd></div><div><dt>포지션</dt><dd>{positionTitle ?? '미지정'}</dd></div><div><dt>지원일</dt><dd>{fullDateLabel(applicant.appliedAt)}</dd></div><div><dt>다음 액션</dt><dd>{applicant.nextAction ?? '없음'}</dd></div><div><dt>마감일</dt><dd>{formatWorkspaceDueDate(applicant.dueDate, isRecruiting(applicant))}</dd></div></dl></section>
    </div>
    <div hidden={pane === 'history'}><ApplicantOperations pane={pane === 'support' ? 'support' : 'work'} positions={positions} applicant={applicant} actor={actor} pending={isPending} save={onOperation} /></div>
    <div role="tabpanel" id={`${titleId}-pane-history`} aria-labelledby={`${titleId}-tab-history`} hidden={pane !== 'history'}>
    <section className={styles.detailSection} aria-labelledby={`${titleId}-notes`}><h3 id={`${titleId}-notes`}>메모</h3><p>{applicant.note || '등록된 메모가 없습니다.'}</p>{applicant.rejectionReason && <p className={styles.note}><strong>불합격 사유</strong><br />{applicant.rejectionReason}{applicant.rejectionMemo && <><br />{applicant.rejectionMemo}</>}</p>}{(applicant.notes ?? []).map((note) => <p className={styles.note} key={note.id}><strong>{note.author}</strong> · {fullDateLabel(note.createdAt)}<br />{note.text}</p>)}</section>
    <section className={styles.detailSection} aria-labelledby={`${titleId}-timeline`}><h3 id={`${titleId}-timeline`}>타임라인</h3><ol className={styles.timeline}>{(applicant.timeline ?? []).map((event) => <li key={event.id}><span>{fullDateLabel(event.at)}</span>{event.label}{event.rejectionReason && ` · 사유: ${event.rejectionReason}`}{event.rejectionMemo && ` · ${event.rejectionMemo}`}{event.actor && ` · 처리자: ${event.actor}`}{event.reason && ` · ${event.reason}`}</li>)}</ol></section>
    <p className={styles.contact}>{applicant.email}<br />{applicant.phone}</p>    </div>
  </dialog>
}

function TodayView({ applicants, onSelect, today }: { applicants: Applicant[]; onSelect: (id: string, trigger?: HTMLButtonElement, target?: ApplicantWorkTarget) => void; today: string }) {
  const interviews = getTodayInterviews(applicants, today); const evaluations = getMissingEvaluations(applicants); const overdue = applicants.filter((applicant) => isOverdue(applicant, today)); const unscheduled = getUnscheduledApplicants(applicants); const actionable = getTodayActionableApplicants(applicants, today)
  const queue = (title: string, items: Applicant[], meta: (applicant: Applicant) => ReactNode = (applicant) => formatWorkspaceDueDate(getWorkDueDates(applicant)[0], isRecruiting(applicant), today)) => <section className={styles.queueSection}><div className={styles.sectionHeading}><h3>{title}</h3><StatusPill>{items.length}명</StatusPill></div>{items.length === 0 ? <p className={styles.muted}>현재 항목이 없습니다.</p> : <div className={styles.queue}>{items.map((applicant) => { const label = accessibleApplicantName(applicant); return <div className={styles.queueItem} key={applicant.id}><div><button type="button" className={styles.nameButton} aria-label={`지원자 상세 보기: ${label}`} onClick={(event) => onSelect(applicant.id, event.currentTarget)}><strong>{applicant.name}</strong><span>{applicant.role} · {applicant.owner ?? '미지정'}</span></button></div><div className={styles.queueMeta}>{meta(applicant)}<Button type="button" aria-label={`상세 보기: ${label}`} onClick={(event) => onSelect(applicant.id, event.currentTarget, getApplicantWork(applicant, today).target)}>{getApplicantWork(applicant, today).label}</Button></div></div> })}</div>}</section>
  return <section className={styles.view} aria-labelledby="today-heading"><div className={styles.viewHeader}><div><span className={styles.eyebrow}>DAILY OPERATIONS · {fullDateLabel(today)}</span><h2 id="today-heading">오늘 할 일</h2><p>같은 지원자가 여러 업무에 표시될 수 있습니다. 처리 대상은 중복 없는 인원입니다.</p></div><StatusPill tone="blue">{actionable.length}명 처리 대상</StatusPill></div><div className={styles.todayGrid}>{queue('오늘의 인터뷰', interviews, (applicant) => `${dateLabel(applicant.schedule!.date)} ${applicant.schedule!.startTime}`)}{queue('평가 작성 필요', evaluations)}{queue('기한 초과', overdue)}{queue('일정 미정', unscheduled)}{queue('오퍼 응답 확인', getDueOfferResponses(applicants, today), (applicant) => fullDateLabel(applicant.offer!.responseDueDate))}{queue('입사 확인', getDueStartConfirmations(applicants, today), (applicant) => fullDateLabel(applicant.employment!.plannedStartDate))}{queue('통보·인계 후속 업무', applicants.filter((applicant) => applicant.followUps?.some((task) => isPendingFollowUp(applicant, task))))}{queue('인재풀 재접촉', applicants.filter((applicant) => applicant.talentPool && applicant.reconnectDate && applicant.reconnectDate <= today))}</div></section>
}

function CalendarView({ applicants, onSelect, today }: { applicants: Applicant[]; onSelect: (id: string, trigger?: HTMLButtonElement) => void; today: string }) {
  const [type, setType] = useState<'ALL' | CalendarEvent['type']>('ALL'); const [role, setRole] = useState<ApplicantRole | 'ALL'>('ALL'); const [owner, setOwner] = useState('ALL'); const events = useMemo(() => getCalendarEvents(applicants).filter((event) => (type === 'ALL' || event.type === type) && (role === 'ALL' || event.role === role) && (owner === 'ALL' || event.owner === owner)), [applicants, owner, role, type]); const [calendarStart, setCalendarStart] = useState(today); const weekDays = getWorkspaceWeekDays(calendarStart); const unscheduled = getUnscheduledApplicants(applicants).filter((applicant) => (type === 'ALL' || type === 'INTERVIEW') && (role === 'ALL' || applicant.role === role) && (owner === 'ALL' || applicant.owner === owner))
  return <section className={styles.view} aria-labelledby="calendar-heading"><div className={styles.viewHeader}><div><span className={styles.eyebrow}>SCHEDULE</span><h2 id="calendar-heading">캘린더</h2><p>{fullDateLabel(weekDays[0])}–{fullDateLabel(weekDays[6])} 인터뷰, 평가, 처우 일정입니다.</p></div><div className={styles.calendarFilters}><label>표시 시작일<Input type="date" value={calendarStart} onChange={(event) => { if (event.target.value) setCalendarStart(event.target.value) }} /></label><Button variant="outline" type="button" onClick={() => setCalendarStart(getLocalDateString(new Date(new Date(`${calendarStart}T12:00:00`).setDate(new Date(`${calendarStart}T12:00:00`).getDate() + 7))))}>다음 주</Button><Button variant="outline" type="button" onClick={() => { const date = new Date(`${calendarStart}T12:00:00`); date.setDate(date.getDate() - 7); setCalendarStart(getLocalDateString(date)) }}>이전 주</Button><Button variant="outline" type="button" onClick={() => setCalendarStart(today)}>오늘</Button><NativeSelect aria-label="이벤트 유형 필터" value={type} onChange={(event) => setType(event.target.value as typeof type)}><NativeSelectOption value="ALL">모든 유형</NativeSelectOption>{(['INTERVIEW', 'EVALUATION', 'OFFER', 'START_DATE', 'FOLLOW_UP'] as const).map((value) => <NativeSelectOption key={value} value={value}>{typeLabel(value)}</NativeSelectOption>)}</NativeSelect><NativeSelect aria-label="캘린더 직무 필터" value={role} onChange={(event) => setRole(event.target.value as typeof role)}><NativeSelectOption value="ALL">모든 직무</NativeSelectOption>{APPLICANT_ROLES.map((value) => <NativeSelectOption key={value}>{value}</NativeSelectOption>)}</NativeSelect><NativeSelect aria-label="캘린더 담당자 필터" value={owner} onChange={(event) => setOwner(event.target.value)}><NativeSelectOption value="ALL">모든 담당자</NativeSelectOption>{APPLICANT_OWNERS.map((value) => <NativeSelectOption key={value}>{value}</NativeSelectOption>)}</NativeSelect></div></div><div className={styles.calendarGrid}>{weekDays.map((day) => <section className={styles.calendarDay} key={day} aria-label={fullDateLabel(day)}><header><strong>{dateLabel(day)}</strong><span>{new Date(`${day}T00:00:00`).toLocaleDateString('ko-KR', { weekday: 'short' })}</span></header>{events.filter((event) => event.date === day).map((event) => <button type="button" key={event.id} className={`${styles.calendarEvent} ${styles[`event${event.type}`]}`} aria-label={`${event.applicantName} ${event.label} · ${event.applicantId}`} onClick={(clickEvent) => onSelect(event.applicantId, clickEvent.currentTarget)}><strong>{event.time}</strong><span>{event.applicantName}</span><small>{event.label}</small></button>)}</section>)}</div><section className={styles.unscheduled}><div className={styles.sectionHeading}><h3>일정 미정</h3><StatusPill>{unscheduled.length}</StatusPill></div><div className={styles.chipList}>{unscheduled.map((applicant) => <Button variant="outline" type="button" key={applicant.id} aria-label={`일정 미정 상세 보기: ${accessibleApplicantName(applicant)}`} onClick={(event) => onSelect(applicant.id, event.currentTarget)}>{applicant.name} · {applicant.role}</Button>)}</div></section></section>
}

function PositionsView({ positions, applicants, onNavigate, today }: { positions: Position[]; applicants: Applicant[]; onNavigate: (positionId: string) => void; today: string }) {
  const summaries = getPositionSummaries(positions, applicants)
  return <section className={styles.view} aria-labelledby="positions-heading"><div className={styles.viewHeader}><div><span className={styles.eyebrow}>HEADCOUNT</span><h2 id="positions-heading">포지션</h2><p>포지션별 채용 목표와 파이프라인 현황입니다.</p></div><StatusPill>{positions.length}개 포지션</StatusPill></div><div className={styles.tableWrap}><table className={styles.positionsTable}><caption className={styles.srOnly}>포지션 목록</caption><thead><tr><th>포지션</th><th>충원 현황</th><th>파이프라인</th><th>마감일</th><th>상태</th><th /></tr></thead><tbody>{summaries.map((position) => <tr key={position.id}><td><strong>{position.title}</strong><small>{position.department} · {position.role}</small></td><td><strong>{position.hiredCount} / {position.requiredCount}</strong><small>합격 / 목표</small></td><td>{position.activeCount}명</td><td className={position.deadline < today ? styles.overdue : ''}>{fullDateLabel(position.deadline)}</td><td><StatusPill tone={position.status === 'OPEN' ? 'green' : position.status === 'PAUSED' ? 'amber' : 'neutral'}>{position.status === 'OPEN' ? '채용 중' : position.status === 'PAUSED' ? '일시 중지' : '마감'}</StatusPill></td><td><Button variant="link" type="button" onClick={() => onNavigate(position.id)}>지원자 보기</Button></td></tr>)}</tbody></table></div></section>
}

function IntakeDialog({ open, children, onClose }: { open: boolean; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const dialog = ref.current!
    if (!open) { if (dialog.open) dialog.close(); return }
    const closed = () => closeRef.current()
    dialog.showModal(); dialog.addEventListener('close', closed)
    const intake = dialog.querySelector<HTMLDetailsElement>('details')
    if (intake) intake.open = true
    dialog.querySelector<HTMLInputElement>('input')?.focus()
    return () => dialog.removeEventListener('close', closed)
  }, [open])
  function close() { if (!ref.current?.querySelector('[data-draft-error="true"]') || window.confirm('초안을 보관하지 못했습니다. 작성 내용을 버리고 이동할까요?')) ref.current?.close() }
  return <dialog ref={ref} data-intake-open={open} className={styles.intakeDialog} aria-labelledby="intake-heading" onCancel={(event) => { event.preventDefault(); close() }} onKeyDown={(event) => { if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); close() } }}><header className={styles.detailHeader}><h2 id="intake-heading">지원 접수 및 가져오기</h2><Button variant="outline" type="button" onClick={close} aria-label="접수 창 닫기">닫기</Button></header>{children}</dialog>
}
function canLeaveWorkspaceDraft() { return !document.querySelector('dialog [data-draft-error="true"]') || window.confirm('초안을 보관하지 못했습니다. 작성 내용을 버리고 이동할까요?') }

function App() {
  const { data: applicants = [], isPending: applicantsPending, isError: applicantsError, refetch: refetchApplicants } = useApplicantsQuery(); const { data: positions = [], isPending: positionsPending, isError: positionsError, refetch: refetchPositions } = usePositionsQuery(); const [intakeOpen, setIntakeOpen] = useState(false); const intakeTrigger = useRef<HTMLButtonElement | null>(null); const [detailRequest, setDetailRequest] = useState<{ target?: ApplicantWorkTarget; sequence: number }>({ sequence: 0 }); const [confirmation, setConfirmation] = useState<PendingConfirmation | null>(null); const cancelHistoryConfirmation = useCallback(() => { setConfirmation(null); setIntakeOpen(false) }, []); const { view, filters, sort, page, pageSize, selectedId, setView, setFilters, setSort, setPage, setPageSize, setSelectedId, navigate } = useWorkspaceNavigation(cancelHistoryConfirmation); const [feedbackSaveError, setFeedbackSaveError] = useState<{ applicantId: string; evaluationId: string; message: string } | null>(null); const [retryingApplicants, setRetryingApplicants] = useState(false); const today = getLocalDateString(); const detailTrigger = useRef<HTMLButtonElement | null>(null); const applicantsHeading = useRef<HTMLHeadingElement | null>(null); const restoreTrigger = useRef<{ trigger: HTMLButtonElement | null } | null>(null)
  const [actor, setActor] = useState<ApplicantOwner>('김하나')
  const { save: saveOperation, pendingIds: operationPendingIds } = useApplicantOperation()
  useEffect(() => {
    const protectDraft = (event: BeforeUnloadEvent) => { if (document.querySelector('[data-draft-error="true"]')) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', protectDraft)
    return () => window.removeEventListener('beforeunload', protectDraft)
  }, [])
  const toasterId = useId()
  const { move, pendingIds } = useMoveApplicantStage({
    onError: (applicant) => toast.error(`${applicant?.name ?? '지원자'} · ${applicant?.id ?? ''}님의 단계 저장에 실패해 이전 상태로 복원했습니다.`, { id: `${toasterId}-stage-${applicant?.id}`, toasterId, duration: Infinity }),
    onSuccess: (applicant) => toast.success(`${applicant.name}님을 ${stageLabel(applicant.stage)}으로 이동했습니다.`, { id: `${toasterId}-stage-${applicant.id}`, toasterId, duration: 4000 }),
  })
  const { submitFeedback, pendingIds: feedbackPendingIds } = useSubmitApplicantFeedback({
    onError: ({ applicantId, evaluationId }) => setFeedbackSaveError({ applicantId, evaluationId, message: '피드백을 저장하지 못했습니다. 다시 시도해 주세요.' }),
    onSuccess: (applicant, { evaluationId }) => {
      try { sessionStorage.removeItem(`recruitment-feedback-draft:${evaluationId}`) } catch { /* The confirmed save remains successful if draft cleanup is unavailable. */ }
      setFeedbackSaveError((current) => current?.applicantId === applicant.id && current.evaluationId === evaluationId ? null : current)
      toast.success(`${applicant.name}님의 피드백을 저장했습니다.`, { id: `${toasterId}-feedback-${applicant.id}`, toasterId, duration: 4000 })
    },
  })
  const selectedApplicant = applicants.find((applicant) => applicant.id === selectedId); const activeApplicants = applicants.filter(isRecruiting); const todayInterviews = getTodayInterviews(applicants, today); const missingEvaluations = getMissingEvaluations(applicants); const todayActionable = getTodayActionableApplicants(applicants, today)
  const visibleApplicants = applicants.filter((applicant) => view === 'archive' ? isArchiveOrTalentPool(applicant) : !applicant.archivedAt)
  const pagination = paginateApplicants(sortWorkspaceApplicants(filterWorkspaceApplicants(visibleApplicants, filters, today), sort, today), page, pageSize)
  useLayoutEffect(() => { if (!applicantsPending && !applicantsError && page !== pagination.page) setPage(pagination.page) }, [applicantsPending, applicantsError, page, pagination.page, setPage])
  const previousSelection = useRef(selectedId)
  useLayoutEffect(() => {
    if (previousSelection.current && !selectedId && !restoreTrigger.current) {
      restoreTrigger.current = { trigger: detailTrigger.current }
      detailTrigger.current = null
    }
    previousSelection.current = selectedId
    if (!restoreTrigger.current || confirmation) return
    const { trigger } = restoreTrigger.current
    restoreTrigger.current = null
    if (trigger?.isConnected) trigger.focus()
    else if (selectedApplicant) document.querySelector<HTMLButtonElement>('[aria-label="상세 패널 닫기"]')?.focus()
    else if (view === 'applicants') applicantsHeading.current?.focus({ preventScroll: true })
  })
  function updateFilters(next: WorkspaceFilters) { setFilters(next); setPage(1) }
  function updateSort(next: ApplicantSort) { setSort(next); setPage(1) }
  function updatePageSize(size: ApplicantPageSize) { setPageSize(size); setPage(1) }
  const busyApplicantIds = new Set([...pendingIds, ...feedbackPendingIds, ...operationPendingIds])
  function selectApplicant(id: string, trigger?: HTMLButtonElement, target?: ApplicantWorkTarget) { if (!canLeaveWorkspaceDraft()) return; if (selectedId === id && !target) { closeDetail(); return } detailTrigger.current = trigger ?? null; setDetailRequest((current) => ({ target, sequence: current.sequence + 1 })); setSelectedId(id) }
  function requestMove(applicant: Applicant, targetStage: ApplicantStage, trigger?: HTMLButtonElement, correction = false) {
    const issues = getTransitionIssues(applicant, targetStage, positions)
    if (issues.blockers.length) { toast.error(issues.blockers.join(' '), { toasterId }); return }
    if (targetStage === 'HIRED' || targetStage === 'REJECTED' || correction || issues.warnings.length) setConfirmation({ applicant, targetStage, trigger: trigger ?? null, correction, warnings: correction ? [] : issues.warnings })
    else move(applicant.id, targetStage, { actor })
  }
  function requestReject(applicant: Applicant, trigger?: HTMLButtonElement) { requestMove(applicant, 'REJECTED', trigger) }
  function requestCorrection(applicant: Applicant, trigger?: HTMLButtonElement) { const target = STAGES.find(({ code }) => code !== applicant.stage)?.code; if (target) requestMove(applicant, target, trigger, true) }
  function confirmMove(targetStage: ApplicantStage, details: MoveDetails) { if (!confirmation) return; const { applicant, trigger } = confirmation; restoreTrigger.current = { trigger }; setConfirmation(null); move(applicant.id, targetStage, { ...details, actor }) }
  function cancelMove() { restoreTrigger.current = { trigger: confirmation?.trigger ?? null }; setConfirmation(null) }
  function closeDetail() { const trigger = detailTrigger.current; detailTrigger.current = null; restoreTrigger.current = { trigger }; setSelectedId(null) }
  async function operateSelected(operation: ApplicantOperation, selectedActor: ApplicantOwner) {
    if (!selectedApplicant) return '지원자를 찾을 수 없습니다.'
    const problem = await saveOperation(selectedApplicant.id, operation, selectedActor)
    if (!problem && operation.kind === 'delete') closeDetail()
    return problem
  }
  function navigateToPosition(positionId: string) { if (!canLeaveWorkspaceDraft()) return; navigate({ view: 'applicants', filters: { ...EMPTY_FILTERS, positionId }, page: 1, selectedId: null }) }
  async function retryApplicants() { await refetchApplicants({ cancelRefetch: false }); setRetryingApplicants(false) }
  const tabs: Array<{ id: View; label: string; count: number; unit: string }> = [{ id: 'applicants', label: '지원자', count: applicants.length, unit: '명' }, { id: 'today', label: '오늘 할 일', count: todayActionable.length, unit: '명' }, { id: 'calendar', label: '캘린더', count: getCalendarEvents(applicants).length, unit: '건' }, { id: 'positions', label: '포지션', count: positions.length, unit: '개' }, { id: 'insights', label: '기록 분석', count: applicants.filter((applicant) => applicant.timeline?.some((event) => event.fromStage)).length, unit: '명' }, { id: 'archive', label: '보관·인재풀', count: applicants.filter(isArchiveOrTalentPool).length, unit: '명' }]
  if (applicantsPending && !retryingApplicants) return <main className={styles.shell}><div className={styles.loadingState} aria-busy="true" role="status"><h1>지원자 정보를 불러오는 중입니다.</h1><p>채용 운영 데이터를 준비하고 있습니다.</p></div></main>
  if (applicantsError || retryingApplicants) return <main className={styles.shell}><div className={styles.errorState} role="alert" aria-busy={retryingApplicants}><h1>지원자 정보를 불러오지 못했습니다.</h1><p>잠시 후 다시 시도해 주세요.</p><Button variant="outline" type="button" disabled={retryingApplicants} onClick={() => { setRetryingApplicants(true); void retryApplicants() }}>다시 시도</Button></div></main>
  return <main className={styles.shell}><header className={styles.appHeader}><h1 className={styles.workspaceTitle}>채용 관리</h1><div className={styles.headerMeta}><span>{getWorkspaceHeaderLabel(today)}</span><label>로컬 처리자<NativeSelect value={actor} onChange={(event) => setActor(event.target.value as ApplicantOwner)}>{APPLICANT_OWNERS.map((owner) => <NativeSelectOption key={owner}>{owner}</NativeSelectOption>)}</NativeSelect></label><span className={styles.liveDot}>● 이 브라우저의 로컬 데이터 · 인증/공유 없음</span></div></header><nav className={styles.mainTabs} aria-label="워크스페이스 메뉴">{tabs.map((tab) => <button type="button" key={tab.id} className={view === tab.id ? styles.activeMainTab : ''} aria-current={view === tab.id ? "page" : undefined} onClick={() => { if (canLeaveWorkspaceDraft()) setView(tab.id) }}>{tab.label}<span>{tab.count}{tab.unit}</span></button>)}</nav><div className={`${styles.workspaceBody} ${selectedApplicant ? styles.hasDetail : ""}`}><div className={styles.workspaceContent}>{view !== 'applicants' && <section className={styles.metrics} aria-label="요약 지표"><Metric label="전체 지원자" value={applicants.length} detail="전체 파이프라인" /><Metric label="진행 중" value={activeApplicants.length} detail="종료 단계 제외" /><Metric label="오늘 인터뷰" value={todayInterviews.length} detail={fullDateLabel(today)} /><Metric label="평가 대기" value={missingEvaluations.length} detail="후속 조치 필요" /><Metric label="최종합격" value={applicants.filter(({ stage }) => stage === 'HIRED').length} detail="입사 전환 대상" /></section>}{view === 'positions' && <RecruitmentManagement actor={actor} positions={positions} applicants={applicants} mode="positions" />}{view === 'applicants' && applicants.length === 0 && <div className={styles.emptyState}><h1>등록된 지원자가 없습니다.</h1><Button type="button" onClick={(event) => { intakeTrigger.current = event.currentTarget; setIntakeOpen(true) }}>지원 접수</Button><p>지원 접수 또는 가져오기로 채용 운영을 시작하세요.</p></div>}{(view === 'applicants' && applicants.length > 0 || view === 'archive') && <ApplicantsView onIntake={view === "applicants" ? (trigger) => { intakeTrigger.current = trigger; setIntakeOpen(true) } : undefined} emptyContext={view === 'archive' ? 'archive' : 'applicants'} applicants={visibleApplicants} pagination={pagination} pageSize={pageSize} sort={sort} onSortChange={updateSort} onPageChange={setPage} onPageSizeChange={updatePageSize} headingRef={applicantsHeading} hasOpenDialog={Boolean(selectedApplicant || confirmation)} filters={filters} setFilters={updateFilters} onSelect={selectApplicant} selectedId={selectedId} pendingIds={busyApplicantIds} onMove={requestMove} onReject={requestReject} positions={positions} positionsError={positionsError} refetchPositions={refetchPositions} today={today} />}{view === 'insights' && <RecruitmentInsights applicants={applicants} />}{view === 'today' && <TodayView applicants={applicants} onSelect={selectApplicant} today={today} />}{view === 'calendar' && <CalendarView applicants={applicants} onSelect={selectApplicant} today={today} />}{view === 'positions' && (positionsError ? <div className={styles.errorState} role="alert"><h2>포지션 정보를 불러오지 못했습니다.</h2><Button variant="outline" type="button" onClick={() => void refetchPositions()}>다시 시도</Button></div> : positionsPending ? <div className={styles.loadingState} role="status" aria-busy="true"><h2>포지션 정보를 불러오는 중입니다.</h2></div> : <PositionsView positions={positions} applicants={applicants} onNavigate={navigateToPosition} today={today} />)} </div>{selectedApplicant && <ApplicantDetail initialTarget={detailRequest.target} key={`${selectedApplicant.id}:${detailRequest.sequence}`} applications={applicants} onRelatedSelect={(id) => selectApplicant(id)} actor={actor} onOperation={operateSelected} applicant={selectedApplicant} positions={positions} onClose={closeDetail} onMove={(stage, trigger) => requestMove(selectedApplicant, stage, trigger)} onReject={(trigger) => requestReject(selectedApplicant, trigger)} onCorrection={(trigger) => requestCorrection(selectedApplicant, trigger)} onSubmitFeedback={(evaluationId, values) => { setFeedbackSaveError(null); submitFeedback(selectedApplicant.id, evaluationId, { ...values, actor }) }} isPending={busyApplicantIds.has(selectedApplicant.id)} feedbackPending={busyApplicantIds.has(selectedApplicant.id)} feedbackError={feedbackSaveError?.applicantId === selectedApplicant.id && selectedApplicant.evaluations?.some(({ id }) => id === feedbackSaveError.evaluationId) ? feedbackSaveError.message : undefined} />}</div><IntakeDialog open={intakeOpen} onClose={() => { setIntakeOpen(false); queueMicrotask(() => intakeTrigger.current?.isConnected && intakeTrigger.current.focus()) }}><RecruitmentManagement actor={actor} positions={positions} applicants={applicants} mode="intake" /></IntakeDialog>{confirmation && <StageConfirmationDialog confirmation={confirmation} onCancel={cancelMove} onConfirm={confirmMove} />}<MutationToaster id={toasterId} modalKey={`${selectedId ?? ""}:${detailRequest.sequence}:${confirmation?.applicant.id ?? ""}:${intakeOpen}`} /></main>
}

function MutationToaster({ id, modalKey }: { id: string; modalKey: string }) {
  const [host] = useState(() => document.createElement('div'))
  useLayoutEffect(() => {
    // Native dialog's top layer covers body portals; move the same host without remounting Sonner.
    const dialogs = document.querySelectorAll('dialog:not([data-intake-open="false"])')
    ;(dialogs.item(dialogs.length - 1) ?? document.body).append(host)
    return () => host.remove()
  }, [host, modalKey])
  return createPortal(<Toaster id={id} position="bottom-right" duration={4000} expand closeButton toastOptions={{ closeButtonAriaLabel: "알림 닫기" }} containerAriaLabel="작업 알림" mobileOffset={16} />, host)
}

function Metric({ label, value, detail }: { label: string; value: number; detail: string }) { return <article className={styles.metric}><p>{label}</p><strong>{value}</strong><span>{detail}</span></article> }
export default App
