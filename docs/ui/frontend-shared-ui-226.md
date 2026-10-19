# Shared UI / Navigation (#226)

## 범위와 공통 기준

#225가 병합된 `develop` (`d69d0ae`)에서 시작했다. 기존 전역 CSS와 Domain Component를 재사용한다.
새 Button/Form/Modal Library, 공통 Mutation Service, API 또는 인증 저장소를 만들지 않는다.
표현 규칙은 [index.css](../../frontend/src/index.css), 값은 [tokens.css](../../frontend/src/styles/tokens.css)에 둔다.

| 대상 | 적용 기준 | 유지한 의미 |
| --- | --- | --- |
| Header / Footer | 기존 중앙 폭·Flex wrap, 역할별 Navigation과 Footer 유지. 브랜드/Navigation 최소 폭·줄바꿈과 행 간격 보완 | 로그인/USER/ADMIN/재인증 경계와 경로는 기존 AuthProvider/Router가 결정 |
| Navigation | `.nav-link` 공통 간격·44px 최소 높이. Hover와 `aria-current='page'`의 활성 배경/굵기/강조색 | 문자열 class를 쓰는 숙소/내 예약/관리자 Link도 Router의 실제 활성 상태 사용. CSS에서 권한을 숨기거나 만들어내지 않음 |
| 기본 Button | 중립 Surface, 1px solid Border, 동일 Font·Radius·`.5rem .75rem` Padding·44px 최소 높이 | 조회/뒤로/수정 준비 등은 기본 보조 Action. Native type/onClick/disabled 유지 |
| Primary | 명시적 `button[type='submit']`, `.primary-action`의 녹색과 흰색 | Form 제출과 예약 생성/변경 확정. 모든 버튼을 녹색으로 만들지 않음 |
| 위험 Action | `.danger-action`의 Error text/border/surface | 최종 취소 요청을 구별하되 정책 확인·미동의 disabled와 기존 경고 문구 유지 |
| Disabled / Loading | `:disabled` 공통 불투명도·cursor. 실제 `aria-busy` Button 또는 busy Form의 Submit은 wait cursor | disabled만으로 요청 중이라고 추정하지 않음. Root Logout과 생성/변경/취소 요청 Button에 실제 pending 값만 연결. 기존 LoadingState 메시지와 잠금 유지 |
| Input / Select / Textarea | 공통 44px 최소 높이·Padding·Font·Text·Surface·Border·Radius. Textarea 세로 resize 유지 | Checkbox/Radio/hidden은 텍스트 입력 규칙에서 제외; Native date/select와 기본 선택 동작 유지 |
| Error / Focus / Readonly | aria-invalid 빨간 Border, 기존 3px Focus ring. Disabled/readonly는 중립 배경 | Label/오류의 ID 연결과 role 유지. CSS로 validity/disabled를 해제하지 않음 |
| Label / Fieldset | 기존 form-field 간격, 공통 Legend/Border/Radius, 체크 입력 20px 및 간격 | disabled Fieldset의 Native 상호 잠금 유지. 예약 관리의 Legend 없는 그룹은 얇은 구분선으로 중첩 테두리/여백 축소 |
| Card | Catalog/Room/예약/인증/완료/Admin Surface에 공통 Border·Radius·배경 | 역할별 Padding/최대 폭/검색 Grid·Calendar 구조는 유지, 범용 Card Component로 업무 로직 이동하지 않음 |
| Status | 예약·Catalog의 Badge 모양/Font 공통화. CONFIRMED는 저장 확정 상태, CANCELLED는 별도 중립 취소 상태, 운영 상태는 중립 Badge | 기존 상태 문자열 유지. 운영 중/중지나 CLOSED를 예약 가능 보장으로 바꾸지 않음 |
| Heading | 기존 h1–h3 Scale 유지, 실제 확인 패널 h4도 같은 계열로 명시. h2–h4 공통 하단 간격 | 제목 Level/aria-labelledby와 문구 유지; 페이지 정보 구조 재설계는 후속 |
| 확인 UI | 실제 Booking·일정 변경·취소의 인라인 section에 `.confirmation-panel`, 명시적 동의에 `.confirmation-check` | Modal/Dialog/Focus Trap/자동 제출을 추가하지 않음 |
| Action 묶음 | 생성/변경/취소의 `.action-group`은 Flex wrap/gap | 전역 인접 Button Margin으로 Pagination gap을 중복시키거나 좁은 화면에 넘침을 만들지 않음 |

Auth/Admin/검색에 흩어진 Button/Input 규칙을 제거하고 공통 규칙을 소비하도록 했다.
인증은 전체 폭·Google 버튼의 위쪽 여백만 남긴다. Card의 공통 Border/배경 중복도 합쳤다.
#225의 임시 Control 치수 보존용 `inset-control/auth-action/action-inline` 변수는 소비자가 없어 제거하고
공통 Spacing Scale을 사용한다. 기존 색상·역할별 Content Width Token은 유지한다.
현재 재사용 단위는 CSS 표현과 기존 Domain Component다. 이 변경을 새 범용 Component Library로 설명하지 않는다.

## 동작 보존과 테스트

Handler/요청 Body/URL/Retry/Session/소유권/권한/가격·정책 해석은 수정하지 않았다.
Markup 변경은 class·aria-busy와 버튼 묶음용 div뿐이다. `disabled`, Fieldset, 확인 체크,
전송 전 GET, 실패 후 잠금, 재확인·자동 재전송 금지 조건은 기존 코드 그대로다.

- 기존 집중 테스트 9개 파일/128건 통과 후 전체 검증 수행.
- 기존 테스트에 활성 Link·역할별 Header, 생성/변경/취소 Primary·위험 Action 및 실제 pending의
  aria-busy를 추가 확인했다. 중복 요청 차단·불명확 결과 잠금·Admin 상호 잠금 Suite는 재사용했다.
- `designTokens.test.ts`에 Native disabled/확인 표현 계약을 추가하고, 제거된 인증 전용 Hover 검사 대신
  공통 Submit Hover와 중복 금지 계약을 확인한다. 테스트 삭제/skip 없이 유지했다.
- 최종 `pnpm install --frozen-lockfile --offline`, lint, format:check, typecheck, test, build 통과.
  **71 files / 982 tests**, 운영 빌드132개 Module. 별도 Audit 진입점 TypeScript 검사도 통과.
- Dependency/Lockfile/Vite/실행 환경/CI Workflow 변경 없음. 기존 Frontend CI 명령을 로컬에서 실행했다.
  로컬 Node24.14.0/pnpm11.19.0과 원격 Ubuntu/Node24.19.0의 차이는 남는다.
  이번 요청은 커밋까지이며 원격 CI 성공을 주장하지 않는다. Backend 변경/전체 테스트는 없다.

## Browser 증거와 경계 (2026-10-19, Asia/Tokyo)

[측정 원본](evidence/226/measurements.json)에 **22개 렌더링 샘플**, 별도 오류/Focus 및
Booking·변경·취소 확인 관찰, **대표 이미지 10장**을 남겼다.
1440×1000 Desktop / 390×844 Mobile과 일부 320×844 / 768×1024 경계다.
기존 읽기 전용 Audit 서버와 Fixture·합성 역할 Hint를 사용했으며 실제 Backend 로그인·권한 증거가 아니다.

- 로그인 Input/로그인·Google Button 모두 44px. 공통 1px solid Border와 Primary/Secondary 구분 확인.
- 익명/USER/ADMIN Header 항목과 실제 활성 Link 배경 확인. Desktop 폭은 Auth448 / 완료720 /
  예약960 / 넓은 Catalog·Admin1120px로 기존 역할 기준 유지.
- 빈 로그인 입력에서 빨간 aria-invalid Border와 Tab 이동의 3px 녹색 Focus 확인.
- Mobile 확인 패널을 실제 기존 Flow로 열었다. 미동의 변경/취소는 disabled이고,
  취소 사전 금액 미제공·서버 재검증·Rollback 한계 문구가 남는다. Dialog는 0개다.
  대표 투숙객은 점검용 가짜 값만 입력했고 생성/변경/취소 확정·Admin 저장은 실행하지 않았다.
- 측정한 390px/768px 문서는 가로 넘침이 없다. Calendar는 309px 영역에서 576px 내부 스크롤 유지.
  미생성·점유 수량·OPEN/CLOSED는 기존 읽기 의미를 유지한다.
- 사진은 가시 영역만 보존했다. 이미지 크기는 스크롤바 제외/도구 축소로 다를 수 있어 수치 비교는 DOM을 따른다.
  이 샘플을 전체 Control/Browser/실기기·전체 대비·키보드 접근성 합격 또는 최종 디자인 승인으로 간주하지 않는다.

대표 화면: [Desktop Login](evidence/226/login-desktop.jpg), [Admin Room](evidence/226/room-desktop.jpg),
[입력 오류/Focus](evidence/226/input-error-focus-mobile.jpg), [Booking 확인](evidence/226/booking-review-mobile.jpg),
[취소 미동의 상태](evidence/226/cancel-disabled-mobile.jpg), [Calendar](evidence/226/inventory-mobile.jpg).

## 후속 범위

페이지별 배치·정보 계층은 #227–#230, 횡단 반응형/접근성/Loading·Error·Empty 마감은 #231,
회귀 검증은 #232다. #224의 D01(320px 문서 15px 넘침)은 여전히 재현되며 #231,
D02(완료 Link 간격)는 #228에 남긴다. Mobile Admin Navigation 밀도도 #230/#231에서 다룬다.
f0.6.0 실제 전체 연동·Edge Case·사용자 직접 최종 디자인 검수는 남아 있으며 새 검수 Issue를 생성하지 않는다.
