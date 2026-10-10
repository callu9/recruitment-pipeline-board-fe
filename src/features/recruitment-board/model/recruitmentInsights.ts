import type { Applicant, ApplicantStage } from './applicant.types'

export function getRecruitmentInsights(applicants: Applicant[]) {
  const transitions: Array<{ from: ApplicantStage; to: ApplicantStage; count: number; observedRate: number }> = []
  const dwellDays: Array<{ stage: ApplicantStage; days: number }> = []
  const hiringDays: number[] = []
  const reasons: string[] = []
  let correctionCount = 0
  let measuredApplicants = 0
  const daysBetween = (start: string, end: string) => (Date.parse(end) - Date.parse(start)) / 86400000
  for (const applicant of applicants) {
    const events = (applicant.timeline ?? []).filter((event) => event.fromStage && event.toStage)
    if (events.length) measuredApplicants += 1
    let previous: (typeof events)[number] | undefined = applicant.timeline?.find((event) => !event.fromStage && event.toStage === 'DOCUMENT_REVIEW')
    for (const event of events) {
      if (event.correction) { correctionCount += 1; previous = event; continue }
      const row = transitions.find((row) => row.from === event.fromStage && row.to === event.toStage)
      if (row) row.count += 1
      else transitions.push({ from: event.fromStage!, to: event.toStage!, count: 1, observedRate: 0 })
      if (previous && previous.toStage === event.fromStage && !previous.correction) {
        const days = daysBetween(previous.at, event.at)
        if (Number.isFinite(days) && days >= 0) dwellDays.push({ stage: event.fromStage!, days })
      }
      if (event.toStage === 'HIRED') {
        const days = daysBetween(applicant.appliedAt, event.at)
        if (Number.isFinite(days) && days >= 0) hiringDays.push(days)
      }
      if (event.toStage === 'REJECTED' && event.rejectionReason) reasons.push(event.rejectionReason)
      previous = event
    }
    if (['WITHDRAWN', 'OFFER_DECLINED'].includes(applicant.lifecycle ?? '') && applicant.lifecycleReason) reasons.push(applicant.lifecycleReason)
  }
  for (const row of transitions) row.observedRate = row.count / transitions.filter((other) => other.from === row.from).reduce((sum, other) => sum + other.count, 0)
  return { transitions, dwellDays, hiringDays, correctionCount, measuredApplicants, reasons }
}
