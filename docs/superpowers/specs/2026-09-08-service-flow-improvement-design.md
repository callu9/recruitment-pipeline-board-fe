# 채용 서비스 흐름 개선 설계

## 1. 배경

현재 워크스페이스는 Applicants, Today, Calendar, Positions와 지원자 상세에서 일정·평가·다음 액션을 보여 주지만, 실제 쓰기 경로는 단계 변경뿐이다.

- 평가가 `작성 필요`여도 작성할 수 없다.
- 일정이 없어도 Calendar와 상세에서 등록할 수 없다.
- 정상 단계 전진은 피드백과 다음 단계 일정이 없어도 즉시 실행된다.
- `nextAction`이 저장 데이터라서 stage·평가·일정과 어긋날 수 있다.
- 선택적 1,000명 모드는 현재 화면에서 검증된 성능 이점 없이 설정·저장소·문서·테스트 분기를 늘린다.
- seed가 평가 유형과 전형을 독립적으로 순환시켜 Today와 Calendar가 실제 업무보다 생성 패턴을 더 크게 보여 준다.

이 설계는 기존 화면을 새 시스템으로 교체하지 않는다. 이미 있는 평가, 일정, Calendar, 단계 mutation을 실제 사용자 흐름으로 연결한다.

## 2. 목표와 요구사항

### SFI-01. 전형별 내부 피드백

- 활성 전형에 대응하는 평가를 지원자 상세에서 작성할 수 있다.
- 평가자, 0–100점 점수, 코멘트를 필수로 저장하고 새로고침 뒤 유지한다.
- 완료된 피드백은 상세에서 내용과 작성일을 확인할 수 있다.
- 피드백 저장은 타임라인에 남는다.

전형과 기존 평가 유형의 대응은 다음과 같다.

| 전형 | 평가 유형 |
|---|---|
| 서류검토 | `SCREEN` |
| 면접 | `INTERVIEW` |
| 처우협의 | `FINAL` |

새 피드백 엔티티는 만들지 않고 기존 `ApplicantEvaluation`을 사용한다.

### SFI-02. 상태 기반 다음 액션

활성 지원자의 primary action은 저장된 문자열이 아니라 현재 stage·평가·일정에서 계산한다.

```text
현재 전형 피드백 미작성
→ 피드백 작성
→ 다음 전형 일정 미정
→ 일정 등록
→ 다음 단계 이동
```

- 서류검토: `서류 피드백 작성` → `면접 일정 등록` → `면접 집행`
- 면접: `면접 피드백 작성` → `처우 일정 등록` → `처우 협의`
- 처우협의: `처우 피드백 작성` → `최종 합격`
- 종료 단계: `종료됨`

정상 전진은 선행 피드백과 다음 전형 일정을 충족해야 한다. 불합격은 일정이나 피드백을 요구하지 않고 기존의 불합격 사유 필수 규칙을 유지한다. 단계 정정은 관리자 권한이 없는 현재 prototype의 예외 흐름이므로 선행조건을 적용하지 않는다.

Today와 Calendar의 `일정 미정` 대상도 stage 이름만 보지 않고 이 action이 `SCHEDULE`인 지원자로 계산한다. 따라서 서류검토 중 면접 일정이 없는 지원자와 면접 중 처우 일정이 없는 지원자가 모두 실제 등록 흐름으로 연결된다.

### SFI-03. 내부 캘린더 기반 일정 관리

- 면접과 처우협의 일정을 지원자 상세에서 등록·변경할 수 있다.
- 일정이 필요한 primary action 또는 Calendar의 일정 미정 항목에서 상세의 일정 입력으로 바로 진입한다.
- 입력 영역은 선택한 날짜와 담당자의 기존 내부 일정을 함께 보여 준다.
- 날짜, 시작·종료 시간은 native input을 사용한다.
- 일정 형식은 화상·대면만 제공한다.
- 같은 담당자의 시간이 겹치면 경고하지만 저장을 막지 않는다. 실제 운영에는 의도된 중복 일정이 있을 수 있기 때문이다.
- 종료 시간은 시작 시간보다 늦어야 하고, 과거 날짜는 저장할 수 없다.

외부 Google Calendar, 이메일, 참석자 초대, 반복 일정, timezone 설정은 포함하지 않는다.

### SFI-04. 저장과 실패 일관성

- 피드백과 일정은 API 성공 뒤 Query cache에 병합한다. 저장 전 낙관적으로 바꾸지 않는다.
- 저장 중에는 같은 지원자의 동일 입력을 동기식 guard와 disabled 상태로 막는다.
- 실패하면 form 입력을 유지하고 `role="alert"`로 다시 시도할 수 있게 한다.
- 기존 단계 이동만 optimistic update와 지원자 엔티티 단위 rollback을 유지한다.
- mock API는 정상 전진의 피드백·일정 선행조건을 다시 검사해 직접 요청 우회를 막는다.
- 모든 쓰기는 최신 localStorage 배열에서 대상 지원자 한 명만 교체한다.

### SFI-05. 목업 데이터 정리

- `.env.performance`, `dev:performance`, `VITE_APPLICANT_SEED_SIZE`, 별도 `:1000` 저장소 분기를 제거한다.
- 기본 240명은 현재 PRD의 기본 규모와 검색 검증을 위해 유지한다.
- 1,000명 전용 설정·테스트·README 안내를 제거한다.
- 과거 `large-data-performance` 설계·계획·PROMPTS 기록은 히스토리이므로 삭제하지 않는다.
- applicant 저장 키를 `v2`로 변경해 기존 dirty v1 snapshot을 읽지 않는다. 이전 키를 자동 삭제하지는 않는다.
- 새 seed는 stage, 현재 평가, 일정 종류, 파생 다음 액션, 타임라인이 모순되지 않게 생성한다.
- Today와 현재 7일 Calendar에 모든 지원자가 몰리지 않도록 pending·overdue·당일 일정 시나리오를 제한한다.

## 3. 선택한 사용자 흐름

### 3.1 피드백이 없는 지원자

1. 사용자가 Applicants 또는 상세의 `서류 피드백 작성` 같은 primary action을 실행한다.
2. 상세 패널이 열리고 해당 평가 form으로 포커스가 이동한다.
3. 평가자, 점수, 코멘트를 입력한다.
4. 저장 성공 후 평가는 `작성 완료`가 되고 타임라인이 갱신된다.
5. primary action은 다음으로 필요한 일정 등록으로 바뀐다.

### 3.2 일정이 없는 지원자

1. 사용자가 `면접 일정 등록` 또는 `처우 일정 등록`을 실행한다.
2. 상세 패널이 열리고 일정 form으로 포커스가 이동한다.
3. 날짜와 담당자를 선택하면 같은 날의 내부 일정 목록을 확인한다.
4. 시작·종료 시간과 형식을 입력한다.
5. 겹치는 일정이 있으면 경고를 확인하고 필요하면 그대로 저장한다.
6. 저장 성공 후 Applicants, Today, Calendar가 같은 Query cache에서 갱신된다.
7. primary action은 실제 단계 전진으로 바뀐다.

### 3.3 정상 전진

1. 사용자가 준비가 끝난 지원자의 전진 action을 실행한다.
2. 서류검토→면접과 면접→처우협의는 기존처럼 즉시 optimistic update를 시작한다.
3. 처우협의→최종합격은 기존 terminal confirmation을 거친다.
4. 서버도 선행조건을 확인한다.
5. 실패하면 해당 지원자만 이전 엔티티로 복원한다.

## 4. 도메인 설계

### 4.1 평가

`ApplicantEvaluation`의 기존 필드를 재사용하고 작성 시각만 추가한다.

```ts
interface ApplicantEvaluation {
  id: string
  type: 'SCREEN' | 'INTERVIEW' | 'FINAL'
  status: 'PENDING' | 'SUBMITTED'
  dueDate: string
  reviewer: ApplicantOwner
  score?: number
  comment?: string
  submittedAt?: string
}
```

점수는 기존 화면과 seed가 사용하는 0–100 범위를 유지한다. 코멘트는 trim 후 빈 문자열을 거부한다.

활성 단계로 전진하거나 정정할 때 해당 단계 평가가 없으면 `PENDING` 평가를 한 건 추가한다. 평가 유형은 위 전형 매핑을 사용하고, reviewer와 dueDate는 해당 단계의 schedule 담당자와 날짜를 우선 사용한 뒤 applicant 담당자와 전이일로 대체한다. 이미 같은 유형 평가가 있으면 중복 생성하지 않는다.

### 4.2 일정

면접 전용 이름을 일반 일정으로 바꾸고 현재 진행에 필요한 일정 한 건만 보관한다.

```ts
type ApplicantScheduleType = 'INTERVIEW' | 'OFFER'

interface ApplicantSchedule {
  type: ApplicantScheduleType
  date: string
  startTime: string
  endTime: string
  format: 'VIDEO' | 'ONSITE'
  owner: ApplicantOwner
}
```

면접에서 처우협의 준비로 넘어갈 때 처우 일정이 현재 면접 일정을 대체한다. 과거 일정은 별도 배열로 보존하지 않고 일정 저장 타임라인으로 남긴다. 과거 일정 조회 요구가 생기면 그때 schedule history를 추가한다.

### 4.3 다음 액션 계산

하나의 순수 함수가 다음 action의 종류와 label을 반환한다.

```ts
type ApplicantNextAction =
  | { kind: 'FEEDBACK'; evaluationId: string; label: string }
  | { kind: 'SCHEDULE'; scheduleType: ApplicantScheduleType; label: string }
  | { kind: 'MOVE'; targetStage: ApplicantStage; label: string }
  | { kind: 'DONE'; label: '종료됨' }
```

Applicants 행, 상세 action, Today 파생 목록은 이 결과를 재사용한다. `Applicant.nextAction`은 제거한다.

### 4.4 일정 충돌

충돌은 같은 담당자·같은 날짜에서 아래 조건으로 계산한다.

```text
기존 시작 < 새 종료 && 새 시작 < 기존 종료
```

현재 수정 중인 지원자의 일정은 비교 대상에서 제외한다. 충돌 비교는 종료 시간이 있는 `Applicant.schedule`끼리 수행하고 평가 마감 이벤트는 제외한다. 문자열 `HH:mm`은 zero-padded native time input 값이므로 직접 비교한다.

## 5. API와 데이터 흐름

### 5.1 피드백 저장

```http
PATCH /api/applicants/:applicantId/evaluations/:evaluationId
```

요청은 reviewer, score, comment를 받는다. handler는 applicant와 evaluation 존재 여부, 현재 stage에 대응하는 evaluation인지, 점수 범위, reviewer, comment를 검증한다. 성공하면 해당 평가만 `SUBMITTED`로 바꾸고 서버 측 local date를 `submittedAt`으로 기록한다.

### 5.2 일정 저장

```http
PUT /api/applicants/:applicantId/schedule
```

요청은 완전한 `ApplicantSchedule` 한 건이다. handler는 일정 종류, 날짜, 시간 순서, format, owner를 검증하고 현재 schedule을 교체한다.

### 5.3 단계 저장

기존 endpoint를 유지한다.

```http
PATCH /api/applicants/:applicantId/stage
```

정상 전진이면 handler가 다음을 추가 검증한다.

- 현재 stage의 평가가 제출됐는가
- 면접 또는 처우협의로 이동할 때 해당 종류의 schedule이 있는가

실패 code는 `INCOMPLETE_FEEDBACK`, `MISSING_SCHEDULE`을 추가한다. correction과 rejection은 이 선행조건을 우회하되 기존 검증을 유지한다.

활성 단계로 이동한 결과에는 해당 stage의 pending 평가가 한 건 존재해야 한다. Query cache의 optimistic transform과 mock DB가 기존 `applyStageTransition`을 함께 사용해 같은 결과를 만든다.

## 6. UI 구조

- 기존 `ApplicantDetail`을 작업 표면으로 재사용한다.
- 평가 section에 현재 pending 평가 form과 완료된 코멘트를 표시한다.
- 일정 section에 일정 form, 선택 날짜의 담당자 일정, 충돌 경고를 표시한다.
- row/Today/Calendar action은 상세를 열 때 `feedback` 또는 `schedule` 진입점을 전달해 해당 form에 포커스한다.
- 별도 wizard, 새 route, 새 전역 store, toast, calendar/date-picker dependency는 추가하지 않는다.
- dialog 닫기, Escape, opener focus 복귀와 좁은 화면 내부 스크롤을 유지한다.

## 7. 오류와 접근성

- 모든 form control은 visible label을 가진다.
- validation 오류와 API 오류는 form 가까이에 `role="alert"`로 표시한다.
- 저장 중 form에 `aria-busy="true"`, submit button에 `disabled`를 적용한다.
- 성공 메시지는 기존 전역 `role="status"` 영역을 사용한다.
- primary action의 접근성 이름에는 지원자 이름과 ID를 유지한다.
- 상세를 action 진입점으로 열면 첫 미충족 form control로 포커스하고, 닫을 때 원래 action으로 복귀한다.

## 8. 작업 단위와 예정 파일

### `[stage-feedback]`

- `docs/PRD.md`
- `src/App.tsx`
- `src/App.module.css`
- `src/features/recruitment-board/model/applicant.types.ts`
- 기존 model helper 또는 `workspaceSelectors.ts`와 테스트
- feedback API hook
- `src/mocks/handlers.ts`, `mockDb.ts`와 테스트
- `PROMPTS.md`, `DECISIONS.md`

### `[stage-scheduling]`

- `docs/PRD.md`
- `src/App.tsx`
- `src/App.module.css`
- applicant type, stage policy, workspace selector와 테스트
- schedule API hook
- mock handler/DB와 테스트
- 기존 stage mutation 회귀 테스트
- `PROMPTS.md`, `DECISIONS.md`

이 scope에서 상태 기반 primary action과 서버의 전진 선행조건을 함께 적용한다. 일정 저장만 추가하고 전진을 그대로 두면 사용자 흐름이 다시 끊기기 때문이다.

### `[mock-data-cleanup]`

- `.env.performance` 삭제
- `package.json`, `README.md`, `docs/PRD.md`, `DECISIONS.md`
- `mockConfig.ts`, `mockDb.ts`, `seedApplicants.ts`와 테스트
- 1,000명 전용 selector 테스트 삭제
- `PROMPTS.md`

## 9. 검증 시나리오

### 자동 검증

- 현재 stage에 대응하는 평가만 작성된다.
- 빈 코멘트, 잘못된 점수·평가자·ID는 저장되지 않는다.
- feedback 성공 후 cache와 localStorage가 일치하고 새로고침 뒤 유지된다.
- feedback 실패 시 cache와 localStorage가 바뀌지 않고 입력이 유지된다.
- 일정 종료 시간이 시작 시간보다 빠르거나 날짜·담당자·형식이 잘못되면 저장되지 않는다.
- 같은 담당자의 겹치는 일정만 경고한다.
- 일정 성공 후 Applicants, Today, Calendar 파생 결과가 함께 갱신된다.
- 선행조건 없는 정상 전진의 직접 API 요청은 거부된다.
- rejection과 correction은 기존 정책대로 동작한다.
- 단계 실패 rollback은 다른 지원자의 성공을 덮지 않는다.
- 1,000명 설정과 별도 storage branch가 제거되고 기본 seed는 240명이다.
- seed의 stage, 평가, schedule type, timeline이 일관된다.
- `npm run lint`, `npm run test`, `npm run build`, `git diff --check`가 통과한다.

### 수동 브라우저 검증

- Applicants에서 `피드백 작성 → 일정 등록 → 단계 이동` 순서가 보인다.
- Today의 평가 작성 필요 항목에서 실제 form으로 진입한다.
- Calendar 일정 미정 항목에서 실제 schedule form으로 진입한다.
- 선택 날짜의 기존 일정과 충돌 경고를 확인한다.
- 저장 성공·강제 실패·재시도를 확인한다.
- 새로고침 후 feedback, schedule, stage가 유지된다.
- 키보드만으로 action, form, 저장, 상세 닫기와 focus 복귀를 수행한다.
- 좁은 화면에서 상세 form과 내부 일정 목록을 읽고 조작할 수 있다.

## 10. 제외 범위

- 외부 캘린더·메일·메신저 연동
- 여러 면접관의 독립 평가와 승인 quorum
- 피드백 draft, 첨부 파일, 버전 이력
- 일정 초대·취소·반복·timezone 정책
- 과거 일정 전체 history
- 지원자 생성·삭제, 권한·실사용자 감사 정보
- 가상화와 1,000명 성능 모드

이 범위가 필요해지는 실제 요구가 생기기 전에는 추가하지 않는다.
