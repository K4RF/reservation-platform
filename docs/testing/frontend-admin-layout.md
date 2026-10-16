# 관리자 Route·공통 Layout (#211)

## 구현 범위

기존 `AuthProvider`·`ProtectedRoute roles={['ADMIN']}` 아래에 `AdminLayout`을 배치했다.
RootLayout의 Header/Main/Footer·로그아웃은 재사용하고 Main을 중복 생성하지 않는다.
관리 홈, 공통 메뉴, 중첩 Outlet과 관리 전용 Not Found를 제공한다.

| 경로 | 화면 |
| --- | --- |
| `/admin` | 관리 홈·지원 범위/인증 정책 안내 |
| `/admin/accommodations` | 숙소 관리 진입 안내 |
| `/admin/rooms` | 객실 관리 진입 안내 |
| `/admin/prices` | 날짜별 가격 관리 진입 안내 |
| `/admin/inventories` | 날짜별 재고·판매 상태/Calendar 관리 진입 안내 |
| 그 밖의 `/admin/*` | ADMIN 검사 후 관리 Not Found |

**이번 이슈는 Route/Layout 골격이다.** 네 기능의 Backend API는 있으나 실제 조회/입력/저장
화면은 후속 이슈에서 연결한다. 현재 각 진입 화면은 `관리 화면 준비 중`과 미연결 안내를
표시하며 API 요청·Form·저장 버튼을 만들지 않았다. 공개 검색의 ACTIVE 고정 조건도 전용하지 않았다.

`app/adminSections.ts`의 동일한 메타데이터로 메뉴·Route·진입 안내를 연결한다. 선택 메뉴는
NavLink의 aria-current/기존 nav-link 스타일을 사용한다. 기존 색상·간격·카드 스타일과
최소 1열 전환만 추가했고 새 UI Framework나 디자인 시스템은 도입하지 않았다.
이전 단일 `ProtectedAreaPage`는 새 관리 홈/진입 화면으로 대체했다.

전체 예약관리·사용자/권한·통계/매출 Dashboard·결제/정산·Coupon/Review·고객센터·
Audit Log Viewer/Kafka UI 메뉴는 없다. ADMIN의 본인 예약은 기존 `/reservations`에 유지하며
사용자 변경/취소 Action을 전체 예약관리로 전용하지 않는다.

## 인증·서버 권한 계약

- Backend `MemberRole`과 Frontend `UserRole`은 USER/ADMIN이다. LoginResponse는
  accessToken/refreshToken/tokenType만 반환하며 /me나 별도 Role 조회 API는 없다.
- UI는 기존 JWT role Hint를 재사용한다. **서명을 검증한 권한 증명이 아니며** 실제 접근은
  Backend JWT 서명/만료 검증 및 Spring Security가 최종 판단한다.
- 비로그인은 Layout을 마운트하지 않고 로그인으로 이동한다. pathname/query/fragment를
  기존 안전한 복귀 경로 정책으로 전달하며 로그인 뒤 역할을 다시 검사한다.
- USER/알 수 없는 Role은 같은 URL에서 ForbiddenPage를 표시하고 관리 메뉴를 숨긴다.
  미등록 하위 URL도 먼저 동일한 역할 검사를 받는다.
- 재발급 중에는 기존 LoadingState와 보호 Route로 관리 콘텐츠/메뉴를 숨긴다.
  성공하면 새 JWT의 Role Hint를 다시 적용하고 역할이 USER로 바뀌면 접근을 거부한다.
- **전체 새로고침 후 ADMIN을 자동 복원하지 않는다.** 기존 Token Pair는 메모리에만 있어
  새로고침 시 로그인해야 한다. 재로그인 뒤 원래 관리 경로로 복귀한다. 새 Storage/쿠키
  인증 체계·현재 사용자 API를 임의로 추가하지 않았다.

Backend에는 `/api/v1/admin/**` 보안 Matcher가 있지만 production 관리 Controller는 없다.
실제 API는 `/api/v1/accommodations`, 숙소별 rooms, `/api/v1/rooms/{id}` 및 그 하위
prices/inventories 경로다. 숙소·객실 쓰기/정책 관리·가격 쓰기·재고 조회/쓰기는 ADMIN이며,
카탈로그/적용 가격 GET 공개 경계는 유지한다. 새 Backend Endpoint/보안 설정은 추가하지 않았다.

401/403은 기존 apiClient/ApiError/Common ErrorResponse를 유지한다. 재발급 실패는 세션을
끝내고 관리 Layout을 제거한다. 403은 AUTH_002/서버 메시지를 보존하며 자동 재시도하거나
클라이언트 Role을 임의로 바꾸지 않는다. 따라서 UI에 ADMIN 메뉴가 보이는 것만으로 특정
API 성공을 보장하지 않는다. 현재 Layout 자체는 API를 호출하지 않으며 테스트의 명시적
Client 호출로 이 경계를 검증한다. 실제 기능 화면의 Loading/Error/Validation Feedback과
쓰기 중복 방지·401 무재전송·응답 불명 시 재조회는 각 후속 Form/API 연동에서 적용해야 한다.

## 검증 (2026-10-17)

추가 `frontend/src/app/adminRoutes.test.tsx`는 실제 AuthProvider/Router/API Client를
사용하고 HTTP 경계만 Mock한다. 직접 접근/메뉴/History·미등록 경로, USER/익명/미확인 Role,
ADMIN/USER 로그인 복귀, 세션 교체·재발급 Loading/성공/실패, 401/403, 로그아웃과
재마운트 시 Token 상실 후 재로그인 복귀를 검증한다. 메뉴 이동에는 관리 API 요청이 없다.
기존 protectedRoutes/AuthenticationFlow/SessionReload 테스트도 그대로 재사용한다.

Frontend 전체 **58 files / 671 tests 성공**. 추가 Admin Suite는 30건이며 기존 641건을 유지했다.
아래 기존 CI 명령이 모두 성공했다.

```bash
cd frontend
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
```

Backend MemberRole/LoginResponse/JwtTokenProvider/SecurityConfig·인증 오류 Writer,
기존 SecurityIntegrationTest/RoomInventoryIntegrationTest의 ADMIN/USER/미인증 테스트를
소스로 대조했다. 현재 Docker 엔진 pipe가 없고 Redis localhost:6380 TCP도 연결되지 않아
Backend 테스트·실제 Backend HTTP는 이번에 실행하지 않았다. Backend 소스 변경은 없다.
개발 MySQL/Volume이나 .env를 사용/수정하지 않았고 테스트를 삭제/disable하거나
연결 예외를 무시하도록 설정하지 않았다.

인프라 복구 후 기존 Backend 권한 테스트를 재사용할 수 있다.

```powershell
cd backend
.\gradlew.bat test --tests 'junsik.reservation.security.SecurityIntegrationTest' --tests 'junsik.reservation.controller.RoomInventoryIntegrationTest'
```

의존성·lockfile·환경변수·인증 저장 방식·Workflow는 변경하지 않았다. Frontend CI는
기존 frozen-lockfile 설치·lint/format/typecheck/test/build 명령을 그대로 사용한다.
신규 브랜치의 원격 Actions는 push/PR 후 별도 확인해야 하며 로컬 통과와 구분한다.
실제 Browser Refresh/브라우저 E2E 및 최종 반응형·시각 수동 검수는 이번에 실행하지 않았다.

## 수동 확인

1. 기존 승인된 ADMIN으로 로그인하고 네 하위 URL을 직접 열어 메뉴 활성 상태/공통 Layout을 확인한다.
2. 메뉴를 이동해도 조회/저장 API가 전송되지 않고 미연결 안내가 표시되는지 확인한다.
3. USER와 비로그인의 직접 진입은 관리 메뉴 없이 Forbidden/로그인 화면으로 이동해야 한다.
4. 관리 URL에서 새로고침 → 재로그인 → 원래 경로 복귀를 확인한다. 저장 토큰 복원으로 오해하지 않는다.
5. 기존 서버를 실행할 수 있는 환경에서 미인증/USER의 실제 관리 API 401/403을 별도로 확인한다.
   UI만 시험하려고 관리자 권한을 DB에 임의 추가/변경하거나 개발 데이터를 삭제하지 않는다.
6. 전체 예약/통계/사용자 등 제외 메뉴가 없고, 내 예약 링크는 사용자 영역으로 이동하는지 확인한다.
