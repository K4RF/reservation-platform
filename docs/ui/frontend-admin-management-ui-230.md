# Admin Management UI 정돈 (#230)

## 적용 범위

2026-10-21(Asia/Tokyo), 최신 `develop`의 `53be1aa`에서
`feature/#230-admin-management-ui`를 생성했다. #225 Token과 #226 공통 UI를 재사용했다.
**Backend·API·권한·Mutation/조회 상태 로직·실패 분류는 변경하지 않았다.**

| 영역 | 표현 변경 | 유지한 계약 |
| --- | --- | --- |
| `AdminLayout` / Home | Desktop Sidebar/본문 비율, 제목·보조 안내, Mobile 3열(384px 이하 2열) 메뉴 | 기존 5개 메뉴/active/current 상태와 ADMIN ProtectedRoute, 서버 권한 안내·본인 예약 Link 유지. 새 Dashboard/전체 예약 Admin 없음 |
| 숙소·객실 목록 | 조회 Form의 적응형 열 배치, 생성 Link, 목록 Card·Action 간격, Empty 안내 | 모든 상태 조회·기존 검색/정렬/Pagination·부모 숙소 문맥 유지. 삭제 기능 없음 |
| 숙소·객실 정보 | 조회 정보와 입력 경계, 넓은 화면의 필드 배치, 설명은 전체 행 | 전체 입력/기존 Validation·가격 정밀도·편의시설/운영시간·기존 API와 성공 후 GET 유지 |
| 운영 상태 | 별도 Form 배경, ACTIVE/INACTIVE 텍스트, 운영 중지 선택 시 경고 톤 | 운영 중지는 삭제가 아님. 기존 확인 Checkbox와 disabled 유지 |
| 숙소 정책 | 정책별 Section·필드 배치, 직전 성공 응답의 별도 결과 Panel | GET/DELETE 없음, POST/PUT 직접 선택·전체 입력·동의 유지. 성공 응답은 현재 정책 조회가 아님 |
| 단일 날짜 가격 | 조회 대상/서버 적용값/입력 Form 구분, 금액·DEFAULT/DAILY 출처 강조 | DEFAULT는 유효한 기본 가격, 직전 GET 기준 생성/수정. 충돌 시 자동 전환/재전송 없음. 통화 추정 없음 |
| 재고 Calendar | 내부 가로 스크롤 안내·설명 연결, 날짜 선택 행/버튼, 수량 정렬, OPEN/CLOSED/미생성 구별 | 양 끝 날짜 포함, 미생성은 0/CLOSED 아님. 예약/가용 수량은 읽기 전용. CLOSED도 점유·가용 수량 유지 가능 |
| Feedback | Admin에만 Error/Loading/Empty·저장 성공·불명 결과 복구 경계 구분 | 기존 role=alert/status, 페이지 제출 Gate·Native fieldset disabled·확인/복구 조건 유지 |

경로는 `frontend/src/layouts/`, `pages/admin/`, `components/admin/` 기준이다.
새 Library/Route/Modal/삭제·일괄 쓰기는 추가하지 않았다. 공통 USER 화면 스타일은 바꾸지 않고
Admin 전용 Class와 `.admin-content` 범위를 사용했다. 표는 원문을 자르거나 전역 overflow를 숨기지 않는다.

## 저장·복구 경계

- `useAdminMutation`, API Client, AuthProvider/ProtectedRoute, HTTP 요청·Callback은 변경하지 않았다.
  관리 쓰기의 401 자동 재전송 방지와 페이지 단위 동시 제출 잠금도 그대로다.
- 불명확한 저장 결과는 이미 반영됐을 수 있다는 안내·별도 결과 확인·명시적 잠금 해제를 유지한다.
  단순 GET이나 화면 이동/Abort를 Rollback 또는 재제출 허가로 취급하지 않는다.
- **재고는 모든 쓰기 실패 후** 최신 Calendar GET → 결과 확인 → 새 요청 동의가 필요하다.
  일반 불명 결과 복구와 합치지 않았다. `INVENTORY_006/011` 자동 수량 보정/재전송은 없다.
- 정책 성공 Panel은 **직전 쓰기 응답**일 뿐이다. 정책 조회 API나 존재 감지를 추가하지 않았다.
  재고·가격·정책의 서로 다른 복구 흐름을 하나의 범용 Form으로 합치지 않았다.

## 검증

### 자동 검사 / CI 검토

- 기존 Admin 세부 Suite, `adminRoutes.test.tsx`, `AdminManagementFlow.integration.test.tsx`를 재사용했다.
  새 Flow 중복 파일은 만들지 않았다. 상태 Badge 때문에 직접 자식 텍스트를 전제하던 선택자는
  Region/Cell 의미 기반으로 바꾸고, 재조회로 DOM이 교체되는 경우 최신 Region을 다시 찾는다.
  기존 요청 Body·점유/예약 Snapshot·권한·중복 제출·실패 복구 검증은 제거하지 않았다.
- 기존 Inventory 테스트에 Scroll 설명/포커스 진입·날짜 선택 의미를 보강했다.
  `designTokens.test.ts`에 Admin 스타일 범위/Calendar/복구·성공 표현 소스 계약 1건을 추가했다.
  jsdom/소스 검사는 실제 Pixel/키보드/Screen Reader 전체 검증이 아니다.
- 관련 **7 files / 201 tests**, 전체 **71 files / 982 tests** 통과.
- `pnpm install --frozen-lockfile --offline`: Already up to date.
- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build`: 성공.
  `pnpm exec tsc -p scripts/ui-audit/tsconfig.json`도 성공했다.
- 의존성·Lockfile·환경변수·실행 설정·Workflow 변경 없음.
  `.github/workflows/frontend-ci.yml`의 검사 명령을 Windows / Node 24.14.0 / pnpm 11.19.0에서 실행했다.
  CI는 Ubuntu / Node 24.19.0이므로 동일 OS/Patch 재현은 아니다. push/PR은 요청하지 않아
  **이 브랜치 원격 CI는 미실행**이다. Backend 변경이 없어 Backend test/build는 재실행하지 않았다.

### Browser 관찰

`computer-use` 스킬로 기존 [읽기 전용 Audit](../../frontend/scripts/ui-audit/README.md)의
실제 AppRoutes/Component/CSS를 확인했다. 데이터는 HTTP Fixture, 역할은 서명 없는 ADMIN UI Hint다.
실제 Backend·DB·인증을 증명하는 E2E가 아니다. 모든 쓰기는 도구에서 차단했으며,
**관리 생성/저장/상태 변경의 최종 버튼을 누르지 않았다.** 정책 PUT 선택과 날짜 선택만 수행했다.

[20개 측정 기록](evidence/230/measurements.json)과 17개 viewport JPEG를 남겼다.
`sourceBaseCommit`은 변경 전 기준이고 캡처는 이번 작업 트리 스타일이다. 이미지 축소/스크롤바 때문에
출력 크기는 설정 viewport와 다를 수 있어 폭/넘침 판단은 DOM 값을 따른다.
스크롤 후 Rect의 top은 viewport 좌표다. fieldset의 computed grid 문자열은 Browser 특성상
미해결 표현일 수 있으므로 이것만으로 실제 열 개수를 단정하지 않는다.

| 확인한 상태 | 결과 / 대표 증거 |
| --- | --- |
| 공통 탐색 | [Desktop](evidence/230/home-desktop.jpg)·[Mobile](evidence/230/home-mobile.jpg). 390px Sidebar 215.25px / 본문 시작 y=538.64px. #224의 약442.75px / y=783.75px 대비 탐색 부담 축소. 권한·본인 예약 안내는 숨기지 않음 |
| 숙소 목록/정보/정책 | [Desktop 목록](evidence/230/accommodations-desktop.jpg)·[Mobile 검색](evidence/230/accommodations-mobile.jpg), [Desktop 정보](evidence/230/accommodation-edit-desktop.jpg)·[Mobile 정보](evidence/230/accommodation-edit-mobile.jpg), [Desktop 정책](evidence/230/policy-desktop.jpg)·[Mobile 정책](evidence/230/policy-mobile.jpg). 명시적 PUT 선택 후에도 동의 전 저장 disabled 유지 |
| 객실 정보/상태 | [Desktop](evidence/230/room-edit-desktop.jpg)·[Mobile](evidence/230/room-edit-mobile.jpg). 기본 가격과 별도 날짜 가격 Link 구분, 운영 중지가 삭제가 아니라는 안내/동의 유지 |
| 적용 가격 | [Desktop](evidence/230/price-desktop.jpg)·[Mobile](evidence/230/price-mobile.jpg)의 DEFAULT와 생성 POST 안내 확인. DAILY·수정 PUT은 기존 자동 테스트로 검증했으며 이번 Browser Fixture는 DEFAULT만 관찰 |
| 재고 | [Desktop](evidence/230/inventory-desktop.jpg)에서 OPEN·미생성·CLOSED와 5/2/3 수량 확인. [Mobile](evidence/230/inventory-mobile.jpg)은 Calendar clientWidth309/scrollWidth576. 포커스 후 ArrowRight로 [오른쪽 열](evidence/230/inventory-mobile-scrolled.jpg)에 scrollLeft240까지 이동, 문서 폭은375/375 유지 |
| 상태 | [Empty](evidence/230/empty-mobile.jpg)·[Error](evidence/230/error-mobile.jpg), 기존 약10초 Timeout 이전 Loading status DOM 확인. 저장 성공/불명 결과·복구 Panel은 자동 HTTP Mock 회귀로 검증했고 실제 Browser 쓰기 장면을 만들지는 않음 |
| 폭 경계 | 확인한390px·768px·1440px 샘플의 문서 가로 넘침 없음. 320px Calendar 문서는 client305/scroll320으로 기존 #224 D01 재현. Calendar 자체 내부 스크롤과 구분하고 #231 후속으로 유지 |

숙소/객실 생성과 상태 변경·정책 성공 결과, DAILY 저장, 실패 후 잠금 해제 등의 실제 Browser Mutation은
미실행이다. 실제 Backend 연동/권한/동시 수정 Race·세션 Edge Case·실기기/Zoom·전체 접근성 및
사용자 최종 UI/UX 승인은 f0.6.0 후속이다. 최종 수동 검수 Issue는 새로 만들지 않았다.
