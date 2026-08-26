# Recruitment Pipeline Board FE

채용 담당자가 지원자를 단계별로 확인하고, 명시적 액션으로 단계를 변경하는 채용 파이프라인 보드입니다.

## 실행

```bash
npm install
npm run dev
```

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
- 성공한 단계 변경은 localStorage에 저장되어 새로고침 후 유지
- 실패한 단계 변경은 UI를 이전 상태로 롤백

## 실패 상태 강제 재현

제출 기본 실패율은 약 15%입니다. 개발 중 성공·실패 상태를 결정적으로 확인하려면 `.env.local`에 다음 값을 사용합니다.

```env
VITE_MOCK_FAILURE_RATE=0
# 또는
VITE_MOCK_FAILURE_RATE=1
```

`0`은 강제 성공, `1`은 강제 실패입니다. 검증 후 `.env.local`의 override를 제거하거나 제출 기본값 `0.15`로 되돌립니다.

## 주요 설계 결정

- 드래그앤드롭 대신 단계 선택 + 이동 버튼 사용
- Query cache를 지원자 목록의 단일 진실 공급원으로 사용
- 전체 목록 snapshot이 아니라 실패한 지원자 한 건만 롤백
- 동일 지원자의 중복 이동은 pending 동안 차단

자세한 판단은 [`DECISIONS.md`](./DECISIONS.md), AI 협업 기록은 [`PROMPTS.md`](./PROMPTS.md)를 참고합니다.

## 구현 범위

### Must

- [x] FR-01 보드·컬럼
- [x] FR-02 지원자 카드
- [x] FR-03 단계 이동과 영속화
- [x] FR-04 낙관적 업데이트와 실패 롤백
- [x] FR-05 이름 검색과 직무 필터
- [x] FR-06 지원자 상세
- [x] FR-07 로딩·오류·빈 상태

### Should

- [x] FR-08 동일 카드 경쟁 상태 처리
- [x] 핵심 테스트
- [x] FR-11 키보드 접근성

Undo와 1,000건 가상 스크롤은 이번 6~10시간 활성 구현 범위에서 제외합니다.

## 배포

- URL: 제출 전에 추가
