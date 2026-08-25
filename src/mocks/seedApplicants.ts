import { STAGES } from '../features/recruitment-board/model/stages'
import { APPLICANT_ROLES, type Applicant } from '../features/recruitment-board/model/applicant.types'

export function createSeedApplicants(size = 240): Applicant[] {
  return Array.from({ length: size }, (_, index) => {
    const number = index + 1
    const role = APPLICANT_ROLES[index % APPLICANT_ROLES.length]

    return {
      id: `applicant-${String(number).padStart(3, '0')}`,
      name: `지원자 ${String(number).padStart(3, '0')}`,
      role,
      appliedAt: `2026-08-${String((index % 28) + 1).padStart(2, '0')}T09:00:00.000Z`,
      stage: STAGES[index % STAGES.length].code,
      email: `applicant${number}@example.com`,
      phone: `010-${String(1000 + (index % 9000)).padStart(4, '0')}-${String(1000 + ((index * 7) % 9000)).padStart(4, '0')}`,
      experienceYears: (index % 10) + 1,
      skills: [role.split(' ')[0], 'Communication'],
      note: `${role} 지원자`,
    }
  })
}
