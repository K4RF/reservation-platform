# Visual Redesign 통합 회귀·접근성·시각 검증 (#260)

검증일: 2026-10-28. develop `bb309d6`(PR #269)에서
`feature/#260-visual-redesign-regression` 생성. #253–#259의 PR #263–#269 병합을 Git 이력으로 확인했다.
f0.5.2(Milestone #19, 이전 이름 f0.5.3)의 **개발자 회귀 검증**이며 최종 사용자 승인은 아니다.
새 업무 기능/API/Backend/DB/Auth 구조, 가격·재고·정책·쓰기 안전 규칙은 변경하지 않았다.

## 1. 참조·실제 캡처·미완료 목록

[승인 기준](approved-design.md), Prototype README/ASSETS를 읽고 index의 A1·Search·Detail과
[비교 보드](prototypes/premium-travel/review.html)를 Browser에서 열었다.
Home A1·Navy & Ivory가 목표이며 A2/다른 Palette는 보관안이다.
직접 시안이 없는 Booking/Auth/예약/Admin은 공통 Token과 역할별 정보 계층을 확장한 화면이다.

아래 기존 문서는 당시의 구현·캡처·검증 경계를 보존한다. 새 문서가 과거 측정값을 이번 실행으로 바꾸지 않는다.
이번 대표 캡처는 [evidence/260](evidence/260/)의 **실제 Viewport 이미지**이며 Pixel Diff/사용자 승인이 아니다.

| 화면 / 근거 | 유지한 적용 / 시안과 의도적 차이 | 미완료 또는 후속 |
| --- | --- | --- |
| [Home #253](frontend-home-a1-253.md) | Cinematic 브랜드 풍경·하단 검색. 투명 Header 대신 공통 Ivory Header, 가상 추천 카드 대신 실제 탐색 안내 | 브랜드 풍경은 AI 생성·실매물 아님. 실제 숙소 Media와 별개 |
| [Search #254](frontend-search-comparison-254.md) | 2열/1열 카드·Desktop 필터. Mobile은 Modal 대신 같은 Form의 native details/summary | 실제 사진/카드 최저가·총액·통화/가격순 정렬 없음 |
| [Detail/Room #255](frontend-detail-room-selection-255.md) | 소개/이용 안내·객실 비교·선택 패널. CTA는 static, Room만 native Modal/Sheet | Gallery/객실 사진·Description/Bed/Size/View 없음 |
| [Booking #256](frontend-booking-redesign-256.md) | 예상 요금·투숙객 입력/확인·서버 결과 구분. 새 사진·고정 CTA 없음 | 결제/환불/추가 요금 계약 없음 |
| [내 예약 #257](frontend-reservation-redesign-257.md) | 저장 Snapshot/현재 이름·변경 전후/취소 안내 구분. inline 확인·static CTA | 상태/기간 UI 필터는 없음(API Suite만 존재). 사전 취소 견적 없음 |
| [Auth #258](frontend-authentication-redesign-258.md) | Navy 안내/입력, Mobile 입력 우선. 별도 사진·새 인증 구조 없음 | 지속 인증·실제 Google E2E 미검증 |
| [Admin #259](frontend-admin-redesign-259.md) | 작업 영역·조회/입력·정책 마지막 쓰기·읽기 전용 재고 구분. 통계 Dashboard 없음 | 정책 GET/Media 입력/전체 예약/삭제·Batch 없음 |

### 현재 데이터·자산 준비 상태

Frontend AccommodationResponse/RoomResponse와 Backend의 같은 Response DTO를 확인했다.
이미지 URL·Gallery·Bed/Size/View/Room Description 필드는 없다. Page의 `size`는 Pagination이지 객실 면적이 아니다.
Search/Detail/Room의 미제공 슬롯은 실제 사진 연결·로딩/실패 처리가 완료됐다는 뜻이 아니다.
Home의 WebP 두 개만 브랜드 자산으로 준비되었고 alt="" 장식 이미지와 AI 출처가 유지된다.
Home 이미지 실패 시 검색 Draft/Control 보존은 기존 routes Suite로 검증한다. Browser 네트워크 실패 주입은 미실행이다.

v0.4.1 계약 이후 실제 Media 저장/조회/Admin 입력·권리/출처·URL/후보 크기·alt·크롭·로딩/실패를 연결해야 한다.
Prototype 사진/가짜 금액/리뷰·평점/통화·추가 Metadata를 실제 Catalog로 복사하지 않았다.
이 문서는 v0.4.1 또는 f0.6.0 완료 선언이 아니다.

## 2. 기존 Flow 회귀와 보강

[#232 Coverage](frontend-ui-regression-232.md), [#231 접근성](frontend-responsive-accessibility-231.md),
#241–#244 날짜/인원/복귀/객실 계약을 재사용했다. 새 Lifecycle Suite/Styling Framework/브라우저 테스트 플랫폼은 없다.

| 기존 Suite (`frontend/src/`) | 유지하는 경계 / 이번 보강 |
| --- | --- |
| `test/BookingCreationFlow.integration.test.tsx` | Home→조건/페이지→Detail→Room→Login→fresh Availability→한 번의 POST. Home/Search/입력/완료의 UI 의미 구조 검사 추가 |
| `test/ReservationManagementFlow.integration.test.tsx` | 생성→본인 목록/상세→변경→저장 정책→취소→GET/History. 저장 상태/취소 전 확인/결과/목록의 의미 구조 보강 |
| `test/AdminManagementFlow.integration.test.tsx` | 로그인→숙소/정책→객실→가격→재고. 홈/숙소/객실/Calendar의 의미 구조 보강. 006/011·실패 복구·무재실행 유지 |
| `test/AuthenticationFlow.integration.test.tsx` | 가입/로그인/Logout·401 single-flight·Role. Signup/Login/ADMIN·USER 거절의 의미 구조 보강 |
| 날짜/인원/Room/Navigation 세부 Suite | 최소 1박·키보드·조건 무효화·선택 권한/ID·늦은 응답·Back/Forward·Focus/복귀 계약 재사용 |
| `components/ui/UiStates.test.tsx` | status/alert/atomic·명시적 Retry·표시 전용 책임 유지. Error의 atomic 속성 보강 |
| `test/designTokens.test.ts` | 의미색 대비·동적 Class·Scoped Skin·Overflow/Focus/반응형 계약 유지. authored animation/transition/smooth scrolling 부재 검사 추가 |

새 `test/uiSemantics.ts`는 단일 main/외부 Header/h1, 중복 ID, ARIA 설명 대상, Control Label/이름,
Button 이름 표시 및 img alt 속성을 검사하는 작은 **DOM 구조 Guard**다. 요청·Focus·상태를 바꾸지 않는다.
Native 접근성 이름 계산 전체·보조기기·대비·레이아웃 검사를 대신하지 않는다.
초기에는 Testing Library가 내부 header까지 banner로 조회하는 Context 한계와 무거운 Role 조회가 드러나
section/main 안의 header를 제외하는 저비용 DOM 검사로 보정했다. 서버/앱 Header를 변경한 것은 아니다.
새 Audit Test의 Parameter Property는 `erasableSyntaxOnly`에 맞게 명시적 필드로 수정했다.
초기 전체 실행의 Admin Flow 5초 시간 초과 후 검사 비용을 줄여 기존 Timeout 변경 없이 전체를 다시 통과했다.
테스트 삭제/비활성화나 기능 잠금 완화는 없다.

투숙객·Token URL 금지, Login 뒤 Availability 재조회, 쓰기 자동 401 Replay 금지·Ref Submit Gate,
불명 결과 잠금/GET 검토·소유권·ADMIN 사용자 영역의 본인 예약 제한은 그대로다.
Mock POST/PATCH 성공은 실제 Backend·Redis·DB Race·환불 완료의 증거가 아니다.

## 3. 실제 Browser: 레이아웃·접근성

[읽기 전용 Audit](../../frontend/scripts/ui-audit/README.md)의 실제 AppRoutes/Component/CSS를 사용했다.
가상 USER/ADMIN Hint, Fixture GET, MemoryRouter이며 쓰기는 405로 차단되고 Backend Proxy는 없다.
실제 계정·비밀값을 입력하거나 개발 DB/Volume을 수정하지 않았다.

### 경로와 조건

19개 Ready 경로에서 실제 h1·본문 콘텐츠/성공 데이터와 Loading 해제를 확인했다.
Form Label/ARIA 연결·중복 ID·빈 Button 이름, 문서 `scrollWidth/clientWidth`를 DOM으로 검사했다.
빈 페이지를 성공으로 포함하지 않았다. Role/Scenario/경로가 다른 결과를 구분했다.

- 익명: `/`, `/accommodations?size=2`(comparison), `/accommodations/7?checkInDate=2030-01-01&checkOutDate=2030-01-03&guestCount=2`
- USER: 위 Detail에 `roomId=3`(Booking), `/reservations/42/complete`, `/reservations`, `/reservations/42`
- 익명 Auth: `/login`, `/signup`, `/oauth2/callback`(code/state 없는 invalid), `/missing`
- USER `/admin`: Forbidden, ADMIN `/admin`: 관리 홈
- ADMIN: `/admin/accommodations`, `/admin/accommodations/7`, `/admin/rooms?accommodationId=7`, `/admin/rooms/3?accommodationId=7`
- ADMIN: `/admin/prices?roomId=3&stayDate=2030-07-20`, `/admin/inventories?roomId=3&startDate=2030-07-20&endDate=2030-07-22`

| 조합 | 수 | 관찰 |
| --- | --- | --- |
| Ready 19경로 × 1440×1000 / 390×844 | 38 | 각 문서 Client/Scroll 1425/1425, 375/375. 연결/중복 ID·이름 검사 이상 없음 |
| Home/Search/Booking/예약 상세/Login/Inventory × 768 / 1024 | 12 | 문서 753/753, 1009/1009. Tablet Reflow와 실제 본문 유지 |
| Ready 19경로 × 320×900 / textScale=200 | 19 | root 32px, 문서 305/305. 이름/설명 연결 유지 |
| Search/내 목록/Admin 숙소 × Empty/Error/Loading × 390/1440 | 18 | 실제 상태·0 문서 Overflow. Loading은 10초 API Timeout 전 구간 |

총 **87조합**이다(69 Ready + 18 State). Browser 관찰 Console warn/error는 없었다.
390px Booking 요금 표는 310/400, 재고는 310/576으로 문서가 아닌 이름 있는 Region 안에서만 가로 스크롤한다.
320px/글자200의 Booking은 175/800, 재고는 239/1152였다. 표를 숨겨 통과시키지 않았다.
전체 Browser 조합의 원시 Node Snapshot/Pixel Diff를 영구 저장한 것은 아니며 이 표는 관찰 요약이다.

### 실제 조작과 가림

- 390px Skip Link Enter→`main-content` Focus/solid Outline.
- Home 도시 서울특별시·2명, 달력 방향키로 2026-10-28→29 후 Enter·31 체크아웃·적용.
  Trigger Focus 복귀→Search→Detail→Room Sheet→명시적 선택→Login 안내까지 연결했다.
  Detail 링크에 같은 날짜/인원과 원래 Search Query를 확인했다. 실제 로그인은 하지 않았다.
- USER Fixture Booking 입력→최종 확인 제목 Focus, 수정→`booking-name` Focus와 값 보존.
  가짜 입력만 사용했고 예약 생성 버튼은 누르지 않았다.
- 예약 상세의 달력에서 2030-01-02→04를 적용, 일반 가용성 GET과 변경 확인 제목 Focus를 확인했다.
  저장 350.25 / 새 참고 246,913.56을 구분했다. 변경 확정 PATCH는 실행하지 않았다.
- 취소 확인은 fresh GET 뒤 사전 Fee/Refund 미제공·저장 정책·명시적 동의를 표시했다.
  동의 후 Tab으로 취소 확정 버튼에 접근(top 751.7 / bottom 795.7 < 844). 취소는 실행하지 않았다.
- ADMIN 재고의 이름 있는 Region에서 ArrowRight로 0→80px 이동, solid Outline,
  미생성/OPEN/CLOSED·예약2/가용3 및 단일 날짜 PUT Form을 확인했다. 저장은 하지 않았다.
- Desktop Room Modal 내부 702/702px, Header sticky. 320px/글자200·stress의 Sheet는 303/303px,
  Header static. 닫기→Shift+Tab으로 마지막 선택 CTA(top 715.5 / bottom 851.5 < 900), Tab으로 닫기 복귀,
  Escape 후 원래 Trigger Focus와 Scroll Lock 해제를 확인했다. CTA/긴 Header가 내용을 가리지 않았다.

고정 Mutation CTA는 없고 선택/변경/취소 패널은 static이다. 보이는 Focus와 Label/이름은 위 검사 범위이며
Screen Reader 전체 낭독 순서/실기기 Touch/키보드 인증이 아니다. 실제 Native Browser Zoom은 제공된 IAB 제어에 없어
**미검증**이다. `textScale=200`은 글자/rem Reflow이지 Browser Zoom/OS 배율의 대체 증거가 아니다.

### 대비·상태·Motion·CSS 책임

현재 global CSS에는 authored animation/transition/smooth scrolling이 없다. 따라서 Reduced Motion에
추가로 해제할 앱 모션은 없으며 이 부재를 테스트로 고정했다. OS 설정 변경/모든 Browser 기본 동작 검증은 아니다.
기존 Token Suite가 불투명 의미색 조합 텍스트 4.5:1, Control/Focus 3:1 및 Hero scrim 최악 배경을 산술 검사한다.
색만으로 상태를 표시하지 않고 확정/취소/운영/판매 상태의 텍스트·Disabled/Loading의 모양·Live Region을 유지한다.
모든 합성·Disabled·실제 이미지 전체 대비나 WCAG 준수 인증을 주장하지 않는다.

Source Selector 조사에서 같은 이름의 반복은 Responsive 재정의/의도한 Scope였다.
완전히 같은 Rule 후보였던 `.search-main-fields > .stay-date-range { grid-column: auto; }`도
Desktop 기본값과 40rem 이하에서 중간 `span 2`를 되돌리는 서로 다른 Context여서 유지했다.
동적 `booking-result-cancelled`, `reservation-status-confirmed/cancelled`, `reservation-summary-cancelled`를
생성 위치와 CSS에서 추적해 유지했다. `LoadingState/ErrorState/EmptyState`는 표시만 소유하고
요청·빈 가용성/미생성 재고 판단·Retry·Mutation Gate는 caller가 계속 소유한다.
이번 검사에서 제거할 불필요한 충돌/완전 중복은 확정하지 않아 **Production CSS는 변경하지 않았다**.

## 4. 이미지·로딩·레이아웃 이동 관찰

Audit에 `metrics=1` 선택형 PerformanceObserver 로그만 추가했다. 지원 타입을 확인하고 buffered 관찰하며
URL/Element/ID/Shift Source/투숙객/Token을 제외한 수치만 Console에 기록한다.
외부 전송·Storage·DOM 변경은 없고 pagehide/HMR dispose에서 해제한다. 미지원 환경은 빈 supported 목록이다.
운영 main/빌드 Entry는 변경하지 않았으며 생성된 dist에 Audit Probe 문자열이 없는 것을 확인했다.
API/DB/네트워크 지연 주입·성능 라이브러리·CI 서비스 의존성을 추가하지 않았다.

API 근거: [PerformanceObserver.observe](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceObserver/observe),
[LayoutShift.toJSON](https://developer.mozilla.org/en-US/docs/Web/API/LayoutShift/toJSON).
개별 LayoutShift Entry를 표준 CLS Session Window 점수로 자동 합산하지 않는다.

| 로컬 관찰 | 값 / 경계 |
| --- | --- |
| 브랜드 WebP 파일 | 800w 66,996 bytes / 1600w 219,136 bytes. 기존 크기 예산 테스트 통과 |
| 실제 후보/크롭 | 390px는 800w, 1440px는 1600w URL. complete=true, alt="", 1600×900 속성, cover / 65% 45% |
| 390px Home reload 샘플 | img duration 3.4ms, transferSize 300, bodySize 0. LCP Entry renderTime 1880ms, size 216115 |
| 1440px Home reload 샘플 | img duration 2.8ms, transferSize 300, bodySize 0. LCP Entry renderTime 1152ms, size 911872 |
| Viewport 변경 별도 Entry | LayoutShift value 0.7579419333, hadRecentInput=true. Resize와 후보 교체가 있던 구간. 초기 로딩 점수로 합산하지 않음 |
| 초기 관찰 구간 | 별도 비입력 LayoutShift Entry 미관측. 전체 세션 CLS=0/이미지 이동 없음의 보증은 아님 |

localhost/Vite 개발 서버·Warm cache/재검증 영향·IAB 관찰 샘플이며 Cold Load/운영 Bundle/모바일 네트워크 통제가 아니다.
bodySize=0을 실제 파일 크기나 무전송의 증거로 해석하지 않는다. LCP는 관찰된 Entry이지 최종 필드 성능 분포가 아니다.
API SLO/부하 테스트/Performance Pass·Fail 기준으로 쓰지 않는다. Production 조건의 CLS/LCP·네트워크/CPU 검증은 후속이다.

## 5. 실행 명령·원격 CI·실제 HTTP 구분

Windows PowerShell, Node 24.14.0/pnpm 11.19.0. `frontend/`에서 최종 실행:

```powershell
pnpm install --frozen-lockfile --offline
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
pnpm exec tsc -p scripts/ui-audit/tsconfig.json
node --check scripts/ui-audit/server.mjs
```

모두 성공. 관련 6 files / 80 tests 집중 검증 후 최종 **76 files / 1,103 tests 통과**.
Backend/의존성/Lockfile/환경변수/실행 설정/Workflow 변경은 없으며 Backend test/build·실제 HTTP는 미실행이다.
Frontend CI의 같은 검사 항목을 실행했지만 CI Ubuntu/Node 24.19.0과 OS/Patch까지 동일하지 않다.

선행 PR #269 HEAD `7c946deb16816e3e8ac9fe9b7f4ad883cd40c0e1`의
[Frontend CI](https://github.com/K4RF/reservation-platform/actions/runs/40682142621/job/122795264146)와
[Backend CI](https://github.com/K4RF/reservation-platform/actions/runs/40682142581/job/122795264416)는 success를 확인했다.
이는 이번 #260의 원격 결과가 아니다. 요청은 로컬 브랜치/Commit까지이므로 **이번 브랜치 원격 CI는 미실행**이다.

| 증거 | 이번에 입증한 범위 | 입증하지 않는 범위 |
| --- | --- | --- |
| DOM/HTTP Mock | 실제 Component/Auth/Router/API client 연결·쓰기 Body/Gate/실패/복구 회귀 | 실제 서명·서버 소유권·DB Race·Google |
| Browser Fixture | CSS 렌더·위 관찰/키보드·가상 읽기/안내·로컬 성능 Entry | 실제 Login/예약/관리 쓰기·Native Hosting History |
| 실제 Backend HTTP | 이번 미실행 | 과거 HTTP 기록을 이번 전체 연동으로 재사용하지 않음 |
| 원격 CI | 선행 #259 PR 성공 읽기 확인 | #260 Push/PR 결과 없음 |

## 6. f0.6.0 인계 — 미완료/사용자 확인

1. v0.4.1의 실제 Media/Metadata/정책 읽기 계약과 자산 권리·입력 책임을 확정한 뒤 새 데이터 경로를 검증한다.
2. 승인된 격리 데이터로 실제 로그인→공개 탐색→fresh Availability→예약→본인 목록/변경/취소,
   Admin 숙소/정책/객실/가격/재고·006/011·불명 결과 복구·권한을 검증한다. DB/Volume 삭제나 권한 우회는 하지 않는다.
3. Google 제공자·Refresh/재발급·새로고침 인증·Hosting Deep Link/Native Back/Forward·응답 유실을 실제 환경에서 확인한다.
4. Native Zoom 200/400%, 실기기/가상 키보드·여러 Browser·Screen Reader·선택하지 않은 상태/모든 오류의 시각 검수를 수행한다.
5. Production 성능 조건에서 이미지 실패/후보·레이아웃 이동·Cold Load를 확인하고 #260 Push/PR 후 원격 CI를 확인한다.
6. 사용자가 실제 화면/시안 차이를 직접 검수하고 최종 UI/UX 승인 및 마지막 REVIEW를 판단한다.

f0.6.0 REVIEW/Issue/PR/Milestone을 자동 생성·종료하거나 사용자 승인을 대신하지 않았다.
위 남은 항목을 닫힌 작업처럼 보고하지 않는다. 로컬 Audit 서버/Prototype 서버와 임시 Browser 탭은 종료했다.

## 대표 새 캡처

- Home [1440](evidence/260/home-1440.png) / [390](evidence/260/home-390.png)
- Search [1440](evidence/260/search-1440.png) / [390](evidence/260/search-390.png)
- Detail [1440](evidence/260/detail-1440.png) / [390](evidence/260/detail-390.png)
- Room [Desktop Modal](evidence/260/room-modal-1440.png) / [320·글자200 Sheet 선택 Focus](evidence/260/room-sheet-320-text200.png)
- [Login 복귀 안내 390](evidence/260/flow-login-390.png), [Booking 확인 390](evidence/260/booking-review-390.png)
- [변경 확인 390](evidence/260/change-confirm-390.png), [취소 확인 390](evidence/260/cancel-confirm-390.png), [Admin 재고 Focus 390](evidence/260/inventory-focus-390.png)

모두 실제 서비스 계정/예약/사진이 아닌 Audit Fixture다. 입력된 투숙객도 검증용 가짜 값이다.
