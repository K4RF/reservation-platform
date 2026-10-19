# Frontend UI 현황 점검과 개선 범위 (#224)

## 결론과 검증 경계

2026-10-19(Asia/Tokyo), 기준 소스 `869581c`에서 기존 UI를 조사했다.
**이번 변경은 Audit 도구·증거·문서뿐이며 기존 index.css/업무 Component/API/인증·제출 잠금은 수정하지 않았다.**

- 실제 Browser에서 1440×1000 Desktop, 390×844 Mobile CSS Viewport와 일부 320×844 경계를 확인했다.
  [62개 측정 기록](evidence/224/measurements.json)과 35개 대표 JPEG를 남겼다.
- 실제 AppRoutes/스타일을 사용했지만 데이터와 익명/USER/ADMIN 상태는 기존 Fixture와 UI Hint다.
  실제 서버 로그인·권한·DB Race·Google OAuth2·실제 단말 E2E를 입증하지 않는다.
- **확인된 결함**, **확인된 현상에 대한 UX 제안**, **코드상 후보/미확인**을 아래에서 구분한다.
  우선순위와 시각적 방향은 PR에서 검토할 **제안**이며 사용자 승인으로 간주하지 않는다.
- 대표 이미지 35장은 실제 가시 영역(viewport) 캡처다. 긴 페이지의 전체 높이는 DOM 측정으로 남겼다.
  초기 전체 페이지 캡처의 offscreen 합성 문제는 증거에서 제외했으며 빈 UI/잘림 결함으로 판정하지 않았다.
  이미지 출력 크기는 스크롤바 제외/캡처 도구의 축소로 설정 뷰포트와 다를 수 있어 폭 비교에는 DOM 값을 사용한다.
  저장된 사진 수가 모든 픽셀/Control의 시각적 승인 완료를 뜻하지 않는다.

재현은 [읽기 전용 도구 안내](../../frontend/scripts/ui-audit/README.md)를 따른다.
Backend/개발 DB는 사용·변경하지 않고, 앱 fetch 쓰기는 차단했다. 생성·변경·취소·관리 저장은 실행하지 않았다.

## 1. Route / Page와 내장 Flow

소스: [routes.tsx](../../frontend/src/app/routes.tsx), [routePaths.ts](../../frontend/src/app/routePaths.ts).
18개 명시 Route 외에 중첩 wildcard 4개와 권한 상태의 ForbiddenPage가 있다.
아래 D/M은 Desktop/Mobile **Fixture 렌더링 확인**이며 실제 HTTP 연동 성공 표기가 아니다.
개별 캡처 ID/Query/역할/뷰포트는 measurements.json에서 확인한다.

| Route | 화면 / 상태 | 접근 | 점검 |
| --- | --- | --- | --- |
| `/` | Home, 탐색 진입 | 공개 | D/M + 320px, [D](evidence/224/home-desktop.jpg)·[M](evidence/224/home-mobile.jpg) |
| `/login` | LoginForm + Google 버튼 | 공개 | D/M, [D](evidence/224/login-desktop.jpg)·[M](evidence/224/login-mobile.jpg) |
| `/signup` | SignUpForm | 공개 | D/M, [D](evidence/224/signup-desktop.jpg)·[M](evidence/224/signup-mobile.jpg) |
| `/oauth2/callback` | 처리/취소/실패/무효 callback | 공개 | D/M 무효 상태만, [M](evidence/224/oauth-invalid-mobile.jpg); 실제 Provider 성공은 미확인 |
| `/accommodations` | Search/Filter/Card/Pagination | 공개 | D/M ready, empty/error/loading 샘플, [D](evidence/224/search-desktop.jpg)·[M](evidence/224/search-mobile.jpg) |
| `/accommodations/:accommodationId` | 숙소 정보·일반 객실·가용성·Booking | 공개, 예약 입력은 USER/ADMIN | D/M, [D](evidence/224/detail-desktop.jpg)·[M](evidence/224/detail-mobile.jpg) |
| `/reservations` | 본인 목록 | USER/ADMIN | USER D/M, [D](evidence/224/reservations-desktop.jpg)·[M](evidence/224/reservations-mobile.jpg) |
| `/reservations/:reservationId` | 본인 상세·Snapshot·변경·취소 | USER/ADMIN | USER D/M, CONFIRMED/CANCELLED 샘플, [D](evidence/224/reservation-desktop.jpg)·[M](evidence/224/reservation-mobile.jpg) |
| `/reservations/:reservationId/complete` | 서버 예약 결과 표시 | USER/ADMIN | USER D/M, [D viewport](evidence/224/complete-viewport-desktop.jpg)·[M](evidence/224/complete-mobile.jpg) |
| `/admin` | 관리 홈·공통 Navigation | ADMIN | D/M, [D](evidence/224/admin-home-desktop.jpg)·[M](evidence/224/admin-home-mobile.jpg) |
| `/admin/accommodations` | 숙소 목록·검색 | ADMIN | D/M 기록 |
| `/admin/accommodations/new` | 숙소 생성 Form | ADMIN | D/M 기록, 저장 미실행 |
| `/admin/accommodations/:accommodationId` | 정보/상태·Booking/Cancellation 정책 입력 | ADMIN | D/M 기록, [M 첫 화면](evidence/224/admin-accommodation-mobile.jpg) |
| `/admin/rooms` | 숙소 선택·객실 목록 | ADMIN | accommodationId=7의 D/M 기록 |
| `/admin/rooms/new` | 선택한 숙소의 객실 생성 Form | ADMIN | D/M 기록, 저장 미실행 |
| `/admin/rooms/:roomId` | 객실 정보/기본 가격/상태 | ADMIN | D/M 기록, [D](evidence/224/admin-room-desktop.jpg) |
| `/admin/prices` | 객실·단일 날짜 선택/DEFAULT·DAILY | ADMIN | D/M DEFAULT 샘플, [D](evidence/224/admin-price-desktop.jpg); DAILY의 실제 시각 상태는 후속 확인 |
| `/admin/inventories` | 날짜 범위 Calendar·단일 날짜 입력 | ADMIN | D/M + 320px, 생성/미생성/OPEN/CLOSED·점유 표시, [D](evidence/224/admin-inventory-desktop.jpg)·[M viewport](evidence/224/inventory-viewport-mobile.jpg) |
| `/accommodations/*`, `/reservations/*`, `/*` | NotFoundPage | 부모 Route 접근 정책 유지 | 대표 global 404 D/M, [M](evidence/224/not-found-mobile.jpg); 모든 wildcard 조합 반복 미실행 |
| `/admin/*` | AdminNotFoundPage | ADMIN | D/M 기록 |
| 별도 URL 없음 | ProtectedRoute의 ForbiddenPage | USER가 `/admin` 접근 | D/M, [D](evidence/224/forbidden-desktop.jpg)·[M](evidence/224/forbidden-mobile.jpg) |
| 별도 URL 없음 | 익명의 보호 경로 → Login | 익명 `/reservations` | Mobile에서 로그인 리다이렉트 확인 |

Booking 입력/확인은 `/booking`이라는 Route가 아니다. 숙소 상세의 가용성 GET 후 선택한 객실 아래
BookingFlow → 대표 투숙객 입력 → 제출 전 확인을 D/M에서 열었다. Fixture 이름/이메일/연락처만 사용했고
POST는 실행하지 않았다. [Mobile 확인 영역](evidence/224/booking-review-mobile.jpg).
변경·취소도 별도 Route/Modal이 아니라 예약 상세 내 section/fieldset이다.
변경 준비 → 참고 가용성 GET → 변경 확인을 D/M, 취소 전 GET/정책 확인을 D/M에서 열었다.
[변경 확인 영역](evidence/224/change-review-mobile.jpg), [취소 viewport](evidence/224/cancel-review-viewport-mobile.jpg).
확인 패널을 열었다는 사실과 실제 예약 변경/취소 성공을 혼동하지 않는다.

## 2. 공통 스타일 기준선 (소스에서 확인)

스타일은 [index.css](../../frontend/src/index.css)의 전역 CSS다.
package.json에 Tailwind/CSS Modules/별도 UI Theme 라이브러리는 없다.

| 항목 | 현재 확인값 | 평가 / 후속 방향 제안 |
| --- | --- | --- |
| 브랜드/본문 | `--accent:#17675f`, `--ink:#173a39`, `--line:#dce5df` | 기존 녹색 방향을 유지하는 의미별 Token 제안; 새 Palette 승인 아님 |
| 배경/Surface | `#f7f8f4`, `#fff`, `#edf2eb` | Background/Surface/Selected 역할 정리 |
| 보조 텍스트 | `#4b5563`, `#536760`, `#52675f` | 역할별 muted/subtle 기준 필요, 사용 전체를 무조건 단색으로 바꾸지 않음 |
| Border | `#dce5df`, `#dbe2ec`, `#9ba8b9` | 장식선과 입력 경계 의미 분리 |
| 상태 | Error `#b42318`, CONFIRMED `#e2f3ed/#205c4d`, CANCELLED `#f2ece7/#655044` | 상태별 명칭/텍스트 유지; 색만으로 상태를 전달하지 않기 |
| Typography | system-ui, sans-serif; 측정 기본 16px; h1 주로 32px/normal, Card h2 19.2px; Hero p는 clamp | font-size/weight/line-height 역할 Token 후보. 제목 크기 차이 자체를 버그로 판정하지 않음 |
| Spacing/Radius | gap 0.5/0.75/1rem, padding 1/1.25/1.5/2rem·clamp; radius .35/.6/1/1.5rem | 공통 스케일로 이름 부여, 모든 크기를 같게 강제하지 않음 |
| Container | Auth 28rem, 완료 45rem, 예약 60rem, Home/Search/Admin 70rem | Desktop에서 각각 448/720/960/1120px 측정. 화면 역할에 맞는 차이이며 의미별 width Token 제안 |
| Layout | Root main 중앙 Grid, Header/Flex wrap, Admin 12–16rem Sidebar+Content | Root/Header/Footer와 AdminLayout은 공유됨. 화면별 Margin/카드 중첩을 후속 정리 |
| Responsive | 40rem/48rem/60rem, minmax/clamp, body min-width:320px, Calendar min-width:36rem | 320/390/1440 샘플만 확인. Tablet/Breakpoint 경계/Zoom 전체 검증은 #231로 남김 |

로그인 Input은 약 46.8px, 로그인/Google 버튼은 모두 약 48.4px 높이로 이미 일치했다.
따라서 Google 버튼 높이가 반드시 틀렸다고 전제하지 않는다. 새 Google Icon/비밀번호 보기 등은
기존 부재가 곧 결함은 아니며 #227의 승인·범위 확인 후 판단한다.

Cascade 후보: `button`, `.site-brand`, `.home-link`, 인증 버튼, Focus가 파일 앞/뒤에서 재정의된다.
초기 인증 버튼의 `#172033`은 뒤쪽 녹색 규칙으로 덮이며, 일부 더 구체적인 Focus 선택자는 남는다.
이는 소스상 중복 후보이지 모든 상태에서 시각 충돌이 발생했다는 증거는 아니다.

## 3. 확인된 결함과 관찰·제안

P1=좁은 화면 사용성 결함 우선, P2=공통 가독성/일관성, P3=기반 정리·추가 검토의 제안 순위다.
실제 구현 순서는 아래 선행 관계를 따른다. P0 업무/보안 장애를 이번 Audit으로 확인하지는 않았다.

| ID / 분류 | 근거와 사용자 영향 | 제안 / 담당 |
| --- | --- | --- |
| D01 · 확인된 Layout 결함 · P1 | 320px Home/Inventory에서 clientWidth=305, scrollWidth=320으로 문서 가로 넘침 15px. body min-width:320px와 세로 스크롤바 공존이 소스상 설명과 부합. [홈](evidence/224/home-320.jpg)·[재고](evidence/224/inventory-320.jpg) | #231에서 실제 최소 뷰포트/Scrollbar/Zoom 검증과 수정. #225/226 기준을 해치지 않고 전역 넘침과 내부 표 스크롤을 분리 |
| D02 · 확인된 간격 결함 · P2 | 완료 화면의 두 Link가 inline, margin/padding 0, 첫 right=741.1875와 다음 left=741.1875로 공백 없이 붙는다. [viewport](evidence/224/complete-viewport-desktop.jpg) | #228에서 명확한 Action 그룹·간격/작은 화면 배치. #226 공통 Link/Button 역할 재사용 |
| O01 · 시각 현상 확인 · P2 | Admin 버튼은 rgb(240,240,240)/2px outset, Login은 녹색/1px solid. 사용자 예약 fieldset도 기본 groove 테두리가 노출됨. [Admin](evidence/224/admin-room-desktop.jpg)·[예약](evidence/224/reservation-mobile.jpg), ReservationSnapshots의 fieldset 소스 | #226 공통 Primary/Secondary/disabled/fieldset 기준, #229/#230 적용. Native date/select UI 자체는 제거 대상 버그가 아님 |
| O02 · 가독성 개선 제안 · P2 | Mobile Admin Sidebar 높이 442.75px, Content 시작 y=783.75px(390×844)로 첫 화면 대부분이 Header/Navigation. 숙소 상세 전체 문서 높이 5424px인 샘플도 존재 | #230에서 탐색/정보/편집/정책 그룹 계층 정리, #231 횡단 반응형 마감. 경고·명시적 확인/잠금은 삭제하지 않음 |
| O03 · 구별성 후보 · P2 | ErrorState는 role=alert div 안의 p, 일반 p 색 #4b5563을 사용. Field 오류의 빨강과 달리 검색 오류는 일반 안내처럼 보임. [viewport](evidence/224/error-viewport-mobile.jpg) | #231에서 Error/Success/Loading/Empty의 의미·시각 기준 보강. role=alert/status와 메시지를 유지하며 색상만으로 해결하지 않음 |
| O04 · 의도된 동작/보완 제안 · P2 | 390px Calendar 영역 clientWidth=309, scrollWidth=576, 페이지 자체는375=375로 넘침 없음. 오른쪽 가용 수량/상태는 내부 스크롤 필요. [viewport](evidence/224/inventory-viewport-mobile.jpg) | #230/#231에서 스크롤 가능 안내/날짜·상태 가독성 제안. 표를 전역 Overflow 버그로 오인하거나 reserved/available을 편집 필드로 만들지 않음 |
| O05 · 정보 밀도 후보 · P2 | Booking 확인/가격·정책 설명, 예약 변경/취소 확인을 함께 열면 긴 읽기 흐름. 후자는 샘플 전체높이5164px. 독립 Modal이 아니라 내장 영역 | #228/#229에서 단계/요약/Action 계층 개선. 사전 수수료 미제공, 예상/확정 금액, 재확인·무재전송 문구 보존 |
| C01 · 소스상 후보 · P3 | 세 개 CSS 변수 외에 색/간격/radius/폭 직접값과 Cascade 중복 | #225 Token/Global 역할 정리 후 #226 공통 요소 적용. 디자인 시스템 교체/새 Framework 불필요 |
| C02 · 미확인 · P3 | 전체 색 대비, 모든 키보드 순서, textarea/모든 Control Focus, 긴 다국어/최대 금액/200% Zoom·실기기 | #231 검사 항목으로 유지. 이번 숫자/사진을 접근성 전체 합격으로 보고하지 않음 |

긍정 기준선도 유지한다: 390px 샘플의 일반 Home/Auth/Search/Reservation/Admin은 전역 가로 넘침이
측정되지 않았고 Header는 역할에 맞춰 wrap되었다. skip-link를 Shift+Tab으로 포커스했을 때
실제 `본문으로 건너뛰기`와 3px 녹색 outline을 확인했다.
[키보드 스모크 viewport](evidence/224/skip-link-viewport-mobile.jpg). 이는 전체 Keyboard/Screen Reader 테스트가 아니다.
색상 대비의 실제 전체 측정은 이번에 수행하지 않았으며 사진만 보고 대비 합격/불합격을 단정하지 않는다.

## 4. Loading / Error / Empty와 기능 경계

- 실제 공통 Component는 LoadingState(role=status)와 ErrorState(role=alert)다. 범용 EmptyState는 없고
  AccommodationList/RoomAvailability/MyReservations/Admin 등 각 화면이 Empty 표현을 가진다.
- 검색 ready/empty/error/loading과 보호 경로/403/404, CONFIRMED/CANCELLED 및 취소 전 확인을 샘플로 열었다.
  API Loading은 기존 약10초 Timeout 전 DOM 상태를 확인했으며 신뢰할 수 있는 대표 이미지는 남기지 않았다.
  사진에서 성공적인 변경/취소 피드백을 새로 만들어내지 않았다.
- 정책 성공은 직전 쓰기 결과이지 현재 정책 조회가 아니고, 날짜 가격 DEFAULT는 유효한 fallback이다.
  재고 미생성은 0/CLOSED가 아니다. 이 의미를 스타일 변경에서 유지해야 한다.
- 새 업무 기능 결함으로 확정한 항목은 없다. 실서비스 인증·API 오류·지연 Race·쓰기 후 결과/재시도는
  기존 테스트와 f0.6.0 실제 연동 범위다. 실제 기능 결함이 발견되면 CSS 작업과 분리해 후속 보고한다.

## 5. f0.5.1 실행 범위·선행 관계·리뷰 제안

2026-10-19 GitHub의 실제 #225–#232 본문을 확인한 매핑이다. 새로운 Issue/Project 관계는 생성하지 않는다.

| 순서 | 기존 Issue | 이 Audit에서 넘기는 항목 / 완료 제안 |
| --- | --- | --- |
| 1 | [#225 Tokens/Global](https://github.com/K4RF/reservation-platform/issues/225) (선행 #224) | 기존 녹색과 의미별 색·글꼴/행간·간격·폭·radius 기준, Cascade 중복 후보. 기존 크기 차이를 무조건 통일하지 않기 |
| 2 | [#226 Shared UI/Navigation](https://github.com/K4RF/reservation-platform/issues/226) (선행 #225) | 공통 버튼/입력/fieldset/Focus/Card/Navigation 표현. Domain Form/API/submit gate는 합치지 않기 |
| 3a | [#227 Authentication](https://github.com/K4RF/reservation-platform/issues/227) (선행 #226) | 현재 일치하는 버튼 높이를 기준선으로 유지, 제목/Field/Feedback 모바일 배치. OAuth/Token 처리 불변 |
| 3b | [#228 Search & Booking](https://github.com/K4RF/reservation-platform/issues/228) (선행 #226) | D02 링크 간격과 탐색·가용성·선택·예상 요금·확인의 계층. 없는 통화·이미지·추가 요금 금지 |
| 3c | [#229 Reservation](https://github.com/K4RF/reservation-platform/issues/229) (선행 #226) | Native fieldset/확인 영역과 저장 Snapshot·상태·위험 Action 구분. 수수료 미제공/무재전송 유지 |
| 3d | [#230 Admin](https://github.com/K4RF/reservation-platform/issues/230) (선행 #226) | O01/O02/O04, 폼·정책·Calendar 밀도. 현재 없는 삭제/전체 예약관리/Batch 추가 금지 |
| 4 | [#231 Responsive/A11y/State](https://github.com/K4RF/reservation-platform/issues/231) (선행 #227–#230) | D01 우선 재현, 320+·Tablet·Zoom·키보드/대비·상태 표현 횡단 검사, 표 내부 스크롤 보존 |
| 5 | [#232 UI Regression](https://github.com/K4RF/reservation-platform/issues/232) (선행 #231) | 기존 4개 HTTP Mock Flow/세부 Suite 재사용, Browser 증거와 CI 별도. 픽셀 승인 자동 완료 금지 |

화면별 3a–3d는 공통 기준이 병합된 뒤 독립 진행 가능하다. D01이 P1이어도 이번 #224에서 먼저
CSS를 고치거나 다른 Issue 선행 조건을 임의로 바꾸지 않는다. 이번 PR에서 검토할 사항은
**녹색 방향 유지**, **P1/P2 분류와 담당**, **화면별 폭을 역할별 Token으로 유지**이다.

f0.6.0으로 남길 범위: 실제 Frontend/Backend 전체 흐름·Google OAuth2·세션/권한·Edge Case,
다중 탭/실제 지연·동시성 결과, 실제 단말/Browser 조합, 최종 사용자 직접 시각·UX 승인.
마지막 `[REVIEW] Frontend 최종 UI/UX 및 디자인 수동 검수`는 사용자 승인용이다.
이번 요청에서 그 Issue를 생성하거나 자동 완료하지 않는다. 큰 재설계·신규 기능/Backend·배포·부하는 범위 밖이다.

## 6. 검증 기록

- Audit 읽기 전용 Fixture 7개 테스트: 쓰기 차단, 미지원 정책/전체 Admin 예약 API 거절,
  ready/empty/error와 점유 재고/미생성 보존 검증.
- 별도 Audit 진입점 `pnpm exec tsc -p scripts/ui-audit/tsconfig.json`, 서버 `node --check`: 성공.
- `pnpm install --frozen-lockfile --offline`: Already up to date (pnpm 11.19.0).
- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`: 성공.
- `pnpm test`: 70개 파일 / 975개 테스트 통과, `pnpm build`: 성공 (Vite 8.3.1).
- 로컬 Node 24.14.0/pnpm 11.19.0에서 CI와 같은 명령 순서를 실행했다.
  원격 Ubuntu/Node 24.19.0/pnpm 11.19.0과 OS/Patch까지 동일한 검증은 아니다.
- Backend 소스/설정/Schema/의존성은 변경하지 않아 Backend 전체 test/build는 실행하지 않는다.
- 원격 CI는 PR 생성 후 별도로 확인한다. 로컬 통과·Browser Fixture 관찰과 동일시하지 않는다.

대표 증거: [완료 Link 간격](evidence/224/complete-viewport-desktop.jpg),
[320px 경계](evidence/224/home-320.jpg), [Calendar 내부 스크롤](evidence/224/inventory-viewport-mobile.jpg),
[오류 Feedback](evidence/224/error-viewport-mobile.jpg). 측정 파일의 sourceCommit은 기존 UI 기준이며
이번 도구/문서의 커밋 hash나 스타일 변경 후 기준선이 아니다.
