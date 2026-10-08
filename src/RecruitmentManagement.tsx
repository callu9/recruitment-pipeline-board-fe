import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { APPLICANT_ROLES, type Applicant, type ApplicantIntake, type ApplicantOwner, type Position } from './features/recruitment-board/model/applicant.types'
import { applicantsQueryKey } from './features/recruitment-board/api/useApplicantsQuery'
import { positionsQueryKey } from './features/recruitment-board/api/usePositionsQuery'
import { OperationForm } from './ApplicantOperations'
import { getLocalDateString } from './features/recruitment-board/model/stages'
import { personKey } from './features/recruitment-board/model/operations'
import styles from './App.module.css'

const text = (data: FormData, key: string) => String(data.get(key) ?? '')
export function RecruitmentManagement({ positions, applicants, actor, mode }: { positions: Position[]; applicants: Applicant[]; actor: ApplicantOwner; mode: 'intake' | 'positions' }) {
  const client = useQueryClient()
  const lock = useRef(false)
  const [pending, setPending] = useState(false)
  async function post(endpoint: 'applicants' | 'positions', body: unknown) {
    if (lock.current) return '저장 중입니다.'
    lock.current = true; setPending(true)
    try {
      await client.cancelQueries({ queryKey: endpoint === 'applicants' ? applicantsQueryKey : positionsQueryKey })
      const response = await fetch(`/api/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message ?? '저장 실패')
      if (endpoint === 'applicants') client.setQueryData<Applicant[]>(applicantsQueryKey, (current = []) => [...current, ...result])
      else client.setQueryData<Position[]>(positionsQueryKey, (current = []) => current.some(({ id }) => id === result.id) ? current.map((item) => item.id === result.id ? result : item) : [...current, result])
      return null
    } catch (cause) { return cause instanceof Error ? cause.message : '저장하지 못했습니다. 다시 시도해 주세요.' }
    finally { lock.current = false; setPending(false) }
  }
  if (mode === 'positions') return <section className={styles.management} aria-label="포지션 관리">
    <OperationForm id="position" title="포지션 개설·수정" pending={pending} save={(position: Position) => post('positions', position)} build={(data): Position => ({ id: text(data, 'id'), title: text(data, 'title'), role: text(data, 'role') as Position['role'], department: text(data, 'department'), requiredCount: Number(text(data, 'requiredCount')), deadline: text(data, 'deadline'), status: text(data, 'status') as Position['status'], description: text(data, 'description'), evaluationCriteria: text(data, 'evaluationCriteria'), assignment: text(data, 'assignment'), requiredInterviewRounds: Number(text(data, 'requiredInterviewRounds')) })}>
      <label>편집할 포지션<select name="id" onChange={(event) => {
        const position = positions.find(({ id }) => id === event.target.value)
        const form = event.target.form!
        for (const name of ['title', 'role', 'department', 'requiredCount', 'deadline', 'status', 'description', 'evaluationCriteria', 'assignment', 'requiredInterviewRounds'] as const) {
          const field = form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
          field.value = String(position?.[name] ?? ({ role: APPLICANT_ROLES[0], requiredCount: 1, deadline: getLocalDateString(), status: 'OPEN', requiredInterviewRounds: 1 } as Record<string, unknown>)[name] ?? '')
        }
      }}><option value="">새 포지션</option>{positions.map((position) => <option key={position.id} value={position.id}>{position.title}</option>)}</select></label>
      <label>포지션명<input name="title" required /></label><label>직무<select name="role">{APPLICANT_ROLES.map((role) => <option key={role}>{role}</option>)}</select></label><label>부서<input name="department" required /></label><label>목표 인원<input name="requiredCount" type="number" min="1" required defaultValue="1" /></label><label>모집 기한<input name="deadline" type="date" required defaultValue={getLocalDateString()} /></label><label>모집 상태<select name="status"><option value="OPEN">채용 중</option><option value="PAUSED">모집 중단</option><option value="CLOSED">모집 마감</option></select></label><label>JD<textarea name="description" /></label><label>평가 기준<textarea name="evaluationCriteria" /></label><label>과제<textarea name="assignment" /></label><label>필요 면접 회차<input name="requiredInterviewRounds" type="number" min="1" max="20" defaultValue="1" required /></label><p>모집 중단·마감은 신규 접수를 막습니다. 기존 지원자의 전형은 계속 진행하며 지원자별 보류·철회는 상세에서 처리합니다.</p>
    </OperationForm>
  </section>
  return <section className={styles.management} aria-label="지원 접수 관리">
    <OperationForm id="intake" title="지원 접수" pending={pending} save={(inputs: ApplicantIntake[]) => post('applicants', { inputs, actor })} build={(data) => [{ name: text(data, 'name'), email: text(data, 'email'), phone: text(data, 'phone'), source: text(data, 'source'), positionId: text(data, 'positionId'), linkedApplicationId: text(data, 'linkedApplicationId') || undefined }]}>
      <label>지원자 이름<input name="name" required /></label><label>지원자 이메일<input name="email" type="email" required /></label><label>지원자 연락처<input name="phone" required /></label><label>접수 경로<input name="source" required placeholder="채용 사이트 / 추천 / 직접 지원" /></label><label>접수 포지션<select name="positionId" required><option value="">선택</option>{positions.filter(({ status }) => status === 'OPEN').map((position) => <option key={position.id} value={position.id}>{position.title}</option>)}</select></label><label>동일인·재지원 연결<select name="linkedApplicationId"><option value="">신규 사람</option>{applicants.map((applicant) => <option key={applicant.id} value={applicant.id}>{applicant.name} · {applicant.email} · {applicant.id} · {personKey(applicant)}</option>)}</select></label><p>동일 이메일이 있으면 기존 지원 건을 확인하고 연결해야 합니다. 연결해도 별도 지원 건과 이력을 생성합니다.</p>
    </OperationForm>
    <OperationForm id="import" title="지원 일괄 가져오기" pending={pending} save={(inputs: ApplicantIntake[]) => post('applicants', { inputs, actor })} build={(data) => JSON.parse(text(data, 'json')) as ApplicantIntake[]}>
      <label>지원 JSON<textarea name="json" required placeholder={'[{"name":"이름","email":"name@example.com","phone":"010","source":"추천","positionId":"position-frontend"}]'} /></label><p>1–500건. 중복은 linkedApplicationId로 연결하며, 한 건이라도 입력 오류가 있으면 전체를 저장하지 않습니다.</p>
    </OperationForm>
  </section>
}
