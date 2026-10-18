# f0.5.0 Admin Management 통합 검증 (#216)

## 검증 범위와 경계

ADMIN 이메일 로그인 → 관리 홈/메뉴 → 숙소 생성/수정/상태/정책 → 숙소별 객실 생성/수정/상태 →
단일 날짜 가격 조회/생성/수정 → 날짜 범위 재고 Calendar/단일 날짜 생성/수정을 연결한다.
기존 개별 Suite는 유지하고 새 `test/AdminManagementFlow.integration.test.tsx`는 **연결 경계**를 검증한다.
실제 AppRoutes/AuthProvider/Component/apiClient를 사용하며 HTTP 경계만 Mock한다.
인증 서명·서버 권한·DB 정합성·Redis 통신을 Mock 테스트로 입증했다고 보고하지 않는다.

`test/adminManagementApi.ts`는 같은 응답 상태를 다음 화면의 GET에 전달하는 테스트 Fixture이다.
인증 Header/메서드/URL/쓰기 필드를 검사하고 미지원 요청은 기록·거절한다.
가짜 권한 서버나 Backend 정책 대체물이 아니며, 실제 재고 Race를 생성하지 않는다.
테스트용 Token은 기존 JWT Hint Fixture이고 실제 서명 키/관리자 비밀번호를 추가하지 않았다.

## 확인한 서버 계약과 역할 경계

SecurityConfig, ReservationController/Service/ErrorCode, RoomDailyPriceController,
RoomInventoryController, 두 숙소 정책 Controller 및 기존 계약 문서를 대조했다.
Backend 소스·테스트·설정은 변경하지 않았다.

| 영역 | 공개 읽기 | ADMIN 작업 | 제외한 기능 |
| --- | --- | --- | --- |
| 숙소 | 목록/상세 | POST 생성, PUT 전체 수정, 상태 PATCH | DELETE, 기존 정책 자동 읽기 |
| 숙소 정책 | 없음 | Booking/Cancellation POST·PUT | GET/DELETE·자동 존재 판별 |
| 객실 | 숙소별 목록/상세 | 숙소 범위 POST, Room PUT, 상태 PATCH | 숙소 이동·DELETE |
| 날짜별 가격 | 단일 날짜 적용 가격 GET | POST 생성, 날짜 PUT | 가격 Calendar·Batch·Reset |
| 재고 | 없음 (GET도 ADMIN) | 날짜 범위 GET, 단일 날짜 POST/PUT | Batch·DELETE·점유 수량 직접 수정 |
| 예약 | 없음 | ADMIN도 사용자 영역에서는 자기 예약만 | 전체 예약 Admin 메뉴/API·소유권 우회 |

숙소/객실 목록은 공개 API를 재사용하지만 Admin 기본 조회에 ACTIVE/가용성 조건을 강제하지 않는다.
상태 필터와 운영 상태 변경을 구분한다. 가격 DAILY/DEFAULT, 재고 미생성/OPEN/CLOSED를 혼합하지 않는다.
예약 수량과 가용 수량은 읽기 전용이고 Request에 reserved/available/version을 넣지 않는다.
CLOSED는 점유 해제가 아니며 가용 수량이 양수일 수 있다. 비활성 Room은 재고 읽기만 가능하다.
정책 Form은 명시적 POST/PUT·전체 입력·확인으로만 동작하고 성공 응답은 현재 정책 GET 결과가 아니다.

ReservationController는 JWT principal의 memberId만 전달한다. ReservationService의 getById,
updateSchedule, cancel은 Role 예외 없이 validateOwner를 호출하고 목록도 memberId로 제한한다.
타인 예약은 403 **RESERVATION_004**이다. SecurityConfig의 `/api/v1/admin/**` Matcher 자체가
전체 예약 관리 Controller의 존재를 뜻하지 않는다. 새 Admin 예약 URL/역할/Action은 만들지 않았다.
Frontend는 응답에 소유자 ID가 없어 JWT Hint만으로 소유권을 추정하지 않으며 서버 응답을 따른다.

## Coverage Matrix (중복 Suite 대신 기존 검증 재사용)

| 확인 대상 | 연결/신규 검증 | 기존 세부 검증 |
| --- | --- | --- |
| 로그인·Root·메뉴·직접 URL | 새 Suite의 실제 로그인 응답→메뉴/리소스 링크 | app/adminRoutes.test.tsx, protectedRoutes.test.tsx, 인증 Flow |
| 익명/USER/알 수 없는 Role 차단 | 기존 Route Suite를 전체 회귀에 포함 | adminRoutes, 각 Admin Page Suite의 deep link 검사 |
| 숙소 지원 CRUD·ACTIVE/INACTIVE | 빈 목록→POST→상세 GET→PUT→상태 PATCH→필터→복귀 | AdminAccommodation.test.tsx, api/adminAccommodation.test.ts |
| 정책 범위 | 두 정책 POST/PUT→성공 응답, 없는 GET 무호출 | AdminAccommodation의 정책 Validation·404/409·공유 Gate |
| 부모 숙소↔객실 | 숙소 Link→빈 객실 목록→POST→서버 ID 상세→PUT/상태 PATCH/필터 | AdminRoom.test.tsx, api/adminRoom.test.ts, roomValidation |
| DEFAULT/DAILY·양수 가격 | 기본값→0 로컬 거절→Override POST/PUT→새 GET | AdminDailyPrice/API Suite의 404/중복409/금액/응답 검증 |
| 재고 Calendar·총수량·OPEN/CLOSED | 양 끝 포함/미생성→POST→PUT→새 GET, 실제 전송 필드 | AdminInventory/API/Validation Suite의 0·정수·Inactive·빈 Calendar·범위 |
| 예약 점유·006/011 복구 | 다음 서버 읽기에 예약 수량 증가 반영→오류→GET·재확인→CLOSED, 예약 Snapshot 불변 | AdminInventory의 GET 실패·잠금·008/002/011·중복 제출·미보정 |
| 401/403/Network | 실제 로그인한 관리 흐름의 쓰기 거절/유실 후 무재전송·인증/잠금 | 공통 client/API 및 모든 Admin Page Suite의 400/404/409/5xx·필드 상세 |
| Loading/Error/Empty | 연결 흐름의 숙소/객실 빈 상태·오류·후속 GET 확인 | 기존 네 Admin Page Suite의 지연 응답·GET 실패·재시도·Empty |
| Refresh | 화면 unmount+메모리 Token 상실 후 깊은 Calendar 재진입→재로그인 | SessionReload.test.ts, adminRoutes; 실제 Browser reload는 별도 |
| 사용자 예약 회귀·ADMIN 소유권 | Admin→내 목록/상세 Snapshot→타인 GET 403 후 기존 상세/액션 미노출 | ReservationManagementFlow.integration.test.tsx, ReservationDetailPage/MyReservationsPage |

새 Suite는 8개 Test이다. 모든 단일 필드/오류 조합을 새 통합 Suite에 다시 복제하지 않는다.
Owner UI 테스트의 403은 서버 응답 Fixture이며 서버 Role 우회 불가의 실행 증거는 아니다.
실제 Backend의 기존 ReservationIntegrationTest에는 타인 조회/일정 변경/취소 거절 테스트가 있고,
Role과 무관한 validateOwner 소스를 확인했다. 이번 환경에서 실제 ADMIN 타인 예약 HTTP 검증은 미실행이다.

## 구조 정리와 책임

- `CatalogStatusForm`: 숙소/객실의 중복 상태 선택·명시적 동의·disabled Submit UI만 공통화했다.
  API URL/숙소-객실 관계/성공 후 GET/useAdminMutation Gate는 각 Page에 남긴다.
  기존 접근성 이름·문구·ACTIVE/INACTIVE 기본 선택·재확인 동작을 유지한다.
  같은 상태 Union을 기존 공개 AccommodationStatus Type에서 재사용하며 별도 Admin Entity Type을 만들지 않는다.
- AccommodationEditor의 ID 검증은 객실/가격/재고에서 쓰는 readPositiveId를 재사용한다.
- 모든 Admin Route가 실제 화면으로 연결되어 더 이상 참조하지 않는 AdminSectionPage를 제거했다.
  Git 이력으로 복구 가능하며 작동하는 관리 화면/지원 Route를 삭제한 것은 아니다.
- API Layer는 HTTP 메서드·쓰기 DTO·응답 ID/관계/계약 검증을 맡고 UI Draft/Navigation을 보관하지 않는다.
  Read는 기존 public catalog Type/API를 사용한다. 정책·재고·가격의 서로 다른 계약을 한 DTO로 합치지 않는다.
- useDetailQuery는 Abort/요청 범위의 Read State, useAdminMutation은 페이지 단위 Submit Gate와
  불명 결과 잠금, Feedback은 메시지/필드 오류를 담당한다. 다른 자원/세션의 늦은 응답은 적용하지 않는다.
- 재고의 모든 오류 뒤 강제 새 GET/재확인과 가격·정책의 결과 확인 규칙은 서로 다르므로 통합하지 않았다.
  공통 Form을 추출하면서 서버 재고 보정, 예약 가격 재계산, 자동 쓰기 전환/재전송을 추가하지 않았다.
- RoomCard, accommodationView, 공통 Loading/Error, money/calendarDate, AuthProvider/ProtectedRoute를
  재사용한다. User 예약 생성/변경/취소 Component를 전체 예약 Admin UI로 전용하지 않는다.

## 실행 결과

2026-10-18, Windows PowerShell, Node 24.14.0/pnpm 11.19.0에서 실행했다.
CI는 Ubuntu/Node 24.19.0/pnpm 11.19.0이므로 명령 순서는 같아도 OS/Patch까지 동일하지는 않다.

- `pnpm install --frozen-lockfile --offline`: Already up to date.
- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`: 성공.
- 통합 Flow + 기존 숙소/객실 집중 실행: 3개 파일, 83개 테스트 통과.
- `pnpm test`: 69개 파일, 968개 테스트 통과.
- `pnpm build`: 성공 (Vite 8.3.1).
- Backend에서 `.\gradlew.bat test --tests 'junsik.reservation.entity.room.RoomInventoryTest' --tests 'junsik.reservation.entity.reservation.ReservationTest'`:
  기존 순수 도메인 12개 테스트 통과. Context/HTTP/Authorization/DB 통합 테스트가 아니다.

의존성/Lockfile/환경변수/실행 명령/Workflow는 변경하지 않았다. 새 Suite는 jsdom/HTTP Mock으로
CI에 DB/Redis/Docker 서비스나 Secret을 추가로 요구하지 않는다. Backend 소스/테스트 변경이 없어
전체 Backend test/build는 실행하지 않았다. 생성된 build/dist/node_modules는 커밋하지 않는다.

## 실제 HTTP·Browser·원격 CI 및 f0.6.0 진입

현재 Docker Engine Pipe(dockerDesktopLinuxEngine)가 없고 localhost:8080 Backend와
localhost:6380 Redis TCP가 연결되지 않았다. 이번 #216의 실제 Backend Admin 전체 Flow,
서버 ADMIN/USER 권한·예약 소유권 HTTP, MySQL Race 검증은 실행하지 못했다.
기존 #203의 별도 실제 HTTP 성공 기록을 이번 Admin Flow 검증 성공으로 재사용하지 않는다.
개발 Compose DB/Volume·기존 권한·실제 예약 데이터를 변경/삭제하지 않았다.
실제 Browser E2E/Refresh/키보드·반응형·시각 검수도 미실행이다.

현재 요청은 로컬 브랜치 생성/커밋까지이므로 push/PR/원격 Actions 실행은 하지 않는다.
**이 변경의 원격 CI 통과는 아직 확인되지 않았다.** 기존 Workflow 단계와 로컬 결과만 확인했다.
GitHub Milestone/Issue를 종료하거나 f0.5.0의 모든 수동 검증이 완료되었다고 표시하지 않는다.

코드/Mock 회귀 기반은 f0.6.0 통합·UX 작업에 사용할 수 있다. 다음 확인은 별도 완료 조건으로 남긴다.

1. 인프라 실행 후 승인된 ADMIN/USER와 폐기 가능한 검증용 숙소/객실/예약으로 실제 HTTP를 검증한다.
   권한을 DB에서 임의 변경하지 않고 비밀값/Token을 로그·문서에 남기지 않는다.
2. ADMIN 로그인→숙소 생성/전체 수정/INACTIVE·ACTIVE/정책 POST·PUT→그 숙소의 객실 생성/수정/상태→
   DEFAULT/DAILY·양수 가격/중복 POST/미존재 PUT→재고 미생성/생성/OPEN·CLOSED/총수량을 확인한다.
   미지원 DELETE/Batch/정책 GET/전체 예약 Admin API는 호출하지 않는다.
3. 기존 승인된 테스트 예약 점유가 있는 재고에서 CLOSED가 점유를 유지하는지, 006/008/실제 중첩 011 후
   새 Calendar·명시적 확인 전 재제출이 막히는지 확인한다. 실패를 만들려고 DB/Volume을 지우지 않는다.
4. 익명 401/USER 403, 서버가 거절한 ADMIN UI Hint의 403, ADMIN 본인 예약 목록/상세/변경/취소와
   승인된 타인 테스트 예약의 GET/변경/취소 403 RESERVATION_004를 확인한다. Role 우회를 추가하지 않는다.
5. Browser 새로고침/깊은 URL/재로그인·화면 이동·불명 결과 무재전송·키보드/모바일 화면을 검수한다.
6. 브랜치 push/PR 후 Frontend Actions 결과를 별도로 확인한다. 전체 디자인/UX 수동 검수는 f0.6.0,
   큰 재설계나 신규 기능은 후속 Milestone으로 분리한다.
