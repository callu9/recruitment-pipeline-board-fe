import { useState, type FormEvent } from 'react'
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

function App() {
  const { data: applicants = [], isError, refetch } = useApplicantsQuery()
  const { move, moveError, pendingIds } = useMoveApplicantStage()
  const [nameQuery, setNameQuery] = useState('')
  const [role, setRole] = useState<ApplicantRole | 'ALL'>('ALL')
  const filteredApplicants = filterApplicants(applicants, { nameQuery, role })
  const applicantsByStage = groupApplicantsByStage(filteredApplicants)
  const roles = getApplicantRoles(applicants)

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
      <div className={styles.boardViewport} role="region" aria-label="채용 단계 보드" tabIndex={0}>
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
    </main>
  )
}

export default App
