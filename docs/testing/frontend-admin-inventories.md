# 관리자 날짜별 재고 Calendar (#215)

## 확인한 Backend 계약

RoomInventoryController/Service/Entity, Create/UpdateRoomInventoryRequest,
RoomInventoryResponse/CalendarResponse, RoomInventoryErrorCode, GlobalExceptionHandler,
SecurityConfig 및 기존 RoomInventoryIntegrationTest를 확인했다.
Backend API·Domain·DB Schema·권한·의존성은 변경하지 않았다. 기존 Backend 테스트는 중복 생성하지 않았다.

| 작업 | API (`/api/v1` 기준, 모두 ADMIN) | 요청 |
| --- | --- | --- |
| Calendar 조회 | `GET /rooms/{roomId}/inventories` | startDate/endDate Query, 양 끝 날짜 포함 |
| 날짜 생성 | `POST /rooms/{roomId}/inventories` | inventoryDate/totalQuantity |
| 날짜 수정 | `PUT /rooms/{roomId}/inventories/{inventoryDate}` | totalQuantity/saleStatus 함께 전송 |

Calendar는 roomId/startDate/endDate/inventories Wrapper이며 **생성된 날짜만 오름차순**으로 반환한다.
각 행에는 inventoryId/roomId/inventoryDate/totalQuantity/reservedQuantity/availableQuantity/saleStatus가 있다.
누락 날짜는 미생성이며 총수량 0 또는 CLOSED가 아니다. 조회 실패도 미생성으로 바꾸지 않는다.
단일 날짜 GET, 기간 Batch, PATCH, DELETE는 없다. 이번 화면도 단일 날짜 쓰기만 제공한다.

- 생성 총수량은 0 이상 Java int 범위이며 서버가 reservedQuantity=0, saleStatus=OPEN으로 만든다.
- 수정은 총수량·OPEN/CLOSED만 받는다. reserved/available/version은 Request에 없다.
- 총수량을 현재 예약 수량보다 낮추면 409 INVENTORY_006이다. 예약 수량은 예약 생성/변경/취소가 관리한다.
- CLOSED는 신규 판매를 막을 뿐 기존 예약 점유를 해제하지 않는다. 가용 수량이 양수인 CLOSED도 정상이다.
- INACTIVE Room은 Calendar 조회는 가능하지만 생성/수정은 409 INVENTORY_008이다.
  현재 Service는 Room 상태를 검사한다. 숙소 상태까지 같은 쓰기 금지 조건으로 추측하지 않는다.
- JPA Version 동시 수정 충돌은 409 INVENTORY_011이다. Version/If-Match를 주고받는 API는 없어
  오래 열린 화면의 모든 순차 덮어쓰기를 차단한다는 의미는 아니다. 최종 정합성은 Backend가 검증한다.

## 화면과 상태 책임

`/admin/inventories`에서 객실 ID와 시작일/종료일을 선택한다.
객실 목록/상세 링크는 `/admin/inventories?roomId=3`으로 연결하며 날짜는 추측하지 않는다.
예: `/admin/inventories?roomId=3&startDate=2030-07-20&endDate=2030-07-22`.
기존 ADMIN ProtectedRoute/AuthProvider, apiClient, RoomCard, LoadingState/ErrorState,
calendarDate와 Form/Button/Table 스타일을 재사용한다. 공개 Room GET에는 Token을 보내지 않고
Inventory GET/POST/PUT에는 Bearer를 보낸다. JWT Role Hint는 서버 권한 검증을 대체하지 않는다.

- 양수 Safe Integer ID, 실제 ISO 날짜, 시작일 ≤ 종료일, 중복 단일 Query를 검사한다.
  과거 날짜도 허용하며 브라우저 오늘/숙박 가능 정책을 만들지 않는다.
- Calendar는 날짜별 행과 날짜 선택 버튼으로 제공한다. 끝 날짜도 포함하며 빈 성공 응답은 모두 미생성으로 표시한다.
  횡 스크롤 영역, Table Caption/행·열 Header와 선택 버튼 aria-pressed를 제공한다.
- 최대 366일은 DOM/날짜 배열 생성을 제한하는 **UI 렌더링 보호**이다. Backend에는 같은 최대 범위 정책이 없다.
- 총수량·예약 수량·가용 수량·판매 상태는 GET 값이다. 관계를 검증하되 숫자를 보정하거나 실패 값을 채우지 않는다.
- 미생성 날짜는 총수량 빈칸의 생성 Form, 기존 날짜는 총수량·상태를 채운 수정 Form이다.
  INACTIVE Room은 같은 Calendar를 읽을 수 있지만 Form과 직접 Submit Handler에서 쓰기를 차단한다.
- 총수량 입력은 문자열로 보존하고 0..2147483647 정수만 허용한다. 소수/지수/음수는 반올림하지 않고 거절한다.
  조회 시점 예약 수량 미만 입력도 안내하지만 저장 시점 최신 예약 수량의 최종 판단은 서버 책임이다.
- 객실·날짜·수량·상태·작업 확인 체크가 필요하다. 입력/날짜 변경, 새 GET, 저장 요청 후 동의를 다시 받는다.
- 룸·범위·로그인 세션 변경은 Form/Query/Mutation State를 새로 만들고 이전 요청을 Abort한다.
  늦은 GET/쓰기 성공을 새 대상에 적용하지 않는다. Draft나 토큰을 Storage에 추가하지 않는다.

## 저장·오류·복구

기존 useAdminMutation의 동기 Ref Gate로 중복 Submit을 막는다. 쓰는 동안 Form·날짜 선택·새 GET을 비활성화한다.
대상 선택/화면 이동은 허용하며, 요청 중단이 서버 Rollback은 아니라는 안내를 유지한다.
POST/PUT 모두 retryOnUnauthorized:false이며 401 후 자동 재발급/쓰기 재전송을 하지 않는다.
공통 인증 만료 처리로 로그인에 돌아간다. Calendar GET의 기존 안전한 401 복구는 유지한다.

1. 성공 응답의 대상 ID/날짜/정수 수량/관계/상태를 검증한다. Calendar Wrapper/정렬/중복/범위도 검사한다.
2. 성공 후 쓰기 응답만으로 행을 고치지 않고 객실·같은 범위 Calendar를 다시 GET한다.
   후속 GET 실패는 저장 응답 수신과 별도 표시하며 쓰기를 재전송하지 않는다.
3. 400 입력 오류의 필드 상세, 403 권한 거절, 404 부재, 409 중복/예약 수량 미만/비활성/Version 충돌의
   code/message를 공통 Feedback으로 표시한다. 오류에 따라 POST↔PUT를 자동 호출하지 않는다.
4. 이 재고 화면은 **모든 저장 오류** 뒤 새 요청을 잠근다. Network/Timeout/응답 계약 오류/5xx는
   Commit 후 실패일 수도 있다. 최신 Calendar 성공 GET → 별도 결과 확인 체크 → 새 요청 준비 →
   새 Form 입력/저장 동의 순서로만 해제한다. GET 실패/기존 Calendar/날짜 선택만으로 해제되지 않는다.
5. AdminMutationFeedback은 재고 화면에서 일반 불명 결과 확인 버튼을 숨기고 강한 재고 전용 복구를 사용한다.
   기존 숙소·객실·가격 화면의 기본 복구 동작은 바꾸지 않는다.

잠금은 현재 대상/페이지 메모리 범위다. 이동/새로고침/세션 교체 뒤에도 저장 결과 확인이 필요하며
서버 요청 멱등성이나 영속적인 전역 잠금을 새로 구현하지 않았다.
Room과 Calendar는 별도 GET이므로 중간 상태 변경은 가능하다. 화면은 그 차이를 재고 보정으로 해결하지 않는다.

## 자동 검증과 환경 경계

새 테스트는 실제 Router/AuthProvider/apiClient를 사용하고 HTTP 경계만 Mock한다.
기존 Booking/Reservation/Admin Suite는 유지했으며 기존 Route의 미연결 기대값만 새 Form으로 갱신했다.

- `api/adminInventory.test.ts`: Calendar 인증/정확한 URL·Body, 취소 신호, 401 무재전송,
  공통 오류/필드 상세, Wrapper/행의 ID·날짜·수량·순서·범위·상태 검증.
- `components/admin/inventoryValidation.test.ts`: 0/최대 int, 음수/소수/지수/범위 초과,
  윤년·과거·하루/양 끝 포함, 366일 UI 경계, 잘못된/중복 Query.
- `pages/admin/AdminInventory.test.tsx`: 누락 날짜·CLOSED 양수 가용·빈 Calendar·INACTIVE,
  단일 POST/PUT와 읽기 전용 필드·중복 차단·최신 GET, 006/011 등 충돌 후 GET 실패/성공과 명시적 확인,
  불명 결과/401/403/404/400·서버 필드 상세, 대상/세션 교체·늦은 응답·객실 링크.

실행 결과:

- `pnpm install --frozen-lockfile --offline`: Already up to date (pnpm 11.19.0).
- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`: 성공.
- 재고 API/Validation/화면 및 Admin Route 집중 검증: 4개 파일, 127개 테스트 통과.
- `pnpm test`: **68개 파일, 960개 테스트 통과**.
- `pnpm build`: 성공 (Vite 8.3.1).
- `backend/`에서 `.\gradlew.bat compileTestJava`: 성공 (3 tasks up-to-date).

Backend 테스트 소스 컴파일은 성공했다. Docker Engine Pipe(dockerDesktopLinuxEngine)가 없고
localhost:8080 Backend 및 localhost:6380 Redis TCP가 연결되지 않아 실제 Backend HTTP,
Backend 통합/전체 테스트, Browser E2E/시각 검수는 실행하지 못했다.
Mock 검증이나 컴파일을 실제 연동 완료로 보고하지 않는다. 기존 Compose DB/Volume/개발 데이터는 변경하지 않았다.

## 실제 연동 확인 절차 (남은 검증)

인프라와 Backend/Frontend를 기존 절차로 실행하고 승인된 ADMIN으로 로그인한다.
운영 데이터 대신 별도 승인된 검증용 객실/날짜만 사용하며 점유/권한/Volume을 임의 수정하지 않는다.

1. 객실 관리에서 재고 링크를 열고 날짜 범위를 지정한다. Network에서 GET Bearer와 양 끝 날짜를 확인한다.
2. 미생성 날짜를 선택해 총수량 0 또는 승인된 수량으로 생성한다. POST Body가 날짜/총수량뿐인지,
   새 Calendar GET에 OPEN/예약0으로 생성되었는지 확인한다.
3. 기존 날짜의 총수량과 OPEN/CLOSED를 수정한다. PUT Body는 두 필드뿐이어야 한다.
   CLOSED 뒤에도 기존 예약 수량이 유지되고 가용 수량은 서버 응답대로 표시되는지 확인한다.
4. 승인된 격리 환경에서 006(최신 예약 수량 미만), 002(중복 생성), 008(비활성), 실제 중첩 트랜잭션의
   011을 검증한다. 순차적인 두 화면 편집만으로 011 발생을 보장할 수 없다.
5. 오류 뒤 재조회 실패 시 잠금 유지, 성공 후 별도 재확인과 새 저장 동의를 확인한다.
   Network/5xx 이후 자동 POST/PUT가 없는지 확인한다. 실패를 만들기 위해 개발 DB/Volume을 삭제하지 않는다.
6. INACTIVE Room Calendar 조회, 익명/USER 접근 차단, 실제 서버 401/403/404, 대상 이동/새로고침 후 재로그인을 확인한다.

의존성·Lockfile·환경변수·Compose·CI 설정은 변경하지 않았다. Frontend CI의 고정 설치→Lint→Format→
Typecheck→Test→Build 경로를 유지하고 새 테스트는 외부 DB/Redis를 요구하지 않는다.
로컬 Node 24.14.0/pnpm 11.19.0, 원격 CI Node 24.19.0/pnpm 11.19.0으로 OS/Patch까지 동일한 검증은 아니다.
원격 Actions 결과, 실제 HTTP/DB Race 및 최종 f0.6.0 수동 검수는 별도 확인 대상이다.
