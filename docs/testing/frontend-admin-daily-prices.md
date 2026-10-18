# 관리자 단일 날짜 가격 관리 (#214)

## 소스에서 확인한 계약

RoomDailyPriceController/Service, Create/Update DTO, RoomDailyPriceResponse,
RoomDailyPriceErrorCode, SecurityConfig 및 기존 RoomDailyPriceIntegrationTest를 확인했다.
Backend API·가격 정책·DB Schema·권한·의존성은 변경하지 않았다.

| 작업 | Backend API (`/api/v1` 기준) | 계약 |
| --- | --- | --- |
| 적용 가격 | `GET /rooms/{roomId}/prices/{stayDate}` | 공개 조회, 단일 날짜의 서버 결정 금액/출처 |
| Override 생성 | `POST /rooms/{roomId}/prices` | ADMIN, Body: stayDate/nightlyPrice |
| 기존 Override 수정 | `PUT /rooms/{roomId}/prices/{stayDate}` | ADMIN, Body: nightlyPrice만 |

응답 필드는 roomDailyPriceId/roomId/stayDate/nightlyPrice/source이다.
DAILY는 양수 Override ID와 날짜별 금액, DEFAULT는 null ID와 객실 기본 가격을 반환한다.
DEFAULT는 빈 가격이나 조회 오류가 아니다. 과거 기본 가격 0도 읽을 수 있으나 새 Override 쓰기는 양수만 허용된다.
기본 가격 변경은 Room PUT의 책임이며 날짜별 가격 쓰기는 기존 예약 Snapshot을 바꾸지 않는다.
비활성 Room도 가격을 준비할 수 있고 가격이 있다는 사실은 예약 가능 보장이 아니다.

기간 목록·Calendar·일괄 설정·DELETE/Reset API와 통화 필드는 없다. 이번 구현도 단일 날짜에 한정한다.
표시용 금액은 기존 money Utility로 두 자리까지 정확히 포맷하며 KRW/USD·원화 기호 등을 추측해 붙이지 않는다.
프론트엔드가 가격 우선순위·할인·기본값 대체 정책을 만들지 않고, 실패한 GET을 DEFAULT로 바꾸지도 않는다.

## 화면·선택·검증

`/admin/prices`는 객실 ID와 숙박 날짜 선택 화면이다. 객실 관리 목록/상세의 가격 관리 링크는
`/admin/prices?roomId=3`으로 연결하고 날짜를 임의로 채우지 않는다. 두 조건이 준비되면
`/admin/prices?roomId=3&stayDate=2030-07-20`에서 객실 상세 → 단일 날짜 적용 가격을 GET한다.
기존 ADMIN ProtectedRoute/AuthProvider를 재사용한다. 공개 GET에는 Token을 보내지 않고 쓰기에만 Bearer를 사용한다.
JWT Role은 UI Hint일 뿐 실제 ADMIN 권한은 서버가 검증한다. 새로고침 후에는 기존처럼 재로그인이 필요하다.

- ID는 양수 Safe Integer, 날짜는 기존 calendarDate Utility의 실제 ISO Calendar 날짜로 검증한다.
  중복 단일 파라미터도 HTTP 전에 거절한다. 서버에 없는 오늘 이후/예약 가능 기간 정책을 추가하지 않는다.
- 대상 미선택, Loading, Read Error, DEFAULT 미등록 Override, DAILY 기존 Override를 구분한다.
  객실/가격 GET 실패 시 쓰기 Form을 마운트하지 않는다.
- 직전 GET의 DEFAULT는 생성(POST), DAILY는 수정(PUT) Form으로 안내한다. 생성 입력은 빈칸으로,
  수정 입력은 GET의 기존 Override 금액으로 시작한다. 기본 가격을 기존 Override인 것처럼 채우지 않는다.
- 입력은 문자열로 보존하고 기존 readRoomPrice/money 검증을 재사용한다. DTO와 같은 양수·정수 10자리/소수 2자리
  범위만 허용하며 반올림하지 않는다. API Body는 검증된 숫자 JSON이고 날짜는 생성 Body/수정 URL에만 들어간다.
- 객실·날짜·가격·생성/수정을 확인하는 체크가 필요하다. 금액 변경·저장 요청·새 GET 뒤 확인은 다시 필요하다.
  초기 조회 뒤 자동 저장이나 자동 쓰기는 없다.

객실·날짜·로그인 세션에 UI State를 귀속시킨다. 대상 변경 시 Form/Query/쓰기 State를 다시 만들고,
기존 요청을 Abort하며 늦은 GET/쓰기 응답의 성공 처리·Navigation을 무시한다.
조건은 URL에 보관하되 입력 Draft는 저장하지 않는다. “적용 가격 새로 조회”는 같은 대상의 명시적 GET이다.

## 중복 요청·오류·저장 후 상태

기존 useAdminMutation과 공통 ErrorResponse 매핑/Feedback을 재사용한다. 동기 Ref Gate로 중복 Submit을 막고,
쓰는 동안 금액 Form과 새로 조회를 비활성화한다. 대상 선택/화면 이동 자체는 막지 않으므로
Abort가 서버 Rollback이라는 보장이 없다는 안내를 유지한다.

- POST/PUT는 모두 retryOnUnauthorized:false이다. 401 재발급 뒤 자동 쓰기를 하지 않고 공유 재로그인 처리에 맡긴다.
- 400의 errors와 code/message, 403 권한 거절을 표시한다. UI Hint를 임의로 새 Role로 바꾸지 않는다.
- 생성 중복은 409 ROOM_PRICE_002, 없는 Override 수정은 404 ROOM_PRICE_001이다.
  오류만 보고 POST↔PUT를 자동 호출/전환하지 않는다. 명시적 GET 후 실제 source가 바뀌면 새 Form과 확인 체크로 준비한다.
- Network/Timeout/Abort/잘못된 성공 응답/5xx는 Commit 후 오류일 수 있어 같은 페이지의 쓰기를 잠근다.
  같은 객실·날짜 GET으로 확인하고 별도 확인 체크·명시적 잠금 해제 후 다시 저장 확인을 해야 한다.
  새 GET 자체는 잠금을 해제하지 않는다. 잠금은 페이지 메모리 범위이며 재진입 후에도 결과 확인이 필요하다.

GET/쓰기 응답의 roomId/stayDate와 source/ID/금액을 기존 가격 Response 검증으로 대조한다.
쓰기 성공은 반드시 DAILY여야 한다. 성공 후 직전 POST/PUT 응답만 최신값으로 간주하지 않고
객실·적용 가격 GET을 다시 수행한다. 이후 GET이 실패하면 “쓰기 성공 응답 수신”과 “최신 조회 실패”를 별도로 표시하고
재전송하지 않는다. 서버 요청 멱등성, 다른 Admin과의 동시 편집 Version 제어는 이번 범위가 아니다.
객실 정보와 적용 가격은 별도 GET이므로 조회 사이에 기본 가격이 변경될 수 있다. 적용 가격 GET을 표시 기준으로 삼고
두 응답의 값을 브라우저에서 재계산해 맞추지 않는다.

## 자동 검증

기존 bookingPrice GET 검증을 공통 readRoomDailyPrice 함수로 추출해 쓰기 응답에도 재사용했다.
기존 가격 Quote/예약 흐름·객실·Admin Route Suite는 유지했고 새 Form이 있는 Route 기대값만 갱신했다.
새 테스트도 실제 Router/AuthProvider/API Client를 쓰며 HTTP 경계만 Mock한다.

- api/adminDailyPrice.test.ts: POST/PUT URL·Body·Bearer, 401 자동 재전송 금지, 공통 오류/필드 상세,
  잘못된 roomId/date/source/ID/금액 응답 및 대상 검증.
- pages/admin/AdminDailyPrice.test.tsx: 미선택/DEFAULT/DAILY·비활성 Room·금액 표시,
  입력/확인·중복 차단·저장 후 GET, 404/409 수동 재조회, 불명확 결과 잠금,
  GET 실패와 서버 기본 가격 대체 금지, 늦은 응답/세션 교체·권한·객실 관리 링크.

실행 결과:

- `pnpm install --frozen-lockfile --offline`: Already up to date (pnpm 11.19.0).
- `pnpm lint`, `pnpm typecheck`, `pnpm format:check`: 성공.
- 관련 5개 Suite: 132개 테스트 통과.
- `pnpm test`: **65개 파일, 862개 테스트 통과**.
- `pnpm build`: 성공 (Vite 8.3.1).
- `backend/`에서 `.\gradlew.bat compileTestJava`: 성공 (3 tasks up-to-date).

로컬 Node 24.14.0/pnpm 11.19.0이며 CI는 Node 24.19.0/pnpm 11.19.0이다.
동일 Major/지원 Engine에서 CI 명령을 실행했지만 원격 Runner OS/Patch와 완전히 같은 환경은 아니다.

## 실제 연동·남은 검증

이번 환경은 Docker Engine Pipe(dockerDesktopLinuxEngine)가 없고 localhost:6380 Redis TCP도 연결되지 않았다.
실제 Backend HTTP·Backend 통합/전체 테스트·Browser E2E/시각 검수는 실행하지 못했다.
HTTP Mock 통과나 Backend 컴파일 성공과 실제 API 연동 완료를 구분한다.
기존 Compose MySQL/Volume과 개발 데이터는 사용·변경·삭제하지 않았다.

인프라/Backend 실행 후 기존 승인된 ADMIN으로 다음을 확인한다.

1. 격리된 검증용 객실의 날짜별 가격 관리 링크를 열고 날짜를 직접 선택한다.
2. Override 없는 날짜 GET에서 DEFAULT/null ID와 기본 가격을 확인한다.
3. 금액 180000.50을 입력·확인하고 POST 후 DAILY/양수 ID와 새 GET 결과를 확인한다.
4. 같은 날짜를 200000.25로 수정하고 PUT Body에는 nightlyPrice만 들어가는지 확인한다.
5. 승인된 검증 환경에서만 중복 POST/없는 Override PUT의 ROOM_PRICE_002/001과 401/403을 확인한다.
6. 객실·날짜 변경, 비활성 객실, 실패 후 새 GET을 확인한다. 실제 예약/기본 가격/재고는 변경하지 않는다.

기간 가격 관리·삭제/복원이나 임의 통화는 추가하지 않는다. 승인된 ADMIN이 없다면 DB 권한을 임의 변경하지 않는다.
의존성/Lockfile/환경변수/Compose/CI 설정은 변경하지 않았다. 기존 Frontend CI 명령 경로를 유지하며,
새 테스트는 외부 DB/Redis를 요구하지 않는다. 원격 CI 결과와 최종 f0.6.0 수동 검수는 별도 확인 대상이다.
