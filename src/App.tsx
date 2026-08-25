import styles from './App.module.css'
import { useApplicantsQuery } from './features/recruitment-board/api/useApplicantsQuery'
import { groupApplicantsByStage } from './features/recruitment-board/model/applicantSelectors'
import { STAGES } from './features/recruitment-board/model/stages'

function App() {
  const { data: applicants = [], isError, refetch } = useApplicantsQuery()
  const applicantsByStage = groupApplicantsByStage(applicants)

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
