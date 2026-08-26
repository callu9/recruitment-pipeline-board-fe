# 로컬 브라우저 테스트 가이드

단계 이동의 접근성·낙관적 업데이트를 브라우저에서 확인하는 절차다. 앱 코드나 `.env`를 바꾸지 않고 Chrome DevTools Console에서 요청별 결과를 강제한다.

## 준비

1. 터미널에서 `npm run dev`를 실행한다.
2. 브라우저에서 앱을 열고 지원자 목록이 모두 표시될 때까지 기다린다.
3. DevTools Console을 연다.

목록이 로드된 뒤 아래 helper를 한 번 실행한다. `applicant-001`을 A, `applicant-002`를 B로 사용한다.

```js
(() => {
  const originalFetch = window.fetch.bind(window)
  const plans = new Map()
  const storageKey = 'recruitment-pipeline-board:applicants:v1'
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

  window.stageMoveMock = {
    success(applicantId, delayMs = 0) {
      plans.set(applicantId, { result: 'success', delayMs })
    },
    failure(applicantId, delayMs = 0) {
      plans.set(applicantId, { result: 'failure', delayMs })
    },
    clear() {
      plans.clear()
    },
    restore() {
      window.fetch = originalFetch
      delete window.stageMoveMock
    },
  }

  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url
    const match = url.match(/\/api\/applicants\/([^/]+)\/stage$/)
    const plan = match && init.method === 'PATCH' ? plans.get(match[1]) : undefined

    if (!plan) return originalFetch(input, init)

    await wait(plan.delayMs)
    if (plan.result === 'failure') {
      return Response.json(
        { code: 'MOCK_FAILURE', message: '지원자 단계를 저장하지 못했습니다.' },
        { status: 503 },
      )
    }

    const { stage } = JSON.parse(init.body)
    const applicants = JSON.parse(localStorage.getItem(storageKey))
    const applicant = applicants.find(({ id }) => id === match[1])
    return Response.json({ ...applicant, stage })
  }
})()
```

이 helper는 화면 검증만 위한 임시 응답을 만든다. 강제 성공 응답은 mock 저장소를 갱신하지 않으므로, 새로고침 뒤 영속성은 이 helper로 검증하지 않는다.

## 검증 항목

### 키보드 상세 열기·닫기

1. `Tab`으로 카드의 `상세 열기` 버튼까지 이동한다.
2. `Enter` 또는 `Space`를 누른다.
3. `Esc` 또는 `닫기` 버튼으로 dialog를 닫는다.

기대 결과: dialog가 열리고 닫힌 뒤 포커스가 원래 상세 열기 버튼으로 돌아온다.

### 키보드 단계 이동

1. `Tab`으로 카드의 `이동할 단계` select까지 이동한다.
2. 화살표 키로 목표 단계를 선택한다.
3. `Tab`으로 `이동` 버튼에 이동한 뒤 `Enter` 또는 `Space`를 누른다.

기대 결과: 카드가 즉시 목표 컬럼으로 이동한다.

### pending status와 비활성 상태

Console에 입력한다.

```js
window.stageMoveMock.success('applicant-001', 3000)
```

그 뒤 A를 이동한다.

기대 결과: 3초 동안 `지원자 001님의 단계를 저장하는 중입니다.`가 보이고, 카드의 select·이동 버튼은 disabled이며 단계 이동 form은 `aria-busy="true"`다. VoiceOver를 켠 경우 `Command + F5` 후 상태 메시지가 안내되는지 확인한다.

### 강제 성공 status

Console에 입력한다.

```js
window.stageMoveMock.clear()
window.stageMoveMock.success('applicant-001')
```

A를 다른 단계로 이동한다.

기대 결과: `지원자 001님을 <목표 단계>(으)로 이동했습니다.`가 `role="status"`로 보인다.

### 강제 실패와 rollback

Console에 입력한다.

```js
window.stageMoveMock.clear()
window.stageMoveMock.failure('applicant-001')
```

A를 다른 단계로 이동한다.

기대 결과: 카드는 잠시 목표 컬럼에 나타난 뒤 원래 컬럼으로 돌아간다. `단계 이동을 저장하지 못해 이전 상태로 복원했습니다.`가 `role="alert"`로 보인다.

### A 실패 뒤 B 성공

Console에 입력한다.

```js
window.stageMoveMock.clear()
window.stageMoveMock.failure('applicant-001', 1000)
window.stageMoveMock.success('applicant-002', 1500)
```

1. A를 이동한다.
2. 곧바로 B를 이동한다.

기대 결과: 약 1초 뒤 A가 원래 컬럼으로 복원되고 실패 alert가 표시된다. 약 1.5초 뒤 B 성공 status가 표시되어도 A의 실패 alert가 유지된다.

### 같은 카드 빠른 두 번 실행

Console에 입력한다.

```js
window.stageMoveMock.clear()
window.stageMoveMock.success('applicant-001', 3000)
```

A의 이동 버튼을 빠르게 두 번 실행한다.

기대 결과: 첫 실행 직후 컨트롤이 disabled가 되고 두 번째 실행은 차단된다. Network 패널에는 A의 PATCH가 한 건만 보인다.

### 서로 다른 두 카드 동시 이동

Console에 입력한다.

```js
window.stageMoveMock.clear()
window.stageMoveMock.success('applicant-001', 3000)
window.stageMoveMock.success('applicant-002', 3000)
```

A와 B를 연속으로 이동한다.

기대 결과: 두 카드가 즉시 각 목표 컬럼으로 이동하고, 두 카드의 form이 각각 `aria-busy="true"`가 된다. 한 카드의 요청이 끝나도 다른 카드의 pending 상태는 유지된다.

## 정리

검증이 끝나면 Console에 입력한다.

```js
window.stageMoveMock.restore()
```

새로고침하면 helper도 사라진다. 원래 MSW 성공·실패율과 mock 저장소 동작으로 돌아간다.
