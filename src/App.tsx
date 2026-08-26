import { useEffect, useRef, useState, type FormEvent } from 'react'
import styles from './App.module.css'
import { useApplicantsQuery } from './features/recruitment-board/api/useApplicantsQuery'
import { useMoveApplicantStage } from './features/recruitment-board/api/useMoveApplicantStage'
import { filterApplicants, getApplicantRoles, groupApplicantsByStage } from './features/recruitment-board/model/applicantSelectors'
import { STAGES } from './features/recruitment-board/model/stages'
import type { Applicant, ApplicantRole, ApplicantStage } from './features/recruitment-board/model/applicant.types'

function StageMoveForm({ applicant, isPending, onMove }: { applicant: Applicant; isPending: boolean; onMove: (stage: ApplicantStage) => void }) {
  const [targetStage, setTargetStage] = useState<ApplicantStage | ''>('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!targetStage || targetStage === applicant.stage) return
    onMove(targetStage)
  }

  return (
    <form className={styles.moveForm} aria-label={`${applicant.name} 단계 이동`} aria-busy={isPending} onSubmit={handleSubmit}>
      <label>
        이동할 단계
        <select disabled={isPending} value={targetStage} onChange={(event) => setTargetStage(event.target.value as ApplicantStage)}>
          <option value="">단계 선택</option>
          {STAGES.filter((stage) => stage.code !== applicant.stage).map((stage) => (
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

function ApplicantDetailDialog({ applicant, onClose }: { applicant: Applicant; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const stage = STAGES.find((current) => current.code === applicant.stage)
  const titleId = `applicant-detail-${applicant.id}`

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (!dialog.open) dialog.showModal()
    dialog.addEventListener('close', onClose)
    return () => dialog.removeEventListener('close', onClose)
  }, [onClose])

  return (
    <dialog ref={dialogRef} className={styles.detailDialog} aria-labelledby={titleId}>
      <header className={styles.detailHeader}>
        <h2 id={titleId}>{applicant.name} 상세 정보</h2>
        <button type="button" onClick={() => dialogRef.current?.close()}>닫기</button>
      </header>
      <dl className={styles.detailList}>
        <div><dt>직무</dt><dd>{applicant.role}</dd></div>
        <div><dt>지원일</dt><dd>{applicant.appliedAt.slice(0, 10).replaceAll('-', '.')}</dd></div>
        <div><dt>현재 단계</dt><dd>{stage?.label}</dd></div>
        <div><dt>이메일</dt><dd>{applicant.email}</dd></div>
        <div><dt>전화번호</dt><dd>{applicant.phone}</dd></div>
        <div><dt>경력 연차</dt><dd>{applicant.experienceYears}년</dd></div>
        <div><dt>주요 기술</dt><dd>{applicant.skills.join(', ')}</dd></div>
        <div><dt>메모</dt><dd>{applicant.note}</dd></div>
      </dl>
    </dialog>
  )
}

function App() {
  const { data: applicants = [], isError, refetch } = useApplicantsQuery()
  const { move, moveError, pendingIds } = useMoveApplicantStage()
  const [nameQuery, setNameQuery] = useState('')
  const [role, setRole] = useState<ApplicantRole | 'ALL'>('ALL')
  const [selectedApplicantId, setSelectedApplicantId] = useState<string | null>(null)
  const detailTriggerRef = useRef<HTMLButtonElement>(null)
  const boardViewportRef = useRef<HTMLDivElement>(null)
  const detailScrollPositionRef = useRef({ left: 0, top: 0 })
  const filteredApplicants = filterApplicants(applicants, { nameQuery, role })
  const applicantsByStage = groupApplicantsByStage(filteredApplicants)
  const roles = getApplicantRoles(applicants)
  const selectedApplicant = applicants.find((applicant) => applicant.id === selectedApplicantId)

  function closeDetail() {
    setSelectedApplicantId(null)
    detailTriggerRef.current?.focus()
    const board = boardViewportRef.current
    if (board) {
      board.scrollLeft = detailScrollPositionRef.current.left
      board.scrollTop = detailScrollPositionRef.current.top
    }
  }

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <h1>채용 파이프라인 보드</h1>
        {isError && (
          <button type="button" onClick={() => void refetch()}>
            다시 시도
          </button>
        )}
      </header>
      <form className={styles.toolbar} aria-label="지원자 필터" onSubmit={(event) => event.preventDefault()}>
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
        <button type="button" onClick={() => { setNameQuery(''); setRole('ALL') }}>
          필터 초기화
        </button>
      </form>
      {moveError && <p role="alert">{moveError}</p>}
      {[...pendingIds].map((applicantId) => {
        const applicant = applicants.find((current) => current.id === applicantId)
        return applicant ? <p key={applicant.id}>{applicant.name}님의 단계를 저장하는 중입니다.</p> : null
      })}
      <div ref={boardViewportRef} className={styles.boardViewport} role="region" aria-label="채용 단계 보드" tabIndex={0}>
        <div className={styles.board}>
          {STAGES.map((stage, index) => (
            /* StageColumn: 단계 제목, 현재 결과 수, 소속 지원자 카드 목록을 렌더링한다. */
            <section key={stage.code} className={styles.column} aria-labelledby={`stage-${index}`}>
              <div className={styles.columnHeader}>
                <h2 id={`stage-${index}`}>{stage.label}</h2>
                <span>{applicantsByStage[stage.code].length}명</span>
              </div>
              <div className={styles.cardList}>
                {applicantsByStage[stage.code].map((applicant) => (
                  /* ApplicantCard: 지원자의 목록 정보와 현재 단계를 표시한다. */
                  <article key={applicant.id} className={styles.card}>
                    <h3>{applicant.name}</h3>
                    <p>{applicant.role}</p>
                    <p>{applicant.appliedAt.slice(0, 10).replaceAll('-', '.')}</p>
                    <p>현재 단계: {stage.label}</p>
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
                    <StageMoveForm
                      applicant={applicant}
                      isPending={pendingIds.has(applicant.id)}
                      onMove={(targetStage) => move(applicant.id, targetStage)}
                    />
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
      {selectedApplicant && <ApplicantDetailDialog applicant={selectedApplicant} onClose={closeDetail} />}
    </main>
  )
}

export default App
