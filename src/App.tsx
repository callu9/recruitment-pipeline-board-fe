import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import styles from './App.module.css'
import { useApplicantsQuery } from './features/recruitment-board/api/useApplicantsQuery'
import { groupApplicantsByStage } from './features/recruitment-board/model/applicantSelectors'
import { STAGES } from './features/recruitment-board/model/stages'
import type { Applicant, ApplicantStage } from './features/recruitment-board/model/applicant.types'

async function moveApplicantStage(applicantId: string, stage: ApplicantStage): Promise<Applicant> {
  const response = await fetch(`/api/applicants/${applicantId}/stage`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stage }),
  })
  if (!response.ok) throw new Error('단계 이동을 저장하지 못했습니다.')

  return response.json()
}

function StageMoveForm({ applicant, onMove }: { applicant: Applicant; onMove: (stage: ApplicantStage) => void }) {
  const [targetStage, setTargetStage] = useState<ApplicantStage | ''>('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!targetStage || targetStage === applicant.stage) return
    onMove(targetStage)
  }

  return (
    <form className={styles.moveForm} aria-label={`${applicant.name} 단계 이동`} onSubmit={handleSubmit}>
      <label>
        이동할 단계
        <select value={targetStage} onChange={(event) => setTargetStage(event.target.value as ApplicantStage)}>
          <option value="">단계 선택</option>
          {STAGES.filter((stage) => stage.code !== applicant.stage).map((stage) => (
            <option key={stage.code} value={stage.code}>
              {stage.label}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={!targetStage}>
        이동
      </button>
    </form>
  )
}

function App() {
  const { data: applicants = [], isError, refetch } = useApplicantsQuery()
  const queryClient = useQueryClient()
  const [moveError, setMoveError] = useState('')
  const moveMutation = useMutation({
    mutationFn: ({ applicantId, stage }: { applicantId: string; stage: ApplicantStage }) =>
      moveApplicantStage(applicantId, stage),
    onSuccess: (updatedApplicant) => {
      setMoveError('')
      queryClient.setQueryData<Applicant[]>(['applicants'], (current = []) =>
        current.map((applicant) => (applicant.id === updatedApplicant.id ? updatedApplicant : applicant)),
      )
    },
    onError: () => setMoveError('단계 이동을 저장하지 못했습니다.'),
  })
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
      {moveError && <p role="alert">{moveError}</p>}
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
                      onMove={(targetStage) => {
                        void moveMutation.mutateAsync({ applicantId: applicant.id, stage: targetStage }).catch(() => undefined)
                      }}
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
