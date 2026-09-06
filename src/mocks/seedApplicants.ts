import {
  APPLICANT_OWNERS,
  APPLICANT_ROLES,
  EVALUATION_TYPES,
  type Applicant,
  type Position,
} from '../features/recruitment-board/model/applicant.types'
import { STAGES } from '../features/recruitment-board/model/stages'

export const DEMO_TODAY = '2026-09-07'

const APPLICANT_NAMES = ['김민지', 'Alex Kim', '이서준', 'Jordan Lee', '박소연', 'Mina Patel']

export const SEED_POSITIONS: Position[] = [
  { id: 'position-frontend', title: 'Frontend Engineer', role: 'Frontend Developer', department: 'Product', requiredCount: 3, deadline: '2026-09-30', status: 'OPEN' },
  { id: 'position-backend', title: 'Backend Engineer', role: 'Backend Developer', department: 'Platform', requiredCount: 2, deadline: '2026-09-20', status: 'OPEN' },
  { id: 'position-design', title: 'Product Designer', role: 'Product Designer', department: 'Design', requiredCount: 1, deadline: '2026-09-15', status: 'OPEN' },
  { id: 'position-pm', title: 'Product Manager', role: 'Product Manager', department: 'Product', requiredCount: 2, deadline: '2026-10-05', status: 'PAUSED' },
  { id: 'position-data', title: 'Data Analyst', role: 'Data Analyst', department: 'Data', requiredCount: 1, deadline: '2026-09-12', status: 'OPEN' },
  { id: 'position-qa', title: 'QA Engineer', role: 'QA Engineer', department: 'Engineering', requiredCount: 1, deadline: '2026-09-25', status: 'CLOSED' },
]

const pad = (value: number) => String(value).padStart(2, '0')

export function createSeedApplicants(size = 240): Applicant[] {
  return Array.from({ length: size }, (_, index) => {
    const number = index + 1
    const role = APPLICANT_ROLES[index % APPLICANT_ROLES.length]
    const stage = STAGES[index % STAGES.length].code
    const position = SEED_POSITIONS[index % SEED_POSITIONS.length]
    const isTodayInterview = stage === 'INTERVIEW' && index % 3 === 1
    const schedule = stage === 'INTERVIEW' && index % 4 !== 0
      ? {
          date: isTodayInterview ? DEMO_TODAY : `2026-09-${pad(8 + (index % 7))}`,
          startTime: `${pad(9 + (index % 8))}:00`,
          endTime: `${pad(10 + (index % 8))}:00`,
          format: index % 2 === 0 ? 'VIDEO' as const : 'ONSITE' as const,
          interviewer: APPLICANT_OWNERS[(index + 1) % APPLICANT_OWNERS.length],
        }
      : null
    const evaluationType = EVALUATION_TYPES[index % EVALUATION_TYPES.length]
    const evaluations = [
      {
        id: `evaluation-${number}`,
        type: evaluationType,
        status: index % 5 === 0 ? 'PENDING' as const : 'SUBMITTED' as const,
        dueDate: index % 7 === 0 ? '2026-09-05' : `2026-09-${pad(8 + (index % 12))}`,
        reviewer: APPLICANT_OWNERS[index % APPLICANT_OWNERS.length],
        score: index % 5 === 0 ? undefined : 70 + (index % 26),
        comment: index % 5 === 0 ? undefined : '다음 인터뷰에서 협업 경험을 확인합니다.',
      },
    ]

    return {
      id: `applicant-${String(number).padStart(3, '0')}`,
      name: APPLICANT_NAMES[index % APPLICANT_NAMES.length],
      role,
      appliedAt: `2026-08-${pad((index % 28) + 1)}T09:00:00.000Z`,
      stage,
      email: `applicant${number}@example.com`,
      phone: `010-${String(1000 + (index % 9000)).padStart(4, '0')}-${String(1000 + ((index * 7) % 9000)).padStart(4, '0')}`,
      experienceYears: (index % 10) + 1,
      skills: [role.split(' ')[0], 'Communication'],
      note: `${role} 지원자`,
      owner: APPLICANT_OWNERS[index % APPLICANT_OWNERS.length],
      positionId: position.id,
      nextAction: stage === 'INTERVIEW' ? (schedule ? '인터뷰 준비' : '인터뷰 일정 등록') : stage === 'OFFER' ? '처우안 발송' : stage === 'HIRED' ? '입사 안내' : '서류 검토',
      dueDate: index % 7 === 0 ? '2026-09-05' : `2026-09-${pad(8 + (index % 12))}`,
      schedule,
      evaluations,
      notes: [{ id: `note-${number}`, author: APPLICANT_OWNERS[index % APPLICANT_OWNERS.length], createdAt: '2026-09-01', text: `${role} 지원자 초기 메모` }],
      timeline: [
        { id: `timeline-${number}-1`, at: `2026-08-${pad((index % 28) + 1)}`, label: '지원서 접수' },
        ...(stage !== 'DOCUMENT_REVIEW' ? [{ id: `timeline-${number}-2`, at: '2026-09-01', label: '서류 검토 완료' }] : []),
      ],
    }
  })
}
