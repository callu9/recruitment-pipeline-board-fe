# 페이지네이션을 포함한 채용 워크스페이스 UIUX 개선 명세

- 문서 scope: `workspace-uiux-spec`; 기능별 구현 scope는 §6에서 분리한다.
- 작성일: 2026-10-07
- 상태: applicants-workspace-ux 후보의 자동·브라우저 검증 수행, 사용자 검증 대기. 일정 흐름은 다음 최우선 구현 준비.
- 요청: “ui 개선은 shadcn, shadcn lint 활용해서 빠르게 구현하는 것까지 하여 페이지네이션을 포함한 UIUX 개선 명세로 변경해서 다시 작성”
- 기준: `dev`의 `ac86379`, 현재 PRD와 실제 코드. 이전 페이지네이션 단독 초안을 이 문서로 대체한다.

## 1. 목표와 완료 범위

지원자를 적절한 크기로 탐색하고, 필요한 업무를 찾아 실행하며, 작성 중인 내용과 작업 결과를 놓치지 않게 한다. shadcn/ui의 기존 컴포넌트와 `@shadcn/lint`를 사용해 반복적인 UI 제작·수정 시간을 줄인다.

이 문서는 페이지네이션, 필터·정렬, 입력 보호, 작업 위치의 결과 안내, 상세 정보 재배치, 반응형 가독성, 캘린더 탐색, 문구 정리를 포함한다. 다음 행동과 일정 등록의 연결도 최종 목표에 포함하되 기존 `[stage-scheduling]` 설계로 별도 구현한다. 버튼 문구만 바꾸어 이 흐름이 완성된 것으로 처리하지 않는다.

연결 요구사항은 현재 PRD의 FR-01~07(업무 화면), FR-08~10(단계 변경·복구), FR-11(조회 상태), FR-12(피드백), §15(접근성·반응형)이다. 문서 안의 UI-*, PAG-*, UX-*는 이번 작업의 추가 수용 기준이며 기존 FR 번호를 바꾸지 않는다.

사용자가 지정한 선택은 shadcn/ui와 shadcn lint 활용이다. 페이지 크기, 정렬 기본값, 화면 치수와 아래 UX 정책은 이 명세의 구체적인 제안값이다.

## 2. 현재 문제와 설계 원칙

설계 기준 commit의 Applicants는 필터 결과 전체를 렌더링했다. 현재 후보에서는 페이지를 분할하고 표시 설정을 표 상단에 둔다. 현재 확장 후보에는 고급 필터 Collapsible·활성 칩·세 정렬이 연결되었다. 상세는 native dialog이며 피드백 입력을 보유한 컴포넌트가 닫히면 입력이 사라진다. 단계 결과는 Sonner로 전환되었으며, 상세에서는 예외적인 단계 정정이 현재 피드백보다 먼저 보인다. Calendar는 오늘부터 7일만 조회한다.

- TanStack Query cache를 지원자 데이터의 단일 원본으로 유지한다. 페이지별 데이터 복제, 새 전역 store를 추가하지 않는다.
- MSW + localStorage, 200–800ms 지연·약 15% 실패, 엔티티 단위 rollback, 동일 지원자 동기식 pending guard와 다른 지원자 병렬 실행을 유지한다.
- 새 shadcn 컴포넌트를 실제 화면에 연결하는 단위로 구현한다. 앱 전체 구조·모든 CSS를 먼저 재작성하지 않는다.
- 페이지네이션과 정렬은 클라이언트에서 처리한다. 서버 페이지네이션, 무한 스크롤, 가상화, TanStack Table, 폼 라이브러리는 이 요구를 위해 도입하지 않는다.
- 새 UI 의존성은 사용자가 요청한 shadcn/ui와 그 필수 의존성, Tailwind v4, `@shadcn/lint`에 한정한다. 컴포넌트는 필요한 것만 CLI로 추가한다.
- 전체 조회·필터 비용은 남는다. DOM 행 수 감소만으로 1,000건 성능 기준을 달성했다고 보고하지 않는다.

## 3. shadcn/ui와 lint 적용 명세

### 3.1 기존 Vite 프로젝트에 도입

공식 [Vite 설치 안내](https://ui.shadcn.com/docs/installation/vite)의 기존 프로젝트 경로를 사용한다. 새 Vite 앱을 만들지 않는다. Tailwind v4 Vite plugin과 `@/` alias를 추가하고, `components.json`을 구성한다. 기존 `vite.config.ts`의 배포 base와 Vitest 설정, `src/index.css`의 전역 토큰은 병합하여 보존한다.

- Native Select는 공식 [컴포넌트](https://ui.shadcn.com/docs/components/radix/native-select)를 사용한다.
- 컴포넌트 기반은 Radix 계열 하나로 통일한다. 기본 테마는 기존의 밝은 배경·파란 primary를 semantic token으로 연결한다.
- CLI가 설치하는 컴포넌트 소스·필수 패키지를 확인하고 lockfile에 고정한다. 구현 시작 시 CLI 버전을 기록하고 같은 버전으로 작업한다.
- 최초 도입 명령은 `npx shadcn@latest init --base radix`이며 기존 프로젝트에서 실행한다. 이후 기록한 버전의 `add`로 필요한 컴포넌트만 추가한다. 이 문서 작성 중에는 실행하지 않았다.
- Tailwind preflight와 기존 CSS Modules가 함께 적용되므로 전 화면의 typography, table, button, dialog 회귀를 확인한다. 공식 예제의 CSS 전체 교체를 그대로 실행하지 않는다.
- 제품 고유 layout은 기존 CSS Modules를 유지할 수 있다. 새로 분리하는 개선 화면은 Tailwind token과 shadcn variants를 사용하고, 교체된 영역의 죽은 CSS만 제거한다.

| UI 영역 | 사용할 기본 컴포넌트 | 적용 경계 |
|---|---|---|
| 페이지 탐색 | Pagination, Button, Native Select | Pagination은 표시 구조로 사용하고 이전·다음은 실제 button으로 조합해 disabled·키보드 동작 보장 |
| 검색·필터·정렬 | Input, Native Select, Collapsible, Button | 단순 선택에는 native select 사용. 활성 칩의 해제 버튼은 독립적인 접근성 이름 제공 |
| 지원자 표 | Table, Badge, Button | 실제 semantic table 유지. 데이터 로직을 대신하는 테이블 엔진은 도입하지 않음 |
| 작업 안내 | Sonner | mutation 성공/단계 실패는 ID별 toast. form/query 오류는 inline 유지 |
| 상세와 확인 | Sheet, Alert Dialog, Textarea, Input, Label, Button | 상세·단계 확인·작성 중 닫기 확인을 같은 Radix overlay 계열로 전환 |
| 캘린더 탐색 | Button, Native Select, Badge | 기존 7일 grid와 날짜 계산을 재사용. 날짜 선택용 Calendar 컴포넌트를 일정 grid 대신 도입하지 않음 |

Sheet 전환은 상세 scope에서 단계 확인과 함께 수행한다. 현재 scope의 Dropdown Menu와 Sonner portal은 native dialog 안에 배치해 top layer에 가리지 않게 한다. 후속 Sheet 전환 때 이 container 연결을 함께 정리한다. 기존 `showModal()` 호출 여부 대신 dialog 이름, modal 동작, Escape, 포커스 이동·복귀의 사용자 계약으로 회귀 테스트를 갱신한다. 기존 안전 계약을 제거하여 테스트를 맞추지 않는다. [Sheet](https://ui.shadcn.com/docs/components/radix/sheet), [Alert Dialog](https://ui.shadcn.com/docs/components/radix/alert-dialog), [Pagination](https://ui.shadcn.com/docs/components/radix/pagination)

### 3.2 shadcn lint를 실제 수정 루프에 연결

`shadcn lint`는 이 명세에서 **`@shadcn/lint` ESLint plugin**을 의미한다. 별도의 `npx shadcn lint` 명령을 가정하지 않는다. 기존 `eslint.config.js`와 `npm run lint`에 통합하고 기존 TypeScript·React rules를 유지한다. [공식 저장소](https://github.com/shadcn-ui/lint)

2026-10-07 npm metadata 조회에서 `@shadcn/lint`는 0.2.0, Node >=20.19, ESLint >=9.30, TypeScript parser >=8.40을 요구했다. 현재 shell Node는 24.18.0이고 package.json의 ESLint는 ^9.39.1이다. 구현 시 실제 lockfile 해석값과 CI Node도 확인하고 호환 버전을 고정한다. 설치 성공이나 호환 검증 완료를 의미하지 않는다.

아래 규칙을 새로 작성·전환한 제품 UI에서 error로 적용하는 정책을 제안한다. 공식 SETUP의 플러그인 등록만으로는 디자인 규칙이 활성화되지 않으므로, 등록 확인과 규칙 검증을 분리한다.

| 규칙 | 제품 UI 정책 |
|---|---|
| `shadcn/no-restyle` | `allow: ["layout"]`. 색·글꼴·모서리 변경은 컴포넌트 variant 또는 theme에 정의 |
| `shadcn/no-raw-colors` | 선언된 semantic token 사용 |
| `shadcn/no-arbitrary-values` | 임의 숫자 utility 대신 spacing·size token 사용 |
| `shadcn/no-inline-styles` | inline style로 규칙을 우회하지 않음 |
| `shadcn/no-unknown-classes` | 실제 Tailwind에서 생성 가능한 class만 사용 |
| `shadcn/require-static-classes` | 동적 문자열 조립 대신 명시적인 class/variant 매핑 |

- 적용 경로는 `src/features/recruitment-board/components/**/*.{ts,tsx}`의 새 제품 UI와 `src/components/ui/**/*.{ts,tsx}`다. `components.json`을 통해 컴포넌트·theme 탐색을 연결한다.
- `src/components/ui/**` 내부에서는 `no-restyle`, `no-arbitrary-values`, `require-static-classes`만 공식 가이드대로 해제한다. 컴포넌트 정의가 자체 스타일과 전달 props를 처리하기 위한 예외다. 기존 TypeScript·React lint는 유지한다.
- 기존 CSS Module 기반 `App.tsx`와 CSS 파일은 이 디자인 lint의 전체 검증 대상이라고 주장하지 않는다. 새 UI는 위 경로로 옮기고 App에는 상태와 연결 코드를 남겨 새 화면이 검사 밖에서 구현되지 않게 한다.
- 새 규칙을 만족하려고 광범위한 disable이나 사용하지 않는 token을 추가하지 않는다. 필요한 예외는 위치·이유·대체 판단을 DECISIONS에 기록한다.
- 설치 직후 새 UI 경로에 임시 위반 예제(`p-[13px]` 등)를 만들어 해당 rule ID와 nonzero exit를 확인한다. 예제를 제거하고 실제 컴포넌트가 통과하는지 확인한다. 플러그인 로딩 성공만을 lint 도입 완료로 보지 않는다.
- lint는 접근성·데이터 복구·시각 품질 검증을 대신하지 않는다. 실제 브라우저 검증을 병행한다. [규칙과 component 예외](https://github.com/shadcn-ui/lint/blob/main/docs/rules.md)

### 3.3 UI 기반 수용 기준

- UI-01: 첫 기능인 페이지네이션이 shadcn 컴포넌트로 실제 렌더링되고 새 Tailwind token과 alias가 dev·test·build에서 해석된다.
- UI-02: 위반 예제는 지정된 lint 규칙으로 실패하고 정리 후 `npm run lint`는 통과한다. 검사 경로와 예외가 보고서에 드러난다.
- UI-03: 배포 base·MSW 요청 경로·기존 업무 탭이 유지되며 기존 전역 CSS와의 충돌이 없다.
- UI-04: 본문·입력은 최소 14px, 보조 문구는 최소 12px로 정리한다. 주요 조작 버튼은 데스크톱 최소 높이 36px, 터치 화면 최소 44px 목표로 적용한다. 상태를 색상만으로 구분하지 않는다.

## 4. 페이지네이션

기본 20명, 선택 20·50·100명, 이전·다음과 현재/전체 페이지를 제공한다. 숫자별 페이지 버튼, 첫/끝 이동, 번호 직접 입력, URL·localStorage 페이지 저장은 제외한다.

### 4.1 수용 기준

| ID | 동작 및 통과 조건 |
|---|---|
| PAG-01 | 최초 진입은 1페이지·20명이다. 240명일 때 본문 20행, `총 240명 · 1–20명`, `1 / 12 페이지`를 표시한다. |
| PAG-02 | 단계 필터 아래·첫 행 위 왼쪽에 `총 N명 · A–B명`, 오른쪽에 `20명씩 보기` select(20·50·100명)를 둔다. 표 아래에는 `이전`, 현재/전체 페이지, `다음` 탐색을 유지한다. 첫 페이지의 이전과 마지막 페이지의 다음은 실제 button의 disabled 속성을 사용한다. |
| PAG-03 | 2페이지는 21–40명, 마지막 12페이지는 221–240명이다. 모든 페이지를 순서대로 탐색하면 필터·정렬 결과의 각 ID가 정확히 한 번 나타난다. |
| PAG-04 | 페이지 크기를 변경하면 1페이지로 이동한다. 240명에서 50명 선택 시 50행·5페이지, 마지막 페이지는 40행이다. 허용된 세 값만 UI 상태로 받는다. |
| PAG-05 | 이름·직무·담당자·포지션·단계·일정 없음·기한 초과 필터 또는 정렬이 변경되거나 필터가 초기화되면 1페이지로 이동한다. 페이지 크기는 유지한다. 같은 개수의 다른 검색 결과로 바뀌어도 초기화한다. |
| PAG-06 | Positions의 `지원자 보기`는 해당 포지션 필터와 1페이지를 함께 적용한다. 단순히 다른 업무 탭에 갔다가 Applicants로 돌아오면 필터·정렬·페이지·페이지 크기를 유지한다. 브라우저 새로고침은 1페이지·20명으로 시작한다. |
| PAG-07 | 별도 결과 count badge는 없애고 `총 N명 · A–B명`으로 통합한다. 페이지당 표시와 현재 표시 범위를 함께 표 상단에 둔다. 단계 탭 수는 단계 조건을 제외한 나머지 필터 결과 전체를 기준으로 유지한다. |
| PAG-08 | 필터 결과 0명은 기존 빈 상태·필터 초기화를 표시하고 페이지 탐색 영역을 숨긴다. `1 / 0`이나 `1–0명`을 출력하지 않는다. 원본 0명·조회 로딩·오류는 기존 전용 화면을 유지한다. |
| PAG-09 | 결과가 1명 이상이고 한 페이지 이하면 탐색 영역을 표시하고 이전·다음을 모두 비활성화한다. 현재 페이지가 새 마지막 페이지를 초과하면 즉시 마지막 유효 페이지로 보정해 빈 표를 남기지 않는다. |
| PAG-10 | 페이지 이동·크기 변경은 query cache의 원본 배열과 저장소를 수정하지 않는다. 이동 대기 중에도 다른 페이지로 갈 수 있으며 복귀한 지원자의 pending 상태는 기존 ID 기준으로 유지한다. |
| PAG-11 | 상세는 전체 cache에서 선택 ID로 조회한다. 상세에서 단계 변경으로 행이 현재 페이지에서 사라져도 상세와 처리 결과는 유지한다. 닫을 때 연결된 원래 버튼에 포커스를 복원하고, 버튼이 사라졌으면 지원자 제목으로 복원한다. |
| PAG-12 | 키보드로 select와 이전·다음을 조작할 수 있다. 하단 탐색은 표 스크롤 밖의 전체 너비 footer에 중앙 정렬한다. 모든 화면의 이전·다음은 최소 80×44px, 그룹 간격 8–12px, 상하 padding 16px 이상, 페이지 문구 14px 이상이다. 1440·768·390px의 실제 bounding box와 스크린샷을 확인한다. |

### 4.2 상태와 계산

`App`의 기존 filters와 같은 수명으로 `page`(1 기반)와 `pageSize`를 보관한다. `ApplicantsView`가 업무 탭 전환으로 unmount되어도 탐색 맥락이 유지되어야 한다. 페이지별 지원자 배열을 별도 state에 복제하지 않는다.

기존 `workspaceSelectors.ts`에 지원자 전용 순수 함수를 추가한다.

```ts
type ApplicantPageSize = 20 | 50 | 100

function paginateApplicants(
  applicants: Applicant[],
  page: number,
  pageSize: ApplicantPageSize,
): {
  items: Applicant[]
  page: number
  totalPages: number
  total: number
  from: number
  to: number
}
```

입력 배열은 모든 필터와 선택한 정렬이 적용된 결과다. `page`는 내부 UI의 정수 상태이고, 외부 입력 경로는 만들지 않는다. 낮거나 높은 범위의 정수는 유효 범위로 보정한다.

1. `total = applicants.length`, `totalPages = Math.ceil(total / pageSize)`.
2. 유효 페이지는 `min(max(page, 1), max(totalPages, 1))`이다.
3. 시작 인덱스는 `(유효 페이지 - 1) * pageSize`, 행은 `slice(시작, 시작 + pageSize)`다.
4. 0명이면 `page=1`, `totalPages=0`, `from=0`, `to=0`, `items=[]`를 반환한다.
5. 그 외 `from=시작+1`, `to=min(시작+pageSize, total)`이다. 원본 배열과 엔티티를 변경하지 않는다.

필터·정렬 변경·초기화·Positions 진입의 기존 호출 경로를 모두 확인하고, 해당 이벤트에서 탐색 조건과 페이지를 함께 갱신한다. 결과 개수만 감시해 필터 변경을 판단하지 않는다.

데이터 변경으로 페이지가 범위를 벗어나면 계산 결과로 즉시 렌더링하고 보정값을 페이지 상태에도 반영한다. 이후 결과가 다시 늘어났다는 이유로 과거의 범위 밖 페이지로 되돌아가지 않는다.

### 4.3 단계 이동·실패·포커스 정책

- 전체 단계 보기에서 이동하면 페이지 번호를 유지하고 선택한 정렬을 다시 계산한다. 기본 지원일 정렬에서는 행 순서를 유지하고, 지연 우선 정렬에서는 종료 여부 변경으로 행이 이동할 수 있다.
- 특정 단계 필터에서 지원자를 이동하면 낙관적 변경 직후 그 행이 빠지고 뒤의 행이 당겨진다. 마지막 페이지가 없어질 때만 직전 유효 페이지로 보정한다.
- 예: 필터 결과 21명·2페이지에서 유일한 행을 이동하면 20명·1페이지가 된다. 실패하면 원래 지원자를 cache와 필터 결과에 복원하되 현재 1페이지를 유지한다. 복원된 지원자는 원래 순서에 따라 2페이지에 있을 수 있으며 지원자 이름·ID가 있는 지속적인 실패 toast로 안내한다. 행이 다른 페이지에 있어도 오류를 확인할 수 있어야 한다.
- 실패한 A만 복구하고 성공한 B는 유지한다. 페이지 변경이나 페이지 보정이 mutation 취소, 전체 snapshot 복원 또는 추가 PATCH를 일으켜서는 안 된다.
- 명시적인 이전·다음 실행 후 지원자 제목(`tabIndex=-1`)에 포커스를 옮기고 해당 제목이 보이도록 스크롤한다. 자동 페이지 보정은 사용자의 다른 유효한 포커스를 빼앗지 않는다. 실행한 행이 제거되어 포커스가 유실될 때는 제목을 사용한다.
- 필터 입력 중 포커스는 해당 입력에, 페이지 크기 변경 후 포커스는 select에 유지한다. 상세·확인 dialog가 열려 있으면 배경 제목으로 포커스를 이동하지 않는다.
- 페이지 상태 문구는 `role="status"`로 현재 페이지·전체 페이지·표시 범위를 함께 안내한다. 탐색 영역의 접근성 이름은 `지원자 페이지 탐색`, 버튼 이름은 `이전 페이지`·`다음 페이지`다.
- 상세 닫기와 확인 취소의 기존 focus 복귀 경로도 확인한다. trigger가 연결되어 있으면 그대로 복귀하고, Applicants의 trigger가 제거된 경우에만 위 fallback을 적용한다.

## 5. 함께 구현할 UIUX 요구사항

### UX-01. 필터 상태와 정렬

- 항상 보이는 도구는 이름 검색, 직무, 정렬, `추가 필터`다. 담당자·포지션·일정 없음·기한 초과는 Collapsible 안에 둔다. 단계 탭은 별도로 유지한다.
- `추가 필터 · N`은 그 안의 활성 조건 수만 센다. 펼침 상태와 무관하게 모든 활성 조건은 개별 해제 가능한 칩으로 보인다. 이름 검색 칩도 포함한다.
- 칩의 접근성 이름 예: `담당자 이서준 필터 해제`. 마지막 칩을 제거하면 가까운 남은 칩 또는 검색 입력에 포커스를 복원한다. 접기 후 숨겨지는 내부 요소에 포커스를 남기지 않는다.
- `필터 초기화`는 검색·필터만 초기화하고 정렬과 페이지 크기는 유지한다. 적용 조건이 없으면 초기화 버튼은 disabled다.
- 정렬은 `지원일 최신순`(기본), `마감 임박순`, `지연 우선` 세 가지다. 순서는 **전체 cache → 필터 → 정렬 → 페이지 분할**이다.
- 지원일 최신순: appliedAt 내림차순, 동률은 ID 오름차순. 마감 임박순: 활성 지원자의 dueDate 오름차순, 마감 없는 지원자와 종료 단계는 뒤로 보내고 동률은 지원일 최신순·ID순이다.
- 지연 우선: 활성·기한 초과인 지원자를 먼저 dueDate 오름차순으로 두고 나머지는 지원일 최신순·ID순이다. 오늘 마감은 기한 초과가 아니다. 날짜 비교는 local date를 사용한다.
- `sortWorkspaceApplicants(applicants, sort, today)`는 원본을 변경하지 않는 순수 함수로 기존 selector 파일에 둔다. 빈 배열·동률·마감 없음·종료 단계·오늘 경계를 검증한다.

### UX-02. 작성 중 내용 보호

- 피드백의 평가자·점수·코멘트가 초기값과 다르면 dirty로 본다. close 버튼, Escape, 외부 클릭, 현재 평가를 교체할 단계 전진·불합격·정정은 같은 이탈 guard를 통과한다.
- dirty이면 `작성 계속` / `내용 버리고 계속` Alert Dialog를 띄운다. 기본 포커스는 작성 계속이다. 취소하면 기존 입력과 포커스를 유지하고 요청은 0회다.
- 버리기를 명시하면 요청했던 닫기 또는 단계 변경 흐름을 이어간다. 종료 단계 확인도 생략하지 않는다. 확인 overlay를 순차 처리하고 세 겹으로 동시에 쌓지 않는다.
- 피드백 저장 중에는 닫기·대상 전환·단계 변경을 막고 `저장 중입니다`를 안내한다. 성공하면 dirty를 해제하고 제출 내용을 보여 주며, 실패하면 입력·dirty를 유지한다.
- 새로고침·탭 닫기는 dirty 또는 저장 중에만 native beforeunload 경고를 등록한다. 브라우저 강제 종료에서 입력 복구를 보장하지 않으며 영속 draft는 이번 범위에 없다.
- 지원자·evaluation ID가 달라지면 다른 사람의 form 값을 재사용하지 않는다.

### UX-03. 작업 위치에서 결과 확인 — 승인된 Sonner 정책

- 단계 결과와 피드백 저장 성공은 [shadcn Sonner](https://ui.shadcn.com/docs/components/radix/sonner)로 표시한다. 기존 레이아웃 배너는 제거한다. pending disabled/aria-busy, form 실패 inline alert, query/empty 안내는 유지한다.
- 성공은 4초 후 자동 닫힘, 단계 실패는 Infinity로 사용자의 닫기 또는 해당 지원자의 재시도 성공까지 남긴다. 다른 지원자의 성공은 이 실패를 지우지 않는다. 화면 밖으로 사라진 지원자도 이름·ID로 식별한다.
- ID는 App instance·지원자·작업을 구분한다. 단일 Toaster/live region을 유지하며 지원자 원본 snapshot이나 별도 결과 store를 추가하지 않는다.
- native dialog가 body Toaster를 가리는 실제 동작을 확인하고, 같은 portal host를 최상위 열린 dialog 안으로 옮긴다. Toaster를 복제·재마운트하지 않는다. 상세 위 확인이 열려도 알림과 닫기 버튼이 보이고 클릭 가능해야 한다.
- 실제 스크린리더 음성 검증과 live-region DOM 검증은 구분해 보고한다. D-010의 toast 제외는 D-017로 대체한다.

### UX-04. 상세 패널의 정보 순서와 반응형

- Sheet 내용은 `이름·현재 단계 → 현재 할 일 → 현재 전형 피드백·일정 → 기본 정보 → 이전 평가·메모·타임라인 → 단계 정정` 순서다.
- 이름·닫기 header는 sticky이며 본문만 스크롤한다. 예외적인 단계 정정은 하단의 보조 액션으로 둔다.
- 상세 폭은 데스크톱 최대 32rem, 작은 화면은 가용 너비 전체다. 앱 수준 arbitrary class를 만들지 않도록 Sheet variant 또는 named token에 정의한다.
- 현재 할 일 버튼은 당장 동작하는 피드백 작성으로 해당 form에 포커스할 수 있다. 일정 등록은 UX-07 구현 전에는 동작 가능한 버튼처럼 노출하지 않는다.
- 지원자 표의 이름 열을 sticky로 두고 불투명 배경·경계로 구분한다. 나머지 열을 가로 스크롤해도 이름이 유지되며 키보드 focus ring을 가리지 않는다.
- 필터·페이지 조작부와 상세 입력은 390px에서도 가로로 잘리지 않는다. 전체 body의 수평 overflow를 만들지 않는다.

### UX-05. 캘린더 기간 탐색과 모바일 목록

- `이전 7일`, `오늘`, `다음 7일`로 기준 시작일을 이동한다. 최초 시작일은 local today이며 주간 범위 label도 함께 바뀐다.
- 오늘 날짜는 테두리와 `오늘` 텍스트로 표시한다. 유형·직무·담당자 필터는 기간 이동 중 유지한다.
- 768px 미만은 같은 결과를 날짜별 세로 목록으로, 그 이상은 7일 grid로 표시한다. 같은 이벤트를 중복 DOM으로 만들어 접근성 트리에 두 번 노출하지 않는다.
- 일정 미정 목록은 현재 직무·담당자 조건을 따르고 날짜 범위 밖의 별도 section에 둔다. 유형이 전체 또는 인터뷰일 때만 표시한다.
- 종료 단계 제외 정책을 유지하고 실제 생성되지 않는 `입사` 유형 선택지는 제거한다. 빈 기간은 `이 기간에 일정이 없습니다`와 `오늘` 복귀를 제공한다.
- 업무 탭 왕복 시 기준일과 필터를 유지한다. 월말·연말과 날짜-only의 UTC 변환 회귀를 테스트한다.

### UX-06. 문구와 날짜 표현

- 이름 검색 placeholder는 `지원자 이름 검색`으로 바꾼다. 검색 범위를 임의로 확대하지 않는다.
- 평가 종류 SCREEN/INTERVIEW/FINAL은 기존 매핑을 재사용해 서류검토/면접/처우협의로 표시한다.
- `Live data`는 `데모 데이터`로 바꾼다. 일반 화면의 navigation은 `지원자 / 오늘 할 일 / 캘린더 / 포지션`으로 통일한다.
- 활성 지원자의 마감일 옆에 `오늘 마감`, `내일 마감`, `N일 지연`을 절대 날짜와 함께 표시한다. 그 외 미래 날짜는 절대 날짜만 표시한다. 날짜 없음은 `미정`, 종료 단계에는 긴급도 표현을 붙이지 않는다.
- 날짜-only 값은 calendar day 단위로 계산해 일광절약 시간의 23/25시간 차이에도 날짜 수가 틀리지 않아야 한다.

### UX-07. 다음 행동·일정 등록 연결 — 별도 도메인 scope

기존 [서비스 흐름 설계](2026-09-08-service-flow-improvement-design.md)의 SFI-02~04와 `[stage-scheduling]`을 이어서 구현한다. SFI-01 피드백은 이미 구현된 기반이며 다시 만들지 않는다. SFI-05 mock 데이터 정리는 이번 UIUX 범위에 자동 포함하지 않는다.

- 대표 행동은 `피드백 작성 → 필요한 다음 전형 일정 등록 → 단계 진행`으로 파생한다. 평가 상태와 일정 종류를 실제로 검사한다.
- Applicants·Today·상세의 행동은 같은 순수 next-action 결과를 사용하고 해당 form으로 직접 진입한다.
- 일정 날짜·시작/종료·형식·담당자 입력, 같은 담당자의 기존 일정과 겹침 경고, 저장·실패·재시도 흐름을 연결한다. Date/time은 native input을 사용한다.
- 정상 전진의 선행조건은 UI와 mock API가 함께 검증한다. 불합격·예외 정정 정책은 기존 설계를 따른다.
- 현재 UIUX 후보의 검증·기록·커밋 gate 뒤 최우선으로 구현한다. 남은 overlay 전환·다른 탭 가독성 폴리시는 이 업무 연결 뒤에 둔다. 일정 저장과 상태 동기화가 실제로 구현되기 전까지 이 기준은 완료가 아니다. 외부 캘린더·메일·실제 권한 시스템은 제외한다.

### UX-08. 지원자 화면 압축과 표 가독성

- Applicants의 큰 5개 지표 카드 대신 `지원자 N` 제목과 `진행 중 N · 평가 대기 N` 요약을 둔다. 다른 탭의 전체 cache 기반 지표는 유지한다. 반복적인 Workspace/PIPELINE 제목은 제거한다.
- 검색은 desktop 최소 240px, mobile 전체 너비다. 본문·입력 14px 이상, 보조 12px 이상, 본문 행 약 64px, 일관된 controls와 hover/selected 배경을 적용한다. 지원자 이름 열은 sticky다.
- 전진은 outline Button, 불합격은 접근성 이름·키보드가 있는 Dropdown Menu에서 기존 사유 확인으로 연결한다. 메뉴 portal은 상세 dialog 안에 배치한다.

### UX-09. 일반 행 클릭과 상세 포커스

- 일반 셀과 행 여백은 상세를 열고 이름 button을 복귀 trigger로 사용한다. button/link/input/select/textarea/menu item과 텍스트 선택은 행 클릭에서 제외한다.
- semantic table과 이름 button의 Enter/Space를 유지한다. 닫기/Escape는 연결된 이름 button, 행이 없으면 지원자 제목으로 복원한다.

## 6. 빠른 구현을 위한 순서와 변경 파일

한 번에 한 기능 scope만 구현·검증·기록한다. 아래 전체를 하나의 커밋으로 묶지 않는다. PRD는 승인된 해당 scope의 기준만 갱신한다.

| 순서 / scope | 결과물과 파일 | 필요한 shadcn 컴포넌트 |
|---|---|---|
| 1. `applicants-workspace-ux` | §3·4, UX-01·03·08·09와 Applicants의 UI-04·한국어 nav. package/lockfile, components.json, eslint/vite/tsconfig, index.css, UI source; ApplicantsView 분리, App·selectors·테스트·관련 CSS | Button, Pagination, Native Select, Table, Badge, Input, Collapsible, Dropdown Menu, Sonner |
| 2. `stage-scheduling` | UX-07과 기존 서비스 흐름 명세. domain/API/mock/입력 검증과 기존 피드백·단계 회귀 | 기존 form 재사용 |
| 3. `applicant-detail-workflow` | UX-02·04의 남은 입력 보호·정보 순서·overlay 전환. App의 close/transition guard와 테스트 | Sheet, Alert Dialog, Textarea 및 기존 컴포넌트 |
| 4. `workspace-readability` | 다른 탭의 UI-04·남은 UX-06·평가/상대 날짜 문구 | 기존 기본 컴포넌트 |
| 5. `calendar-navigation` | UX-05. CalendarView 한정 분리·상태·selector·CSS·테스트 | 기존 컴포넌트 |

공통 기록 파일은 `docs/PRD.md`, `docs/TECH_SPEC.md`의 관련 절, `DECISIONS.md`, 현재 scope의 `PROMPTS.md`다. 현행 `.github/workflows/deploy.yml`은 이미 npm lint를 실행하므로 별도 lint job을 중복 추가하지 않는다. runtime 호환에 필요한 경우에만 기존 job을 수정한다.

각 scope의 실행 루프:

1. 현재 feature의 실제 호출 경로와 acceptance ID를 확인한다. 기존 변경을 보존하고 필요한 실패 테스트를 먼저 만든다.
2. 필요한 shadcn 컴포넌트만 CLI로 추가한 뒤 해당 화면에 바로 연결한다. 대체할 공통 UI를 새로 수작업 제작하지 않는다.
3. 관련 파일 ESLint와 focused 테스트를 실행하고 rule이 가리킨 token·variant·구조를 수정한다. 광범위한 autofix·overwrite와 일괄 CSS 전환은 하지 않는다.
4. 해당 feature의 UI가 완성되면 전체 lint/test/build와 브라우저 시나리오를 수행한다.
5. unstaged 후보를 보고하고 프로젝트 사용자 검증 gate를 통과한다. prompt-record와 기록 검증 후 현재 scope만 stage한다. 명시적 커밋 요청 뒤에만 커밋한다.

현재 `applicants-workspace-ux`는 기존 pagination 후보를 사용자의 추가 요청으로 확장한 사용자 검증 전 후보다. 브랜치는 `feat/applicants-pagination`을 유지한다. 2026-10-07 사용자 피드백으로 표시 설정을 상단으로 수정하고 `stage-scheduling`을 다음 최우선으로 변경했다. 이 피드백은 후보 승인으로 취급하지 않는다. 일정 흐름의 도메인/API/UI는 아직 구현하지 않았다.

### 6.1 다음 최우선 `stage-scheduling` 준비 — 구현 전

기존 [서비스 흐름 설계](2026-09-08-service-flow-improvement-design.md)의 SFI-02~04를 현재 모델과 대조했다. 아래는 다음 scope의 실행 준비이며 구현·검증 완료 기록이 아니다.

| 현재 코드와 끊긴 경로 | 다음 작업 |
|---|---|
| `ApplicantsView.StageActionButtons → App.requestMove → useMoveApplicantStage`가 피드백·일정 확인 없이 stage PATCH를 호출 | 순수 next-action을 FEEDBACK / SCHEDULE / MOVE / DONE으로 계산하고 행·상세·Today에서 공유. 현재 전형 피드백 제출 뒤 필요한 면접/처우 일정, 준비 완료 뒤 실제 전진으로 연결 |
| `ApplicantDetail`의 일정은 읽기 전용이고 `selectApplicant`는 ID/trigger만 받음 | 상세 진입에 feedback/schedule 목적을 전달. 행의 일정 등록, Today 일정 미정, Calendar 일정 미정에서 실제 form 첫 입력으로 포커스. 상세 일정 section에 등록·변경과 저장 후 내용 표시 |
| `InterviewSchedule`은 type/owner 없이 interviewer 문자열을 보관 | `ApplicantSchedule`에 INTERVIEW/OFFER 종류와 유효한 ApplicantOwner를 추가. date/startTime/endTime/VIDEO·ONSITE는 재사용. 일정 변경은 현재 한 건을 교체하고 과거 내용은 타임라인에 기록 |
| 일정 PUT API/hook 없음. 피드백 hook은 성공 뒤 cache 병합을 이미 구현 | `PUT /api/applicants/:id/schedule`, schedule hook와 mock DB의 최신 배열 내 해당 ID 교체를 추가. 성공 뒤만 Query cache 갱신, 실패 때 입력·cache·저장소 보존과 inline alert/같은 입력 재시도. 같은 ID 쓰기를 동기식 guard/disabled로 막고 다른 ID는 허용 |
| Today 일정 미정은 INTERVIEW && !schedule, Calendar는 모든 schedule을 INTERVIEW·applicant.owner로 표시 | 실제 next-action이 SCHEDULE인 대상을 일정 미정 큐에 사용. Calendar는 schedule.type/owner/date/time으로 생성, Today 인터뷰는 INTERVIEW 일정만 사용. 저장 직후 Applicants/Today/Calendar를 같은 cache에서 재계산 |
| stage handler는 전이표와 불합격 사유만 검사. `applyStageTransition`은 INTERVIEW만 schedule을 평가자/마감에 재사용 | 정상 전진의 현재 전형 SUBMITTED 평가와 다음 단계 일정 종류를 UI와 서버에서 모두 확인. INCOMPLETE_FEEDBACK/MISSING_SCHEDULE을 구분. rejection/correction 예외를 보존하며 target 종류의 schedule로 pending 평가 생성 |
| `nextAction` 제거 시 `mockDb.hasMissingWorkspaceFields/migrateWorkspaceFields`가 옛 문자열을 다시 채움 | reader/migration/seed/test fixtures도 새 모델에 맞춰 수정. 기존 v1 일정은 INTERVIEW로 보존하고 interviewer가 유효 담당자면 owner로 매핑, 그 외 applicant.owner/기본 담당자로 대체. 저장 키 reset·240명 재생성·1000명 정리는 포함하지 않음 |

입력 계약: 날짜·시작·종료는 native date/time input, 형식은 화상·대면, 담당자는 기존 APPLICANT_OWNERS select다. 선택 날짜·담당자의 기존 내부 일정을 전체 cache에서 시간순으로 보여 주고 현재 수정 중인 ID는 제외한다. `existingStart < newEnd && newStart < existingEnd`만 겹침으로 경고하며 저장을 막지 않는다. 실제 유효한 날짜, 과거 날짜 금지, HH:mm 형식, end > start, 일정 종류·단계·담당자·형식은 UI와 API 양쪽에서 검증한다. 기존 일정 변경도 같은 form과 PUT을 사용한다.

실행 순서와 예정 파일:

1. `applicant.types.ts`, `stages.ts`/테스트, `workspaceSelectors.ts`/테스트: action 분기, 일정 검증·겹침, target 평가 생성과 세 탭 파생 결과의 실패 테스트부터 작성한다.
2. `mocks/handlers.ts`, `mockDb.ts`, `seedApplicants.ts`와 테스트, 새 `api/useSaveApplicantSchedule.ts`: 성공/실패/중복/잘못된 직접 요청/저장소 영속화를 구현·검증한다. `useMoveApplicantStage`와 feedback hook의 동일 ID 교차 쓰기 보호와 개별 rollback 회귀도 확인한다.
3. `ApplicantsView.tsx`, `App.tsx`의 Detail/Today/Calendar와 필요한 form 컴포넌트·CSS, `App.test.tsx`: 기존 피드백 form을 재사용하고 실제 action→form 진입, 실패 입력 유지·재시도, 담당자 일정 확인, 저장→단계 이동→세 탭 반영→새로고침을 연결한다. Sheet 전환은 후속 scope로 남기며 native dialog와 별도 portal을 혼합하지 않는다.
4. SFI-02~04/UX-07 자동·브라우저 검증: 피드백 미작성/일정 누락/종류 불일치 직접 PATCH 차단, 준비 완료 전진, rejection/correction 유지, 다른 ID 동시 성공·실패, 날짜 경계·붙어 있는 시간·중복 경고, 등록/변경/강제 실패/재시도, 키보드·390px·닫기 포커스, refresh 영속화와 전체 lint/test/build를 확인한다.

현재 UIUX 후보의 사용자 검증·prompt-record·현재 scope staging·명시적 commit 전에는 위 제품 구현을 시작하지 않는다. 입력 중 닫기 보호 등 후속 상세 폴리시는 별도 scope로 남되, 일정 입력·저장·실패 안내·재시도·기본 접근성은 stage-scheduling 안에서 완결한다.

## 7. 검증 명세

### 자동 검증

| 범위 | 반드시 확인할 시나리오 |
|---|---|
| shadcn 기반 | alias·theme의 dev/test/build 해석, lint 위반 검출과 수정 후 통과, 기존 MSW·배포 base 회귀 |
| 페이지네이션 | 0·1·20·21·240명, 20/50/100명, 첫/끝 disabled, ID 누락·중복 없음, 원본 불변, 페이지 이동 자체의 추가 GET 0회 |
| 필터·정렬 | 동일 인원수의 다른 검색 결과도 page reset, 개별 칩 해제·초기화, 정렬 동률·마감 없음·오늘 경계, 정렬 후 pagination, 전체 지표 보존 |
| 탭·포지션 | 업무 탭 왕복의 page/size/filter/sort 유지, Positions 진입의 position filter·page 1 적용, Today 큐 전체 유지 |
| 단계 복구 | 21명 중 마지막 행 이동으로 page 2→1 보정, 실패 시 지원자 복원·page 1 유지, 서로 다른 페이지의 A 실패/B 성공, 동일 ID guard |
| 입력 보호 | close/Esc/외부 클릭/단계 변경의 dirty guard, 작성 계속 시 입력·포커스·요청 0회, 버리기 후 원래 행동, 저장 중 이탈 차단, 저장 실패 입력 유지, 다른 evaluation 값 격리 |
| dialog·포커스 | Sheet/AlertDialog 전환 후 focus trap, 제목 연결, Escape가 최상위 확인만 닫음, 취소 후 원래 입력 복귀, row 제거 후 안전한 fallback |
| 결과 안내 | A 실패가 B 성공으로 지워지지 않음, 화면 밖 실패 요약, 상세 내 결과 노출, 중복 live 낭독 방지 구조 |
| 캘린더·날짜 | 7일 전후·오늘 복귀, 월말·연말·UTC drift, 필터 유지와 일정 미정 필터 일치, 종료 제외, 일광절약 경계의 상대 날짜 |
| 다음 행동 | 피드백·일정 미충족 시 올바른 form, 일정 API 검증·실패 입력 유지, 서버 선행조건 거부, 불합격/정정 기존 계약 |

순수 계산은 기존 `workspaceSelectors.test.ts`, 날짜·단계 정책은 해당 model 테스트, 사용자 상호작용은 `src/App.test.tsx`를 확장한다. 새 domain/API 변경은 기존 mock 테스트에 해당 시나리오만 추가한다. 테스트는 강제 성공·실패 handler를 사용하고 랜덤 비율에 의존하지 않는다.

각 feature의 필수 명령:

```bash
npm run lint
npm run test
npm run build
git diff --check
```

shadcn 규칙도 `npm run lint`로 함께 실행한다. 통과한 명령, 테스트 수와 결과, 알려진 기존 경고를 실제 출력에 맞춰 기록한다.

### 실제 브라우저 검증

- 1440px·768px·390px에서 표·필터·pagination·상세·캘린더를 확인한다. 768px은 주간 grid, 390px은 일정 목록이다.
- 첫/중간/마지막 페이지와 크기 변경, 칩 해제, 0건 결과, 키보드 포커스·상단 스크롤을 확인한다.
- 피드백 입력 후 닫기·Esc·외부 클릭·단계 변경, 작성 계속과 버리기, 강제 실패와 재시도를 확인한다.
- 상세 위 확인 dialog의 z-index·backdrop·스크롤 잠금·Escape·포커스 복귀를 실제로 확인한다.
- 표 아래쪽 단계 저장과 페이지를 벗어난 실패가 인지되는지, pending 중 다른 지원자 작업이 가능한지 확인한다.
- 글자 크기·색 대비·터치 영역·sticky 이름·200% 확대·body 수평 overflow를 확인한다. 색 대비 측정과 스크린리더 확인은 수행한 도구·환경·결과를 별도로 기록한다.
- 일정 등록 scope에서는 피드백 작성→일정 입력→전진→새로고침 유지까지 연결 실행한다.

## 8. 완료와 기록

기능별 acceptance 기준, 자동 결과, 직접 수행한 브라우저 검증, 한계와 기각·수정한 AI 제안을 보고한다. 사용자 검증 또는 미검증 범위의 명시적 수용 전에는 완료 기록을 쓰지 않는다.

검증 후 prompt-record로 해당 scope만 기록하고 hash는 `최종 동기화 대기`로 둔다. 기록만 바뀌면 focused prompt 계약 테스트와 diff check를, 제품 코드가 바뀌면 전체 검증과 후보 보고를 다시 수행한다. 현재 scope만 stage하고 명시적 커밋 지시를 기다린다.

전체 개선 완료는 UI-01~04, PAG-01~12, UX-01~09가 각 구현 scope의 근거와 연결된 상태다. 페이지네이션이나 shadcn 설치만 끝난 상태를 전체 UIUX 완료로 보고하지 않는다.
