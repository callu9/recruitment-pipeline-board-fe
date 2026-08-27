import { useEffect, useRef, useState, type FormEvent } from 'react'
import styles from './App.module.css'
import { useApplicantsQuery } from './features/recruitment-board/api/useApplicantsQuery'
import { useMoveApplicantStage } from './features/recruitment-board/api/useMoveApplicantStage'
import { filterApplicants, getApplicantRoles, groupApplicantsByStage } from './features/recruitment-board/model/applicantSelectors'
import { getAllowedNextStages, STAGES } from './features/recruitment-board/model/stages'
import type { Applicant, ApplicantRole, ApplicantStage } from './features/recruitment-board/model/applicant.types'

function StageMoveForm({ applicant, isPending, onConfirmRequest }: {
  applicant: Applicant
  isPending: boolean
  onConfirmRequest: (stage: ApplicantStage, trigger: HTMLButtonElement) => void
}) {
  const [targetStage, setTargetStage] = useState<ApplicantStage | ''>('')
  const allowedNextStages = getAllowedNextStages(applicant.stage)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!targetStage || targetStage === applicant.stage) return
    const trigger = event.currentTarget.querySelector<HTMLButtonElement>('button[type="submit"]')
    if (trigger) onConfirmRequest(targetStage, trigger)
  }

  return (
    <form className={styles.moveForm} aria-label={`${applicant.name} 단계 이동`} aria-busy={isPending} onSubmit={handleSubmit}>
      <label>
        이동할 단계
        <select disabled={isPending} value={targetStage} onChange={(event) => setTargetStage(event.target.value as ApplicantStage)}>
          <option value="">단계 선택</option>
          {STAGES.filter(({ code }) => allowedNextStages.includes(code)).map((stage) => (
            <option key={stage.code} value={stage.code}>
              {stage.label}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={!targetStage || isPending}>
        이동
      </button>
    </form>
  )
}

function StageChangeConfirmationDialog({ applicant, targetStage, onCancel, onConfirm }: {
  applicant: Applicant
  targetStage: ApplicantStage
  onCancel: () => void
  onConfirm: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const currentStage = STAGES.find((stage) => stage.code === applicant.stage)
  const nextStage = STAGES.find((stage) => stage.code === targetStage)
  const titleId = `stage-change-confirmation-${applicant.id}`

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (!dialog.open) dialog.showModal()
    dialog.addEventListener('close', onCancel)
    return () => dialog.removeEventListener('close', onCancel)
  }, [onCancel])

  return (
    <dialog
      ref={dialogRef}
      className={styles.confirmationDialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        dialogRef.current?.close()
      }}
    >
      <h2 id={titleId}>{applicant.name} 단계 변경 확인</h2>
      <p>현재 단계: {currentStage?.label}</p>
      <p>변경 단계: {nextStage?.label}</p>
      <div className={styles.confirmationActions}>
        <button type="button" onClick={() => dialogRef.current?.close()}>취소</button>
        <button type="button" onClick={onConfirm}>확인</button>
      </div>
    </dialog>
  )
}

function ApplicantDetailDialog({ applicant, onClose }: { applicant: Applicant; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const stage = STAGES.find((current) => current.code === applicant.stage)
  const titleId = `applicant-detail-${applicant.id}`
  const summaryTitleId = `${titleId}-summary`
  const contactTitleId = `${titleId}-contact`
  const experienceTitleId = `${titleId}-experience`
  const noteTitleId = `${titleId}-note`

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (!dialog.open) dialog.showModal()
    dialog.addEventListener('close', onClose)
    return () => dialog.removeEventListener('close', onClose)
  }, [onClose])

  return (
    <dialog
      ref={dialogRef}
      className={styles.detailDialog}
      data-stage={applicant.stage}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        dialogRef.current?.close()
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return
        event.preventDefault()
        dialogRef.current?.close()
      }}
    >
      <header className={styles.detailHeader}>
        <h2 id={titleId}>{applicant.name} 상세 정보</h2>
        <button type="button" onClick={() => dialogRef.current?.close()}>닫기</button>
      </header>
      <div className={styles.detailContent}>
        <section className={styles.detailSection} aria-labelledby={summaryTitleId}>
          <h3 id={summaryTitleId}>핵심 지원자 정보</h3>
          <dl className={styles.detailList}>
            <div><dt>직무</dt><dd>{applicant.role}</dd></div>
            <div><dt>지원일</dt><dd>{applicant.appliedAt.slice(0, 10).replaceAll('-', '.')}</dd></div>
            <div><dt>현재 단계</dt><dd className={styles.stageTag}>{stage?.label}</dd></div>
          </dl>
        </section>
        <section className={styles.detailSection} aria-labelledby={contactTitleId}>
          <h3 id={contactTitleId}>연락처</h3>
          <dl className={styles.detailList}>
            <div><dt>이메일</dt><dd>{applicant.email}</dd></div>
            <div><dt>전화번호</dt><dd>{applicant.phone}</dd></div>
          </dl>
        </section>
        <section className={styles.detailSection} aria-labelledby={experienceTitleId}>
          <h3 id={experienceTitleId}>경력·기술</h3>
          <dl className={styles.detailList}>
            <div><dt>경력 연차</dt><dd>{applicant.experienceYears}년</dd></div>
            <div><dt>주요 기술</dt><dd>{applicant.skills.join(', ')}</dd></div>
          </dl>
        </section>
        <section className={styles.detailSection} aria-labelledby={noteTitleId}>
          <h3 id={noteTitleId}>메모</h3>
          <p className={styles.detailNote}>{applicant.note}</p>
        </section>
      </div>
    </dialog>
  )
}

function App() {
  const { data: applicants = [], isPending, isError, refetch } = useApplicantsQuery()
  const [nameQuery, setNameQuery] = useState('')
  const [role, setRole] = useState<ApplicantRole | 'ALL'>('ALL')
  const [selectedApplicantId, setSelectedApplicantId] = useState<string | null>(null)
  const [stageChangeConfirmation, setStageChangeConfirmation] = useState<{ applicantId: string; targetStage: ApplicantStage } | null>(null)
  const [moveSuccess, setMoveSuccess] = useState('')
  const [moveError, setMoveError] = useState('')
  const { move, pendingIds } = useMoveApplicantStage({
    onError: () => setMoveError('단계 이동을 저장하지 못해 이전 상태로 복원했습니다.'),
    onSuccess: (applicant) => {
      const targetStage = STAGES.find((stage) => stage.code === applicant.stage)
      if (targetStage) setMoveSuccess(`${applicant.name}님을 ${targetStage.label}(으)로 이동했습니다.`)
    },
  })
  const detailTriggerRef = useRef<HTMLButtonElement>(null)
  const confirmationTriggerRef = useRef<HTMLButtonElement>(null)
  const boardViewportRef = useRef<HTMLDivElement>(null)
  const detailScrollPositionRef = useRef({ left: 0, top: 0 })
  const filteredApplicants = filterApplicants(applicants, { nameQuery, role })
  const applicantsByStage = groupApplicantsByStage(filteredApplicants)
  const roles = getApplicantRoles(applicants)
  const selectedApplicant = applicants.find((applicant) => applicant.id === selectedApplicantId)
  const confirmationApplicant = applicants.find((applicant) => applicant.id === stageChangeConfirmation?.applicantId)

  function closeDetail() {
    setSelectedApplicantId(null)
    detailTriggerRef.current?.focus()
    const board = boardViewportRef.current
    if (board) {
      board.scrollLeft = detailScrollPositionRef.current.left
      board.scrollTop = detailScrollPositionRef.current.top
    }
  }

  function resetFilters() {
    setNameQuery('')
    setRole('ALL')
  }

  function cancelStageChangeConfirmation() {
    setStageChangeConfirmation(null)
    confirmationTriggerRef.current?.focus()
  }

  function confirmStageChange() {
    const confirmation = stageChangeConfirmation
    setStageChangeConfirmation(null)
    if (confirmation) move(confirmation.applicantId, confirmation.targetStage)
  }

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <h1>채용 파이프라인 보드</h1>
      </header>
      <form className={styles.toolbar} aria-label="지원자 필터" onSubmit={(event) => event.preventDefault()}>
        <div className={styles.filterControls}>
          <label>
            이름 검색
            <input value={nameQuery} onChange={(event) => setNameQuery(event.target.value)} />
          </label>
          <label>
            직무 필터
            <select value={role} onChange={(event) => setRole(event.target.value as ApplicantRole | 'ALL')}>
              <option value="ALL">전체</option>
              {roles.map((currentRole) => (
                <option key={currentRole} value={currentRole}>
                  {currentRole}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={resetFilters}>
            필터 초기화
          </button>
        </div>
        {!isPending && !isError && (
          <p className={styles.resultSummary} aria-live="polite">
            전체 {applicants.length}명 중 {filteredApplicants.length}명 표시
          </p>
        )}
      </form>
      {(moveError || moveSuccess || pendingIds.size > 0) && (
        <section className={styles.feedbackArea} aria-label="단계 이동 상태">
          {moveError && <p className={`${styles.feedback} ${styles.feedbackFailure}`} role="alert">{moveError}</p>}
          {moveSuccess && <p className={`${styles.feedback} ${styles.feedbackSuccess}`} role="status">{moveSuccess}</p>}
          {[...pendingIds].map((applicantId) => {
            const applicant = applicants.find((current) => current.id === applicantId)
            return applicant ? (
              <p key={applicant.id} className={`${styles.feedback} ${styles.feedbackPending}`} role="status">
                {applicant.name}님의 단계를 저장하는 중입니다.
              </p>
            ) : null
          })}
        </section>
      )}
      {isPending ? (
        <section className={`${styles.state} ${styles.stateLoading}`} role="region" aria-label="지원자 정보 로딩" aria-busy="true">
          <p className={styles.stateLabel}>지원자 목록</p>
          <h2>지원자 정보를 불러오는 중입니다.</h2>
        </section>
      ) : isError ? (
        <section className={`${styles.state} ${styles.stateError}`} role="alert">
          <p className={styles.stateLabel}>조회 오류</p>
          <h2>지원자 정보를 불러오지 못했습니다.</h2>
          <button type="button" onClick={() => void refetch()}>다시 시도</button>
        </section>
      ) : applicants.length === 0 ? (
        <section className={`${styles.state} ${styles.stateEmpty}`} role="region" aria-label="등록된 지원자 없음">
          <p className={styles.stateLabel}>전체 데이터</p>
          <h2>등록된 지원자가 없습니다.</h2>
        </section>
      ) : filteredApplicants.length === 0 ? (
        <section className={`${styles.state} ${styles.stateFilteredEmpty}`} role="region" aria-label="검색 결과 없음">
          <p className={styles.stateLabel}>검색 결과</p>
          <h2>현재 검색 조건에 맞는 지원자가 없습니다.</h2>
          <button type="button" onClick={resetFilters}>필터 초기화</button>
        </section>
      ) : (
        <div ref={boardViewportRef} className={styles.boardViewport} role="region" aria-label="채용 단계 보드" tabIndex={0}>
          <div className={styles.board}>
            {STAGES.map((stage, index) => (
              /* StageColumn: 단계 제목, 현재 결과 수, 소속 지원자 카드 목록을 렌더링한다. */
              <section key={stage.code} className={styles.column} data-stage={stage.code} aria-labelledby={`stage-${index}`}>
                <div className={styles.columnHeader}>
                  <h2 id={`stage-${index}`}>{stage.label}</h2>
                  <span className={styles.stageCount}>{applicantsByStage[stage.code].length}명</span>
                </div>
                <div className={styles.cardList}>
                  {applicantsByStage[stage.code].length === 0 ? <p className={styles.columnEmpty}>이 단계에는 지원자가 없습니다.</p> : applicantsByStage[stage.code].map((applicant) => (
                    /* ApplicantCard: 지원자의 목록 정보와 현재 단계를 표시한다. */
                    <article key={applicant.id} className={styles.card}>
                      <h3>{applicant.name}</h3>
                      <p className={styles.stageTag}>현재 단계: {stage.label}</p>
                      <div className={styles.cardMetadata}>
                        <p><span>직무</span>{applicant.role}</p>
                        <p><span>지원일</span>{applicant.appliedAt.slice(0, 10).replaceAll('-', '.')}</p>
                      </div>
                      <div className={styles.cardActions}>
                        <button
                          type="button"
                          onClick={(event) => {
                            const board = boardViewportRef.current
                            if (board) detailScrollPositionRef.current = { left: board.scrollLeft, top: board.scrollTop }
                            detailTriggerRef.current = event.currentTarget
                            setSelectedApplicantId(applicant.id)
                          }}
                        >
                          {applicant.name} 상세 열기
                        </button>
                        {getAllowedNextStages(applicant.stage).length > 0 ? (
                          <StageMoveForm
                            applicant={applicant}
                            isPending={pendingIds.has(applicant.id)}
                            onConfirmRequest={(targetStage, trigger) => {
                              confirmationTriggerRef.current = trigger
                              setStageChangeConfirmation({ applicantId: applicant.id, targetStage })
                            }}
                          />
                        ) : <p>종료된 단계입니다.</p>}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}
      {selectedApplicant && <ApplicantDetailDialog applicant={selectedApplicant} onClose={closeDetail} />}
      {stageChangeConfirmation && confirmationApplicant && (
        <StageChangeConfirmationDialog
          applicant={confirmationApplicant}
          targetStage={stageChangeConfirmation.targetStage}
          onCancel={cancelStageChangeConfirmation}
          onConfirm={confirmStageChange}
        />
      )}
    </main>
  )
}

export default App
