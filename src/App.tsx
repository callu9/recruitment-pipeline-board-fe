import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import styles from './App.module.css'
import { useApplicantsQuery } from './features/recruitment-board/api/useApplicantsQuery'
import { useMoveApplicantStage } from './features/recruitment-board/api/useMoveApplicantStage'
import { usePositionsQuery } from './features/recruitment-board/api/usePositionsQuery'
import { APPLICANT_OWNERS, APPLICANT_ROLES, type Applicant, type ApplicantRole, type ApplicantStage, type Position } from './features/recruitment-board/model/applicant.types'
import { getAllowedNextStages, getForwardActionLabel, getLocalDateString, isTerminalStage, STAGES } from './features/recruitment-board/model/stages'
import { filterWorkspaceApplicants, getCalendarEvents, getMissingEvaluations, getPositionSummaries, getStageCounts, getTodayActionableApplicants, getTodayInterviews, getUnscheduledApplicants, getWorkspaceHeaderLabel, getWorkspaceWeekDays, isOverdue, type CalendarEvent, type WorkspaceFilters } from './features/recruitment-board/model/workspaceSelectors'

type View = 'applicants' | 'today' | 'calendar' | 'positions'
type MoveDetails = { correction?: boolean; rejectionReason?: string; rejectionMemo?: string }
type PendingConfirmation = { applicant: Applicant; targetStage: ApplicantStage; trigger: HTMLButtonElement | null; correction?: boolean }
const EMPTY_FILTERS: WorkspaceFilters = { name: '', role: 'ALL', owner: 'ALL', stage: 'ALL', noSchedule: false, overdue: false, positionId: '' }

function dateLabel(value?: string) { return value ? value.slice(5, 10).replace('-', '/') : '—' }
function fullDateLabel(value?: string) { return value ? value.replaceAll('-', '.') : '미정' }
function stageLabel(stage: ApplicantStage) { return STAGES.find(({ code }) => code === stage)?.label ?? stage }
function typeLabel(type: CalendarEvent['type']) { return { INTERVIEW: '인터뷰', EVALUATION: '평가', OFFER: '처우', START_DATE: '입사' }[type] }
function accessibleApplicantName(applicant: Applicant) { return `${applicant.name} · ${applicant.id}` }

function StatusPill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'blue' | 'green' | 'red' | 'amber' }) {
  return <span className={`${styles.pill} ${styles[`pill${tone[0].toUpperCase()}${tone.slice(1)}`]}`}>{children}</span>
}

function StageActionButtons({ applicant, isPending, onMove, onReject }: { applicant: Applicant; isPending: boolean; onMove: (stage: ApplicantStage, trigger?: HTMLButtonElement) => void; onReject: (trigger?: HTMLButtonElement) => void }) {
  const nextStage = getAllowedNextStages(applicant.stage).find((stage) => stage !== 'REJECTED')
  if (isTerminalStage(applicant.stage)) return <span className={styles.terminalLabel}>종료됨</span>
  const label = accessibleApplicantName(applicant)
  return <div className={styles.inlineMove} aria-label={`${label} 단계 액션`} aria-busy={isPending}>
    {nextStage && <button type="button" className={styles.primaryButton} aria-label={`${getForwardActionLabel(applicant.stage)} · ${label}`} disabled={isPending} onClick={(event) => onMove(nextStage, event.currentTarget)}>{isPending ? '저장 중' : getForwardActionLabel(applicant.stage)}</button>}
    <button type="button" aria-label={`불합격 처리 · ${label}`} disabled={isPending} onClick={(event) => onReject(event.currentTarget)}>불합격</button>
  </div>
}

function StageConfirmationDialog({ confirmation, onCancel, onConfirm }: { confirmation: PendingConfirmation; onCancel: () => void; onConfirm: (targetStage: ApplicantStage, details: MoveDetails) => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const onCancelRef = useRef(onCancel)
  const onConfirmRef = useRef(onConfirm)
  const finalizedRef = useRef(false)
  const [targetStage, setTargetStage] = useState<ApplicantStage>(confirmation.targetStage)
  const [rejectionReason, setRejectionReason] = useState('')
  const [rejectionMemo, setRejectionMemo] = useState('')
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
    finalizedRef.current = true
    onConfirmRef.current(targetStage, { correction: confirmation.correction, rejectionReason: rejectionReason.trim() || undefined, rejectionMemo: rejectionMemo.trim() || undefined })
  }

  return <dialog ref={dialogRef} className={styles.confirmationDialog} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); dialogRef.current?.close() }}>
    <h2 id={titleId}>{confirmation.correction ? '단계 정정 확인' : '단계 변경 확인'}</h2>
    <p><strong>{confirmation.applicant.name}</strong>님을 {stageLabel(confirmation.applicant.stage)}에서 {stageLabel(targetStage)}으로 {confirmation.correction ? '정정' : '변경'}할까요?</p>
    {confirmation.correction && <label>정정할 단계<select aria-label="정정할 단계" value={targetStage} onChange={(event) => { setTargetStage(event.target.value as ApplicantStage); setValidationError('') }}>{STAGES.filter(({ code }) => code !== confirmation.applicant.stage).map(({ code, label }) => <option value={code} key={code}>{label}</option>)}</select></label>}
    {isRejection && <><label>불합격 사유<input aria-label="불합격 사유" value={rejectionReason} required onChange={(event) => { setRejectionReason(event.target.value); setValidationError('') }} /></label><label>추가 메모 (선택)<textarea aria-label="추가 메모 (선택)" value={rejectionMemo} onChange={(event) => setRejectionMemo(event.target.value)} /></label></>}
    {validationError && <p className={styles.dialogError} role="alert">{validationError}</p>}
    <p className={styles.muted}>{confirmation.correction ? '정정 이력은 타임라인에 남습니다.' : '종료 단계로 이동하면 일반 화면에서 되돌릴 수 없습니다.'}</p>
    <form className={styles.dialogActions} onSubmit={submit}><button type="button" onClick={() => dialogRef.current?.close()}>취소</button><button type="submit" className={styles.primaryButton}>확인</button></form>
  </dialog>
}

function ApplicantDetail({ applicant, positions, onClose, onMove, onReject, onCorrection, isPending }: { applicant: Applicant; positions: Position[]; onClose: () => void; onMove: (stage: ApplicantStage, trigger?: HTMLButtonElement) => void; onReject: (trigger?: HTMLButtonElement) => void; onCorrection: (trigger?: HTMLButtonElement) => void; isPending: boolean }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const onCloseRef = useRef(onClose)
  const titleId = `detail-title-${applicant.id}`
  const positionTitle = positions.find((position) => position.id === applicant.positionId)?.title
  onCloseRef.current = onClose
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const close = () => onCloseRef.current()
    if (!dialog.open) dialog.showModal()
    dialog.addEventListener('close', close)
    dialog.querySelector<HTMLButtonElement>('button')?.focus()
    return () => dialog.removeEventListener('close', close)
  }, [])
  function close() { dialogRef.current?.close() }
  return <dialog ref={dialogRef} className={styles.detailPanel} role="dialog" aria-modal="true" aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); close() }} onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); close() } }}>
    <div className={styles.detailHeader}><div><span className={styles.eyebrow}>APPLICANT DETAIL</span><h2 id={titleId}>{applicant.name}</h2><p>{applicant.role}</p></div><button type="button" aria-label="상세 패널 닫기" onClick={close}>닫기</button></div>
    <div className={styles.detailActions}><StatusPill tone={applicant.stage === 'HIRED' ? 'green' : applicant.stage === 'REJECTED' ? 'red' : 'blue'}>{stageLabel(applicant.stage)}</StatusPill><StageActionButtons applicant={applicant} isPending={isPending} onMove={onMove} onReject={onReject} /></div>
    <div className={styles.detailActions}><span className={styles.muted}>예외적인 상태 정정</span><button type="button" onClick={(event) => onCorrection(event.currentTarget)}>단계 정정</button></div>
    <section className={styles.detailSection} aria-labelledby={`${titleId}-summary`}><h3 id={`${titleId}-summary`}>기본 정보</h3><dl className={styles.detailList}><div><dt>담당자</dt><dd>{applicant.owner ?? '미지정'}</dd></div><div><dt>포지션</dt><dd>{positionTitle ?? '미지정'}</dd></div><div><dt>지원일</dt><dd>{fullDateLabel(applicant.appliedAt.slice(0, 10))}</dd></div><div><dt>다음 액션</dt><dd>{applicant.nextAction ?? '없음'}</dd></div><div><dt>마감일</dt><dd>{fullDateLabel(applicant.dueDate)}</dd></div></dl></section>
    <section className={styles.detailSection} aria-labelledby={`${titleId}-schedule`}><h3 id={`${titleId}-schedule`}>일정</h3>{applicant.schedule ? <p>{fullDateLabel(applicant.schedule.date)} · {applicant.schedule.startTime}–{applicant.schedule.endTime}<br />{applicant.schedule.format === 'VIDEO' ? '화상 인터뷰' : '대면 인터뷰'} · {applicant.schedule.interviewer}</p> : <p className={styles.muted}>등록된 일정이 없습니다.</p>}</section>
    <section className={styles.detailSection} aria-labelledby={`${titleId}-evaluation`}><h3 id={`${titleId}-evaluation`}>평가</h3><div className={styles.evaluationList}>{(applicant.evaluations ?? []).map((evaluation) => <div className={styles.evaluation} key={evaluation.id}><span>{evaluation.type}</span><StatusPill tone={evaluation.status === 'PENDING' ? 'amber' : 'green'}>{evaluation.status === 'PENDING' ? '작성 필요' : `${evaluation.score ?? '—'}점`}</StatusPill><small>{evaluation.reviewer} · 마감 {dateLabel(evaluation.dueDate)}</small></div>)}</div></section>
    <section className={styles.detailSection} aria-labelledby={`${titleId}-notes`}><h3 id={`${titleId}-notes`}>메모</h3><p>{applicant.note || '등록된 메모가 없습니다.'}</p>{applicant.rejectionReason && <p className={styles.note}><strong>불합격 사유</strong><br />{applicant.rejectionReason}{applicant.rejectionMemo && <><br />{applicant.rejectionMemo}</>}</p>}{(applicant.notes ?? []).map((note) => <p className={styles.note} key={note.id}><strong>{note.author}</strong> · {fullDateLabel(note.createdAt)}<br />{note.text}</p>)}</section>
    <section className={styles.detailSection} aria-labelledby={`${titleId}-timeline`}><h3 id={`${titleId}-timeline`}>타임라인</h3><ol className={styles.timeline}>{(applicant.timeline ?? []).map((event) => <li key={event.id}><span>{fullDateLabel(event.at)}</span>{event.label}</li>)}</ol></section>
    <p className={styles.contact}>{applicant.email}<br />{applicant.phone}</p>
  </dialog>
}

function ApplicantsView({ applicants, filters, setFilters, onSelect, selectedId, pendingIds, onMove, onReject, positions, positionsError, refetchPositions, today }: { applicants: Applicant[]; filters: WorkspaceFilters; setFilters: (next: WorkspaceFilters) => void; onSelect: (id: string, trigger?: HTMLButtonElement) => void; selectedId: string | null; pendingIds: ReadonlySet<string>; onMove: (applicant: Applicant, stage: ApplicantStage, trigger?: HTMLButtonElement) => void; onReject: (applicant: Applicant, trigger?: HTMLButtonElement) => void; positions: Position[]; positionsError: boolean; refetchPositions: () => Promise<unknown>; today: string }) {
  const baseFiltered = filterWorkspaceApplicants(applicants, { ...filters, stage: 'ALL' }, today); const filtered = filterWorkspaceApplicants(applicants, filters, today); const counts = getStageCounts(baseFiltered); const update = (key: keyof WorkspaceFilters, value: string | boolean) => setFilters({ ...filters, [key]: value })
  return <section className={styles.view} aria-labelledby="applicants-heading"><div className={styles.viewHeader}><div><span className={styles.eyebrow}>PIPELINE</span><h2 id="applicants-heading">지원자</h2><p>채용 단계와 다음 액션을 한 화면에서 관리합니다.</p></div><StatusPill>{filtered.length}명 표시</StatusPill></div>
    {positionsError && <div className={styles.inlineError} role="alert"><span>포지션 정보를 불러오지 못했습니다. 포지션 필터를 사용할 수 없습니다.</span><button type="button" onClick={() => void refetchPositions()}>포지션 정보 다시 시도</button></div>}
    <div className={styles.filters} aria-label="지원자 필터"><label>이름 검색<input value={filters.name} placeholder="이름 또는 키워드" onChange={(event) => update('name', event.target.value)} /></label><label>직무<select value={filters.role} onChange={(event) => update('role', event.target.value as ApplicantRole | 'ALL')}><option value="ALL">전체 직무</option>{APPLICANT_ROLES.map((role) => <option key={role}>{role}</option>)}</select></label><label>담당자<select value={filters.owner} onChange={(event) => update('owner', event.target.value)}><option value="ALL">전체 담당자</option>{APPLICANT_OWNERS.map((owner) => <option key={owner}>{owner}</option>)}</select></label><label>포지션<select disabled={positionsError} value={filters.positionId} onChange={(event) => update('positionId', event.target.value)}><option value="">전체 포지션</option>{positions.map((position) => <option key={position.id} value={position.id}>{position.title}</option>)}</select></label><label className={styles.checkLabel}><input type="checkbox" checked={filters.noSchedule} onChange={(event) => update('noSchedule', event.target.checked)} /> 일정 없음</label><label className={styles.checkLabel}><input type="checkbox" checked={filters.overdue} onChange={(event) => update('overdue', event.target.checked)} /> 지연됨</label><button type="button" className={styles.textButton} onClick={() => setFilters(EMPTY_FILTERS)}>필터 초기화</button></div>
    <nav className={styles.stageTabs} aria-label="단계별 지원자 필터"><button type="button" className={filters.stage === 'ALL' ? styles.activeTab : ''} onClick={() => update('stage', 'ALL')}>전체 <span>{baseFiltered.length}</span></button>{STAGES.map((stage) => <button type="button" key={stage.code} className={filters.stage === stage.code ? styles.activeTab : ''} onClick={() => update('stage', stage.code)}>{stage.label} <span>{counts[stage.code]}</span></button>)}</nav>
    {filtered.length === 0 ? <div className={styles.emptyState}><h3>조건에 맞는 지원자가 없습니다.</h3><p>{fullDateLabel(today)} 기준 검색어나 필터를 초기화해 다시 확인하세요.</p><button type="button" onClick={() => setFilters(EMPTY_FILTERS)}>필터 초기화</button></div> : <div className={styles.tableWrap}><table className={styles.applicantTable}><caption className={styles.srOnly}>지원자 목록</caption><thead><tr><th scope="col">지원자</th><th scope="col">단계</th><th scope="col">담당자</th><th scope="col">다음 액션</th><th scope="col">일정</th><th scope="col"><span className={styles.srOnly}>액션</span></th></tr></thead><tbody>{filtered.map((applicant) => { const label = accessibleApplicantName(applicant); return <tr key={applicant.id} className={selectedId === applicant.id ? styles.selectedRow : ''}><td><button type="button" className={styles.nameButton} aria-label={`지원자 상세 보기: ${label}`} aria-pressed={selectedId === applicant.id} onClick={(event) => onSelect(applicant.id, event.currentTarget)}><strong>{applicant.name}</strong><span>{applicant.role} · 지원 {dateLabel(applicant.appliedAt)}</span></button></td><td><StatusPill tone={applicant.stage === 'HIRED' ? 'green' : applicant.stage === 'REJECTED' ? 'red' : 'blue'}>{stageLabel(applicant.stage)}</StatusPill></td><td>{applicant.owner ?? '미지정'}</td><td><span className={isOverdue(applicant, today) ? styles.overdue : ''}>{applicant.nextAction ?? '없음'}</span><small>{fullDateLabel(applicant.dueDate)}</small></td><td>{applicant.schedule ? <><strong>{dateLabel(applicant.schedule.date)}</strong><small>{applicant.schedule.startTime} · {applicant.schedule.format === 'VIDEO' ? '화상' : '대면'}</small></> : <span className={styles.muted}>미정</span>}</td><td><StageActionButtons applicant={applicant} isPending={pendingIds.has(applicant.id)} onMove={(stage, trigger) => onMove(applicant, stage, trigger)} onReject={(trigger) => onReject(applicant, trigger)} /></td></tr> })}</tbody></table></div>}
  </section>
}

function TodayView({ applicants, onSelect, today }: { applicants: Applicant[]; onSelect: (id: string, trigger?: HTMLButtonElement) => void; today: string }) {
  const interviews = getTodayInterviews(applicants, today); const evaluations = getMissingEvaluations(applicants); const overdue = applicants.filter((applicant) => isOverdue(applicant, today)); const unscheduled = getUnscheduledApplicants(applicants); const actionable = getTodayActionableApplicants(applicants, today)
  const queue = (title: string, items: Applicant[]) => <section className={styles.queueSection}><div className={styles.sectionHeading}><h3>{title}</h3><StatusPill>{items.length}</StatusPill></div>{items.length === 0 ? <p className={styles.muted}>현재 항목이 없습니다.</p> : <div className={styles.queue}>{items.map((applicant) => { const label = accessibleApplicantName(applicant); return <div className={styles.queueItem} key={applicant.id}><div><button type="button" className={styles.nameButton} aria-label={`지원자 상세 보기: ${label}`} onClick={(event) => onSelect(applicant.id, event.currentTarget)}><strong>{applicant.name}</strong><span>{applicant.role} · {applicant.owner ?? '미지정'}</span></button></div><div className={styles.queueMeta}>{applicant.schedule ? `${dateLabel(applicant.schedule.date)} ${applicant.schedule.startTime}` : fullDateLabel(applicant.dueDate)}<button type="button" aria-label={`상세 보기: ${label}`} onClick={(event) => onSelect(applicant.id, event.currentTarget)}>상세 보기</button></div></div> })}</div>}</section>
  return <section className={styles.view} aria-labelledby="today-heading"><div className={styles.viewHeader}><div><span className={styles.eyebrow}>DAILY OPERATIONS · {fullDateLabel(today)}</span><h2 id="today-heading">Today</h2><p>오늘 처리해야 할 인터뷰와 후속 액션입니다.</p></div><StatusPill tone="blue">{actionable.length} actionable</StatusPill></div><div className={styles.todayGrid}>{queue('오늘의 인터뷰', interviews)}{queue('평가 작성 필요', evaluations)}{queue('기한 초과', overdue)}{queue('일정 미정', unscheduled)}</div></section>
}

function CalendarView({ applicants, onSelect, today }: { applicants: Applicant[]; onSelect: (id: string, trigger?: HTMLButtonElement) => void; today: string }) {
  const [type, setType] = useState<'ALL' | CalendarEvent['type']>('ALL'); const [role, setRole] = useState<ApplicantRole | 'ALL'>('ALL'); const [owner, setOwner] = useState('ALL'); const events = useMemo(() => getCalendarEvents(applicants).filter((event) => (type === 'ALL' || event.type === type) && (role === 'ALL' || event.role === role) && (owner === 'ALL' || event.owner === owner)), [applicants, owner, role, type]); const weekDays = getWorkspaceWeekDays(today); const unscheduled = getUnscheduledApplicants(applicants)
  return <section className={styles.view} aria-labelledby="calendar-heading"><div className={styles.viewHeader}><div><span className={styles.eyebrow}>SCHEDULE</span><h2 id="calendar-heading">Calendar</h2><p>{fullDateLabel(weekDays[0])}–{fullDateLabel(weekDays[6])} 인터뷰, 평가, 처우 일정입니다.</p></div><div className={styles.calendarFilters}><select aria-label="이벤트 유형 필터" value={type} onChange={(event) => setType(event.target.value as typeof type)}><option value="ALL">모든 유형</option>{(['INTERVIEW', 'EVALUATION', 'OFFER', 'START_DATE'] as const).map((value) => <option key={value} value={value}>{typeLabel(value)}</option>)}</select><select aria-label="캘린더 직무 필터" value={role} onChange={(event) => setRole(event.target.value as typeof role)}><option value="ALL">모든 직무</option>{APPLICANT_ROLES.map((value) => <option key={value}>{value}</option>)}</select><select aria-label="캘린더 담당자 필터" value={owner} onChange={(event) => setOwner(event.target.value)}><option value="ALL">모든 담당자</option>{APPLICANT_OWNERS.map((value) => <option key={value}>{value}</option>)}</select></div></div><div className={styles.calendarGrid}>{weekDays.map((day) => <section className={styles.calendarDay} key={day} aria-label={fullDateLabel(day)}><header><strong>{dateLabel(day)}</strong><span>{new Date(`${day}T00:00:00`).toLocaleDateString('ko-KR', { weekday: 'short' })}</span></header>{events.filter((event) => event.date === day).map((event) => <button type="button" key={event.id} className={`${styles.calendarEvent} ${styles[`event${event.type}`]}`} aria-label={`${event.applicantName} ${event.label} · ${event.applicantId}`} onClick={(clickEvent) => onSelect(event.applicantId, clickEvent.currentTarget)}><strong>{event.time}</strong><span>{event.applicantName}</span><small>{event.label}</small></button>)}</section>)}</div><section className={styles.unscheduled}><div className={styles.sectionHeading}><h3>일정 미정</h3><StatusPill>{unscheduled.length}</StatusPill></div><div className={styles.chipList}>{unscheduled.map((applicant) => <button type="button" key={applicant.id} aria-label={`일정 미정 상세 보기: ${accessibleApplicantName(applicant)}`} onClick={(event) => onSelect(applicant.id, event.currentTarget)}>{applicant.name} · {applicant.role}</button>)}</div></section></section>
}

function PositionsView({ positions, applicants, onNavigate, today }: { positions: Position[]; applicants: Applicant[]; onNavigate: (positionId: string) => void; today: string }) {
  const summaries = getPositionSummaries(positions, applicants)
  return <section className={styles.view} aria-labelledby="positions-heading"><div className={styles.viewHeader}><div><span className={styles.eyebrow}>HEADCOUNT</span><h2 id="positions-heading">Positions</h2><p>포지션별 채용 목표와 파이프라인 현황입니다.</p></div><StatusPill>{positions.length} positions</StatusPill></div><div className={styles.tableWrap}><table className={styles.positionsTable}><caption className={styles.srOnly}>포지션 목록</caption><thead><tr><th>포지션</th><th>충원 현황</th><th>파이프라인</th><th>마감일</th><th>상태</th><th /></tr></thead><tbody>{summaries.map((position) => <tr key={position.id}><td><strong>{position.title}</strong><small>{position.department} · {position.role}</small></td><td><strong>{position.hiredCount} / {position.requiredCount}</strong><small>합격 / 목표</small></td><td>{position.activeCount}명</td><td className={position.deadline < today ? styles.overdue : ''}>{fullDateLabel(position.deadline)}</td><td><StatusPill tone={position.status === 'OPEN' ? 'green' : position.status === 'PAUSED' ? 'amber' : 'neutral'}>{position.status === 'OPEN' ? '채용 중' : position.status === 'PAUSED' ? '일시 중지' : '마감'}</StatusPill></td><td><button type="button" className={styles.textButton} onClick={() => onNavigate(position.id)}>지원자 보기</button></td></tr>)}</tbody></table></div></section>
}

function App() {
  const { data: applicants = [], isPending: applicantsPending, isError: applicantsError, refetch: refetchApplicants } = useApplicantsQuery(); const { data: positions = [], isPending: positionsPending, isError: positionsError, refetch: refetchPositions } = usePositionsQuery(); const [view, setView] = useState<View>('applicants'); const [filters, setFilters] = useState<WorkspaceFilters>(EMPTY_FILTERS); const [selectedId, setSelectedId] = useState<string | null>(null); const [confirmation, setConfirmation] = useState<PendingConfirmation | null>(null); const [feedbackError, setFeedbackError] = useState<{ applicantId: string; message: string } | null>(null); const [feedbackSuccess, setFeedbackSuccess] = useState(''); const [retryingApplicants, setRetryingApplicants] = useState(false); const today = getLocalDateString(); const detailTrigger = useRef<HTMLButtonElement | null>(null)
  const { move, pendingIds } = useMoveApplicantStage({ onError: (applicant) => setFeedbackError({ applicantId: applicant?.id ?? '', message: `${applicant?.name ?? '지원자'}님의 단계 저장에 실패해 이전 상태로 복원했습니다.` }), onSuccess: (applicant) => { setFeedbackError((current) => current?.applicantId === applicant.id ? null : current); setFeedbackSuccess(`${applicant.name}님을 ${stageLabel(applicant.stage)}으로 이동했습니다.`) } })
  const selectedApplicant = applicants.find((applicant) => applicant.id === selectedId); const activeApplicants = applicants.filter(({ stage }) => !isTerminalStage(stage)); const todayInterviews = getTodayInterviews(applicants, today); const missingEvaluations = getMissingEvaluations(applicants); const todayActionable = getTodayActionableApplicants(applicants, today)
  function selectApplicant(id: string, trigger?: HTMLButtonElement) { if (selectedId === id) { setSelectedId(null); trigger?.focus(); return } detailTrigger.current = trigger ?? null; setSelectedId(id) }
  function requestMove(applicant: Applicant, targetStage: ApplicantStage, trigger?: HTMLButtonElement, correction = false) { if (targetStage === 'HIRED' || targetStage === 'REJECTED' || correction) setConfirmation({ applicant, targetStage, trigger: trigger ?? null, correction }); else move(applicant.id, targetStage) }
  function requestReject(applicant: Applicant, trigger?: HTMLButtonElement) { requestMove(applicant, 'REJECTED', trigger) }
  function requestCorrection(applicant: Applicant, trigger?: HTMLButtonElement) { const target = STAGES.find(({ code }) => code !== applicant.stage)?.code; if (target) requestMove(applicant, target, trigger, true) }
  function confirmMove(targetStage: ApplicantStage, details: MoveDetails) { if (!confirmation) return; const { applicant } = confirmation; setConfirmation(null); move(applicant.id, targetStage, details) }
  function cancelMove() { const trigger = confirmation?.trigger; setConfirmation(null); trigger?.focus() }
  function closeDetail() { const trigger = detailTrigger.current; detailTrigger.current = null; setSelectedId(null); trigger?.focus() }
  function navigateToPosition(positionId: string) { setFilters({ ...EMPTY_FILTERS, positionId }); setView('applicants') }
  async function retryApplicants() { await refetchApplicants({ cancelRefetch: false }); setRetryingApplicants(false) }
  const tabs: Array<{ id: View; label: string; count: number }> = [{ id: 'applicants', label: 'Applicants', count: applicants.length }, { id: 'today', label: 'Today', count: todayActionable.length }, { id: 'calendar', label: 'Calendar', count: getCalendarEvents(applicants).length }, { id: 'positions', label: 'Positions', count: positions.length }]
  if (applicantsPending && !retryingApplicants) return <main className={styles.shell}><div className={styles.loadingState} aria-busy="true" role="status"><span className={styles.eyebrow}>RECRUITMENT WORKSPACE</span><h1>지원자 정보를 불러오는 중입니다.</h1><p>채용 운영 데이터를 준비하고 있습니다.</p></div></main>
  if (applicantsError || retryingApplicants) return <main className={styles.shell}><div className={styles.errorState} role="alert" aria-busy={retryingApplicants}><h1>지원자 정보를 불러오지 못했습니다.</h1><p>잠시 후 다시 시도해 주세요.</p><button type="button" disabled={retryingApplicants} onClick={() => { setRetryingApplicants(true); void retryApplicants() }}>다시 시도</button></div></main>
  if (applicants.length === 0) return <main className={styles.shell}><div className={styles.emptyState}><h1>등록된 지원자가 없습니다.</h1><p>데이터가 준비되면 이곳에서 채용 운영을 시작할 수 있습니다.</p></div></main>
  return <main className={styles.shell}><header className={styles.appHeader}><div><span className={styles.eyebrow}>RECRUITMENT OPERATIONS</span><h1>Workspace</h1></div><div className={styles.headerMeta}><span>{getWorkspaceHeaderLabel(today)}</span><span className={styles.liveDot}>● Live data</span></div></header><nav className={styles.mainTabs} aria-label="워크스페이스 메뉴">{tabs.map((tab) => <button type="button" key={tab.id} className={view === tab.id ? styles.activeMainTab : ''} onClick={() => setView(tab.id)}>{tab.label}<span>{tab.count}</span></button>)}</nav><section className={styles.metrics} aria-label="요약 지표"><Metric label="전체 지원자" value={applicants.length} detail="전체 파이프라인" /><Metric label="진행 중" value={activeApplicants.length} detail="종료 단계 제외" /><Metric label="오늘 인터뷰" value={todayInterviews.length} detail={fullDateLabel(today)} /><Metric label="평가 대기" value={missingEvaluations.length} detail="후속 조치 필요" /><Metric label="최종합격" value={applicants.filter(({ stage }) => stage === 'HIRED').length} detail="입사 전환 대상" /></section>{feedbackError && <p className={`${styles.feedback} ${styles.feedbackError}`} role="alert">{feedbackError.message}</p>}{feedbackSuccess && <p className={`${styles.feedback} ${styles.feedbackSuccess}`} role="status">{feedbackSuccess}</p>}{view === 'applicants' && <ApplicantsView applicants={applicants} filters={filters} setFilters={setFilters} onSelect={selectApplicant} selectedId={selectedId} pendingIds={pendingIds} onMove={requestMove} onReject={requestReject} positions={positions} positionsError={positionsError} refetchPositions={refetchPositions} today={today} />}{view === 'today' && <TodayView applicants={applicants} onSelect={selectApplicant} today={today} />}{view === 'calendar' && <CalendarView applicants={applicants} onSelect={selectApplicant} today={today} />}{view === 'positions' && (positionsError ? <div className={styles.errorState} role="alert"><h2>포지션 정보를 불러오지 못했습니다.</h2><button type="button" onClick={() => void refetchPositions()}>다시 시도</button></div> : positionsPending ? <div className={styles.loadingState} role="status" aria-busy="true"><h2>포지션 정보를 불러오는 중입니다.</h2></div> : <PositionsView positions={positions} applicants={applicants} onNavigate={navigateToPosition} today={today} />)}{selectedApplicant && <ApplicantDetail applicant={selectedApplicant} positions={positions} onClose={closeDetail} onMove={(stage, trigger) => requestMove(selectedApplicant, stage, trigger)} onReject={(trigger) => requestReject(selectedApplicant, trigger)} onCorrection={(trigger) => requestCorrection(selectedApplicant, trigger)} isPending={pendingIds.has(selectedApplicant.id)} />}{confirmation && <StageConfirmationDialog confirmation={confirmation} onCancel={cancelMove} onConfirm={confirmMove} />}</main>
}

function Metric({ label, value, detail }: { label: string; value: number; detail: string }) { return <article className={styles.metric}><p>{label}</p><strong>{value}</strong><span>{detail}</span></article> }
export default App
