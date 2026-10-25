# 횡단 Responsive·접근성·UI State 개선 (#231)

검증일: 2026-10-26. #244가 PR #248로 병합된 `develop`(`c6b6f96`)에서 작업했다.
화면별 기존 구현과 #241–#244 UX를 유지하고 횡단 표시·조작 문제만 수정했다.
Backend/Domain/API/Auth/의존성/실행 설정과 쓰기 안전 정책은 변경하지 않았다.

## 확인한 문제와 수정

| 확인 근거 | 변경 |
|---|---|
| 320px·세로 Scrollbar에서 clientWidth=305, scrollWidth=320. 15개 Route 중 세로 스크롤이 있는 13개가 문서 가로 넘침 15px | body의 320px 최소 폭 제거. Main/Form Grid track을 `minmax(0, 1fr)`로 제한하고 긴 Text를 값 생략 없이 줄바꿈 |
| 실제 200% 글자/rem 확대의 좁은 Home·Detail에서 Stepper 고정 Grid 폭 208px가 남은 영역보다 큼 | 인원 컨트롤을 wrapping Flex로 변경. 보통은 −/입력/+ 한 줄, 좁으면 DOM/Tab 순서대로 줄바꿈. 최소값·입력·요청 무효화 로직 유지 |
| 320px·200% 확대 모달에서 닫기 Header가 내부 가로 폭을 넘어감(303→343px) | Header Flex 줄바꿈. 수정 후 dialog clientWidth=scrollWidth=303, 닫기 버튼 오른쪽=272px |
| Control border `#9ba8b9`/흰 Surface 대비 2.415:1 | semantic border-control만 `#7b8797`로 보강. 흰 Surface 3.649:1, Background 3.421:1. 브랜드 녹색·Palette 변경 없음 |
| 기존 전역 focus-visible 대상은 일반 Control뿐. 재고 표 Scroll Region은 대상 밖 | `[tabindex]`까지 동일 3px Outline 적용. Skip Link의 Main을 tabindex=-1로 연결하고 Header 위에서 보이도록 z-index 지정 |
| 반복 Checkbox Label은 작은 높이, Loading/Error는 부모별 표현에 의존. 관리자 빈 목록은 별도 일반 문단 | 확인/관리/편의시설 Label에 최소 44px 클릭 영역. 공통 상태 표시 Class와 표시 전용 EmptyState 추출 |

`.ui-state`는 표시만 담당한다. `LoadingState`의 role=status와 `ErrorState`의 role=alert,
수동 Retry Callback을 유지하고 atomic 알림을 추가했다. EmptyState의 상태 문장만 Live Region에
넣고 호출자가 제공한 안내/Link/버튼은 그 밖에 둔다. Search/Room/Reservation/Admin 목록이 재사용한다.
가용성 Empty와 날짜별 재고 미생성은 다르며, 미생성 재고는 기존 Calendar 안의 미생성 표시를 유지한다.
에러가 났다고 Empty로 바꾸거나 자동 복구·쓰기·재전송하지 않는다.

성공/취소 Feedback의 명칭·의미 색과 이미 존재하는 Submit Gate는 유지했다.
예약 확인·취소 확인은 Inline Section이며 새 Modal로 바꾸지 않았다. 실제 Modal은 기존 Room 상세다.
Price/Inventory 표는 좁은 화면에서 **내부** 가로 Scroll을 유지한다. 문서 전체의 overflow-x를
숨기거나 표/안내를 잘라서 통과시키지 않았다.

## 승인 시안 적용 범위

[승인 기준](approved-design.md), Prototype README/ASSETS를 읽고 `index.html`과 `review.html`을
Browser로 열었다. Home A1 1440px, Search/Detail 390px 참조 캡처도 직접 확인했다.
작업 전 현재 카드·입력·목록/상세·Mobile Sheet 구조를 유지하고 가독성/접근성만 보완한다고 명시했다.

Navy & Ivory, Cinematic Hero, 사진 Gallery와 전면 Typography 교체는 **f0.5.3**에 남겼다.
가상 시안 사진/가격/평점/Room Metadata를 실제 데이터에 사용하지 않았다. 실제 Media와 추가
Metadata는 **v0.4.1**, Backend 전체 통합과 사용자 직접 최종 디자인 승인은 **f0.6.0** 범위다.
이번 기록을 A1 전체 적용이나 최종 사용자 승인으로 해석하지 않는다.

## Browser 검사 범위

computer-use 스킬과 [읽기 전용 Audit](../../frontend/scripts/ui-audit/README.md)으로 실제
App Component/CSS를 사용했다. [측정 요약](evidence/231/measurements.json)과 같은 폴더의 PNG를
직접 시각 확인했다. DOM 검사·산술 대비 검사와 실제 화면/키 입력 관찰을 구분한다.

| 검사 | 조합/결과 |
|---|---|
| Home, Login, Sign-up, Search, Detail, 내 예약 목록/상세/완료, Admin Home·숙소/객실 목록/편집·가격·재고 | 15 Route × 320/390/768/1440 = 60. 최종 문서 가로 넘침 없음 |
| 40/48/60rem 경계의 앞/같음/뒤 | 639/640/641, 767/768/769, 959/960/961 × Home/Search/Detail/Admin Home/Inventory = 45. 넘침 없음 |
| 공백 없는 100자 이름·긴 주소/설명/이메일·큰 요금 | Search/Detail/예약 상세/Admin 편집 × 네 폭 = 16. 실제 Stress 콘텐츠 렌더 및 오류 없음·넘침 없음 |
| 200% 글자/rem 확대 | Home/Search/Detail/예약 상세/Inventory × 320/390/1440 = 15. root font-size=32px 확인 후 최종 넘침 없음 |
| Loading/Error/Empty | Search/Detail/내 예약 목록/Admin 숙소 × 390px = 12. 실제 상태 표시와 문서 폭 유지 |

기본 60조합에서 Form Label/ARIA 이름의 존재, 빈 Button Name, aria-describedby/labelledby의
대상 존재를 DOM으로 확인했다. 이 검사는 접근성 트리의 모든 이름 계산이나 Screen Reader 검사의 대체가 아니다.
검사 대상별 H1·실제 Fixture 문자열·글자 크기를 함께 확인하여 빈 페이지를 성공에 포함하지 않았다.
Audit Entry 변경 후 신규 Stress 시나리오가 갱신되지 않은 관찰은 서버 재시작 후 전부 재검증했다.

실제 키보드/화면 관찰:

- 390px 달력에서 ArrowDown으로 2030-01-01→01-08 이동, Enter 선택 시 체크아웃 01-09의
  최소 1박 보정 안내와 선택 상태를 확인했다. 01-10 체크아웃을 적용하면 원래 Trigger로 Focus 복귀.
  기존 Escape 취소/월·주 이동/미적용 범위는 #241 Suite로 계속 검증한다.
- 인원 2→1에서 감소 비활성화·숫자 입력 Focus 복귀, 44px 이상 Stepper Target을 확인했다.
  390px 날짜 버튼은 약 41.84×44px다. 모든 달력 날짜가 44px 폭이라는 주장은 하지 않는다.
- Skip Link의 Enter로 Main에 Focus와 3px Outline이 생겼다. 재고 Region도 3px Outline과
  ArrowRight 내부 가로 Scroll(0→40px)을 확인했다. 390px의 표는 309px 안에서 576px를 Scroll하며,
  문서는 375=375로 넘치지 않는다.
- Room Sheet에서 Shift+Tab/Tab 순환, Escape 닫기, Trigger Focus와 Scroll Lock 해제를 확인했다.
  긴 객실명도 내부 가로 넘침이 없다(373=373). Back/Forward는 기존 Router 테스트로 검증한다.
- USER Hint에서 긴 객실을 선택하여 실제 Booking Form과 예상 합계 19,999,999,999.98의
  표시를 확인했다. 가짜 대표 투숙객 입력까지만 진행했다. 생성·수정·취소·관리 저장 요청은 실행하지 않았다.

대표 증거:

- [수정 전 320px](evidence/231/before-search-calendar-320.png) / [수정 후 320px](evidence/231/after-search-calendar-320.png)
- [달력 390px](evidence/231/date-keyboard-390.png) / [Skip Link](evidence/231/login-skip-focus-390.png)
- [Desktop 긴 데이터](evidence/231/detail-stress-1440.png) / [Mobile Booking](evidence/231/booking-form-stress-390.png)
- [Room Sheet](evidence/231/room-sheet-stress-390.png) / [확대 Sheet](evidence/231/room-sheet-enlarged-320.png)
- [재고 표](evidence/231/inventory-keyboard-390.png)
- [Loading](evidence/231/search-loading-390.png) / [Error](evidence/231/search-error-390.png) / [Empty](evidence/231/search-empty-390.png)

## 자동 검증과 CI

기존 `UiStates.test.tsx`, `designTokens.test.ts`, `routes.test.tsx`, `uiAuditFixtures.test.ts`를
보강했다. Reflow/Flex/Focus 규칙, 의미 색 대비 산술, 알림/명시적 Callback과 Skip Link 목표,
Stress Fixture의 가격·상세 일치와 쓰기 405를 검증한다. 중복 Flow Suite를 추가하거나 기존 테스트를 지우지 않았다.
CSS Source/산술 검사는 실제 Browser 레이아웃·시각 검증을 대신하지 않는다.

```powershell
cd frontend
pnpm install --frozen-lockfile --offline
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
pnpm exec tsc -p scripts/ui-audit/tsconfig.json
```

최종 전체 **76 files / 1,080 tests 성공**. 위 검사 항목 모두 성공했다.
기존 #241–#244, Auth/Booking/예약관리/Admin의 Loading/Error/Empty·조건 변경·늦은 응답·
불명확 결과 잠금 회귀를 포함한다. 기존 성공 Feedback은 관련 Flow/세부 Suite로 검증한다.

Frontend CI와 동일한 검사 항목이지만 로컬 Windows/Node 24.14.0과 CI Ubuntu/Node 24.19.0은
동일 환경이 아니다(pnpm 11.19.0). 새 패키지/서비스/환경변수/Workflow 변경이 없다.
Push/PR 미요청으로 원격 Actions는 실행하지 않았다. Backend 변경이 없어 Backend test/build는
재실행하지 않았고 Compose DB/Volume도 건드리지 않았다.

## 남은 검증과 기준

기준은 W3C의 [텍스트 대비](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html),
[비텍스트 대비](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html),
[Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html),
[Target 최소 크기](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)를 참고했다.
선정한 불투명 Semantic 조합에서 일반 텍스트 4.5:1, Focus/Control 경계 3:1 이상을 산술 검사했다.
모든 합성/Disabled/이미지 대비나 WCAG 전체 준수 인증은 아니다.

Audit은 HTTP Fixture와 MemoryRouter다. 실제 Backend/Google/재고 경쟁·쓰기·Native Browser
History·SPA 배포 검증이 아니다. `textScale=200`은 실제 Browser Zoom/OS 배율과 다르다.
다른 Browser/실기기 Touch/가상 키보드/보조 기술·Screen Reader, 실제 Zoom 200/400%와 사용자
최종 승인은 후속 #232/f0.6.0 검수에서 별도 확인해야 한다. 새 사용자 승인 Issue를 만들거나 자동 완료하지 않았다.
