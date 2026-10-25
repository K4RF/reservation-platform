# f0.5.1 UI 회귀 검증·스타일 구조 정리 (#232)

검증일: 2026-10-26. #231의 PR #249가 병합된 `develop`(`34b8b2c`)에서
`feature/#232-ui-regression`을 생성했다. 새 디자인이 아니라 현재 UI의 개발자 회귀 검증이다.
Backend/API/Auth/의존성/환경변수/실행 설정과 Mutation 안전 정책은 변경하지 않았다.

## 정리한 스타일과 책임

| 위치 | 책임과 이번 변경 |
|---|---|
| `frontend/src/styles/tokens.css` | 색·간격·서체·폭의 semantic 원본. 변경 없음 |
| `frontend/src/index.css` 전역 Control/Layout | 공통 입력·Focus·반응형 기반. 기존 배치 유지 |
| 같은 파일의 화면별 규칙 | 인증/탐색/예약/Admin 배치·여백·성공/복구 표시를 계속 소유 |
| 같은 파일의 공통 Alert Skin | 네 군데의 중복된 오류 외형을 일곱 Page Scope의 한 규칙으로 통합. Field Error도 포함 |
| `LoadingState`/`ErrorState`/`EmptyState` | 표시 전용. 조회 수명·빈 결과 판단·수동 Retry·Submit Gate는 호출자가 소유 |
| Room Modal/Sheet | 기존 Focus Trap·닫기·Scroll Lock과 상세 검증 유지 |

단순 문자열 조사에서 미사용 후보 다섯 개가 나왔지만 아래 네 개는 동적 생성 Class였다.
`BookingCompletePage.tsx`의 `booking-result-cancelled`, `ReservationCard.tsx`의
`reservation-status-confirmed`/`reservation-status-cancelled`/`reservation-summary-cancelled`를
유지했다. 호출이 사라진 `.admin-empty-state`만 제거했다. 중복 Selector 이름 16개는
기본값과 Media Query 재정의이므로 제거하지 않았다. 새로운 Styling Framework나 대규모 파일 분리는 없다.

Auth Field의 여백, Admin Border/문단 여백, 공통 `.ui-state.ui-error`의 우선순위를 유지했다.
`designTokens.test.ts`에 단일 오류 Skin·삭제 Selector·동적 상태 Class 유지 검사를 추가했다.
이는 CSS Source 계약 검사이며 실제 Browser Cascade 검사를 대체하지 않는다.

## 기존 테스트 재사용과 Coverage

새 통합 Suite를 복제하지 않았다. 기존 `BookingCreationFlow.integration.test.tsx`의 익명 탐색
사례를 Home에서 시작하도록 확장했다. 날짜/인원 → Search 정렬·크기·다음 Page → Detail →
Room 상세 → Login 복귀 → 가용성 재조회 → 단 한 번의 예약 POST까지 연결한다.
기존 인증 실패·불확실한 쓰기 결과·재전송 금지 테스트는 유지했다.

| 영역 | 기존 검증 근거 (`frontend/src/` 기준) | 검증 경계 |
|---|---|---|
| Header/Auth/Google | `test/AuthenticationFlow.integration.test.tsx`, Auth 세부 Suite | 회원가입·로그인·Logout·동시 401 Reissue·Google Callback/실패. 실제 Google 로그인 아님 |
| 날짜 | `components/room/stayDateRange.test.ts`, `StayDateFields.test.tsx` | 유효 체크아웃 유지, 누락/동일/역전 최소 1박, 월/연도/윤년, 적용·취소·키보드·Focus |
| 인원·정원·무효화 | `components/room/GuestCountField.test.tsx`, Availability 세부 Suite | Stepper/직접 입력·경계, 조건 변경 시 기존 조회/선택 무효화 |
| URL/Page/Scroll/Focus | `pages/AccommodationSearchNavigation.test.tsx`, `BookingFlowNavigation.test.tsx` | 원래 검색 조건과 편집 Booking 조건 분리, Login 복귀·재조회, 위치 복원 |
| Room Modal | `components/room/RoomDetailTrigger.test.tsx` | ID/숙소 관계, 404/오류·수동 Retry, 없는 Metadata 비생성, Back/Forward 재조회, Escape·Focus·선택 조건 |
| Booking | `test/BookingCreationFlow.integration.test.tsx` | 조회와 명시적 생성 분리, Fresh Availability, 단일 POST·401/불확실한 결과 자동 재전송 금지 |
| 예약 관리 | `test/ReservationManagementFlow.integration.test.tsx`, 변경/취소 세부 Suite | 생성→목록/상세→변경→취소, 정책·재고 실패, 응답 유실 뒤 GET 확인·PATCH 재전송 금지 |
| Admin | `test/AdminManagementFlow.integration.test.tsx`, 관리 세부 Suite | 숙소/정책/객실/가격/재고, 401/403/Network, INVENTORY_006/011, 명시적 결과 확인·쓰기 Gate |

네 통합 Suite는 실제 UI Component와 HTTP Mock을 연결한다. 실제 서버 권한·DB Race·Kafka·
Redis·환불/결제 완료의 증거가 아니다. ADMIN 사용자 영역도 본인 예약만 다루는 계약을 유지한다.

## 실제 Browser 회귀 비교

computer-use 스킬로 기존 [읽기 전용 Audit](../../frontend/scripts/ui-audit/README.md)의 실제
App Component/CSS를 실행했다. Backend 대신 Fixture이며 토큰/DB/Volume을 사용하거나 수정하지 않았다.
[측정 요약](evidence/232/measurements.json)은 조합과 경계를 기록한다.

- 390×844/1440×1000에서 15개 Ready Route, 6개 Error, 3개 Empty = 48조합을 정리 전후 비교했다.
  Header/Main 요소의 Bounding Box와 계산된 색·배경·Border·Radius·Padding·Margin·Font·Display·Gap·Overflow,
  문서 폭이 모두 같았다. Ready는 Loading이 사라진 뒤, Error/Empty는 해당 상태 표시를 확인했다.
- Login/Signup의 빈 제출 Field Error를 두 폭에서 별도 비교했다(4조합). 역시 차이 없음.
  전체 52조합의 원시 Node Snapshot을 영구 저장하거나 Pixel Diff로 비교한 것은 아니다.
- 320/768px의 Home/Search/Detail/예약 상세/Admin 숙소/재고 12조합에서 문서 가로 넘침 없음.
  Search/내 예약/Admin 객실의 Loading은 390/1440px 6조합에서 role=status와 문서 폭을 확인했다.
- 관찰한 Audit Tab의 Console error/warn은 0건이었다. 실제 Backend/운영 Browser의 무오류 보증은 아니다.

390px 실제 조작은 Home 도시·Stepper 2명 → 달력 2026-10-28~30 명시적 적용 → Search → Detail →
Room Sheet → 명시적 선택 → Login 안내까지 진행했다. Search/Detail에 날짜·인원이 유지되었고,
Sheet에서 Shift+Tab/Tab 순환, Escape 닫기, 원래 Trigger Focus 복귀를 확인했다.
Sheet 내부 clientWidth=scrollWidth=373px다. 실제 로그인/예약/Admin 쓰기는 실행하지 않았다.
네이티브 날짜 입력 도구 조작만으로 React 값 반영을 확정할 수 없어 Browser 경로는 달력으로 검증했다.
직접 날짜/인원 입력 경계와 Browser History 재진입은 기존 자동 테스트의 증거와 구분한다.

대표 캡처: [오류 Desktop](evidence/232/error-1440.png), [오류 Mobile](evidence/232/error-390.png),
[Room Sheet/선택 Focus](evidence/232/room-detail-390.png), [Login Mobile](evidence/232/login-390.png).
모바일 오류 캡처는 안내를 볼 수 있는 Scroll 위치다.

## 승인 시안과 의도한 차이

[승인 기준](approved-design.md), Prototype README/ASSETS를 읽고 `index.html`/`review.html`을
Browser에서 열었다. Search 390px/Detail 1440px 참조 캡처도 확인했다.
현재 녹색 Token·텍스트 중심 Catalog·기존 Form과 Sheet를 유지하며 오류 외형의 중복만 정리했다.
Home A1/Navy & Ivory·Hero/Gallery 전면 적용은 f0.5.3이며, 실제 Media/추가 Metadata는 v0.4.1이다.
가상 사진/가격/평점/침대/면적을 실제 Catalog 정보로 만들지 않았다. f0.6.0 사용자 최종 승인은 별개다.

## 실행 결과와 CI 경계

`frontend/`에서 실행한 명령:

```powershell
pnpm install --frozen-lockfile --offline
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
pnpm exec tsc -p scripts/ui-audit/tsconfig.json
```

모두 성공. 변경 중 두 Suite 27개, 위 네 통합 Flow와 날짜/인원/Room/Navigation을 묶은
10개 Suite 98개를 먼저 통과했고, 최종 전체는 **76개 파일·1,081개 테스트**를 통과했다.
로컬 Windows, Node 24.14.0/pnpm 11.19.0이다. Backend 변경이 없어 Backend Test/Build는 재실행하지 않았다.

`.github/workflows/frontend-ci.yml`은 Ubuntu·Node 24.19.0·pnpm 11.19.0에서
Frozen Lockfile Install과 같은 lint/format/typecheck/test/build를 실행한다.
이번 변경에 의존성/Lockfile/Workflow/실행 설정 변경은 없고, Offline Frozen Install도 성공했다.
OS/Node Patch 및 온라인 Install까지 CI와 동일한 환경에서 실행한 것은 아니다.

읽기 전용으로 확인한 **선행 #231 PR #249**의 Head `f54d972787e5d616abb8dca9144075990a65fa14`는
[Frontend CI](https://github.com/K4RF/reservation-platform/actions/runs/40210114928/job/121219333298)와
[Backend CI](https://github.com/K4RF/reservation-platform/actions/runs/40210114940/job/121219333233)가 성공했다.
이는 #232 변경의 원격 결과가 아니다. 이번 요청은 로컬 Commit까지이며 Push/PR 및 #232 원격 CI는 미실행이다.

## 남은 검증과 f0.6.0 인계

이번 비교에서 새 업무 결함은 확정하지 않았다. 아래 항목은 통과로 간주하지 않는다.

- 실제 Backend와 Google 제공자를 연결한 전체 로그인/예약/관리 Flow, 실 서버 권한·재고 충돌 및
  응답 유실 후 결과 확인은 별도 비파괴 환경에서 검증한다. Mock/Audit는 실 서버 증거가 아니다.
- Native Browser Back/Forward·Hosting Deep Link 복원, 실제 200%/400% Browser Zoom,
  Screen Reader·터치 기기 검사는 이번 재실행 범위 밖이다. #231의 글자 확대 검증은 Browser Zoom 전체 인증이 아니다.
- 승인 A1 전면 적용·실제 Media 준비 후 Desktop/Mobile 재비교와 사용자 최종 UI/UX 검수를 진행한다.
  f0.5.1 회귀 완료를 사용자 승인으로 바꾸거나 후속 최종 검수 Issue를 자동 생성하지 않는다.
- #232 Push/PR 후 새 Head의 원격 Frontend/Backend CI 결과를 확인해야 한다.

날짜·인원·복귀·Room 상세 계약의 세부 근거는 각각
[#241](../testing/frontend-stay-date-range.md), [#242](../testing/frontend-guest-count-stepper.md),
[#243](../testing/frontend-exploration-return-context.md), [#244](../testing/frontend-room-detail-selection.md),
횡단 접근성은 [#231](frontend-responsive-accessibility-231.md)를 재사용한다.
