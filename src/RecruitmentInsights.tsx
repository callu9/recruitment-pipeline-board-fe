import type { Applicant } from './features/recruitment-board/model/applicant.types'
import { getRecruitmentInsights } from './features/recruitment-board/model/recruitmentInsights'
import { STAGES } from './features/recruitment-board/model/stages'
import styles from './App.module.css'
const label = (code: string) => STAGES.find((stage) => stage.code === code)?.label ?? code
const average = (values: number[]) => values.length ? `${(values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1)}일 (${values.length}건)` : '측정 기록 없음'
export function RecruitmentInsights({ applicants }: { applicants: Applicant[] }) {
  const insights = getRecruitmentInsights(applicants)
  return <section className={styles.view} aria-labelledby="insights-heading"><div className={styles.viewHeader}><div><h2 id="insights-heading">기록 기반 분석</h2><p>구조화된 단계 변경 기록이 있는 {insights.measuredApplicants}/{applicants.length}건을 집계합니다. 과거 기록이 없는 구간은 측정하지 않습니다.</p></div></div>
    <div className={styles.queueSection}><h3>관측된 단계 전환</h3><p>비율은 해당 단계에서 기록된 일반 전환 중의 비중입니다. 전체 지원자의 합격률과 다릅니다.</p>{insights.transitions.length ? <ul>{insights.transitions.map((row) => <li key={`${row.from}-${row.to}`}>{label(row.from)} → {label(row.to)}: {row.count}건 · {(row.observedRate * 100).toFixed(1)}%</li>)}</ul> : <p>측정 기록 없음</p>}</div>
    <div className={styles.queueSection}><h3>기록된 체류 시간</h3><p>연속 진입·이탈 기록 사이의 경과 시간이며 보류 기간을 포함합니다.</p>{STAGES.map((stage) => <p key={stage.code}>{stage.label}: {average(insights.dwellDays.filter(({ stage: value }) => value === stage.code).map(({ days }) => days))}</p>)}<p>접수→회사 최종 합격: {average(insights.hiringDays)}</p><p>단계 정정: {insights.correctionCount}건 (일반 전환에서 제외)</p></div>
    <div className={styles.queueSection}><h3>기록된 종료 사유</h3>{insights.reasons.length ? <ul>{insights.reasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul> : <p>측정 기록 없음</p>}</div>
  </section>
}
