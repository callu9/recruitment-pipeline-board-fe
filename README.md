# Recruitment Pipeline Board FE

채용 담당자가 지원자·오늘 할 일·내부 일정·포지션을 한 작업공간에서 확인하고, 명시적 액션으로 단계를 변경하는 채용 운영 workspace입니다.

## 실행

```bash
npm install
npm run dev
```

## 1,000건 성능 모드

기본 240건과 별도 localStorage를 사용하는 1,000건 모드는 다음 명령으로 실행합니다.

```bash
npm run dev:performance
```

production build에서 측정하려면 다음 순서로 실행합니다.

```bash
npm run build -- --mode performance
npm run preview
```

기본 모드와 성능 모드의 성공한 단계 이동은 각각의 저장소에 유지됩니다.

## 검증

```bash
npm run lint
npm run test
npm run build
```

## 기술 구성

- React + TypeScript + Vite
- TanStack Query
- MSW + localStorage mock persistence
- Vitest + React Testing Library
- CSS Modules

## mock API

- 모든 요청에 200~800ms 지연
- 기본 약 15% 실패
- 지원자와 포지션은 결정적인 seed를 사용하며 localStorage에 유지
- 성공한 단계 변경은 localStorage에 저장되어 새로고침 후 유지
- 실패한 단계 변경은 UI를 이전 상태로 롤백
- 단계 이동은 `서류검토 → 면접/불합격`, `면접 → 처우협의/불합격`, `처우협의 → 최종합격/불합격`만 허용
- 일반 단계 변경은 즉시 시작하고, 최종합격·불합격만 native confirmation dialog로 확인
- 최종합격·불합격은 종료 상태이며 이동할 수 없음

## 실패 상태 강제 재현

제출 기본 실패율은 약 15%입니다. 개발 중 성공·실패 상태를 결정적으로 확인하려면 `.env.local`에 다음 값을 사용합니다.

```env
VITE_MOCK_FAILURE_RATE=0
# 또는
VITE_MOCK_FAILURE_RATE=1
```

`0`은 강제 성공, `1`은 강제 실패입니다. 검증 후 `.env.local`의 override를 제거하거나 제출 기본값 `0.15`로 되돌립니다.

## 주요 설계 결정

- 다섯 컬럼 보드 대신 지원자 dense table과 Applicants / Today / Calendar / Positions 탭 사용
- 이름·직무·담당자·포지션·단계·일정 미정·기한 초과 필터와 우측 상세 panel 제공
- 드래그앤드롭 대신 인라인 단계 선택 + 이동 버튼 사용
- Query cache를 지원자 목록의 단일 진실 공급원으로 사용
- 전체 목록 snapshot이 아니라 실패한 지원자 한 건만 롤백
- 동일 지원자의 중복 이동은 pending 동안 차단
- 단계 변경은 optimistic update와 entity-only rollback을 사용하며, 같은 지원자는 중복 이동을 막고 다른 지원자는 병렬 처리
- Undo는 향후 지원자 알림 같은 외부 상태와의 불일치를 막기 위해 지원하지 않음

자세한 판단은 [`DECISIONS.md`](./DECISIONS.md), AI 협업 기록은 [`PROMPTS.md`](./PROMPTS.md)를 참고합니다.

## 구현 범위

### Workspace scope

- [x] Applicants: 240명 지원자 목록, 단계 수, 실데이터 metrics, 필터, 선택·상세 panel
- [x] Today: 오늘 인터뷰, 미작성 평가, 기한 초과, 일정 미정 큐
- [x] Calendar: 주간 인터뷰·평가·처우·입사 일정, 유형·직무·담당자 필터, 일정 미정 목록
- [x] Positions: 포지션별 pipeline/충원/마감일/상태와 지원자 navigation
- [x] optimistic 단계 변경, 동시성 guard, entity-only rollback, semantic/keyboard UI

Undo는 외부 시스템과의 상태 불일치를 만들 수 있고 안전한 역방향 정책이 없어 기각했습니다. 기본 240건과 별도 1,000건 성능 모드는 기존 범위로 유지합니다.

## 배포

- URL: https://callu9.github.io/recruitment-pipeline-board-fe/
