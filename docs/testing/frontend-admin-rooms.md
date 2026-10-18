# 관리자 객실 관리 (#213)

## 소스에서 확인한 계약

`RoomController`, `RoomService`, Room Request/Response DTO, `Room` Entity,
`RoomSpecifications`·`RoomSortField` 및 `SecurityConfig`를 확인했다.
Backend API/DB Schema/의존성을 추가하거나 권한을 변경하지 않았다.

| 작업 | Backend API (`/api/v1` 기준) | 권한/화면 |
| --- | --- | --- |
| 목록 | `GET /accommodations/{accommodationId}/rooms` | 공개 조회를 ADMIN Route에서 재사용 |
| 상세 | `GET /rooms/{roomId}` | 공개 조회, 객실 ID·숙소 ID 확인 후 현재 정보/편집 표시 |
| 생성 | `POST /accommodations/{accommodationId}/rooms` | ADMIN, 새 객실 ACTIVE, 반환 ID로 상세 GET |
| 전체 정보 수정 | `PUT /rooms/{roomId}` | ADMIN, 기본 가격 포함 전체 DTO 저장 후 상세 GET |
| 운영 상태 | `PATCH /rooms/{roomId}/status` | ADMIN, 명시적 확인 후 ACTIVE/INACTIVE 변경·상세 GET |

삭제 API는 없다. Room은 하나의 Accommodation에 속하며 기존 객실의 숙소를 이동하는 API도 없다.
Create/Update는 `name`, `capacity`, `nightlyPrice`, `amenities`만 전송한다.
RoomResponse는 `roomId`, `accommodationId`, 위 네 필드와 `status`를 반환한다.
숙소 관계와 운영 상태를 정보 수정 Body에 넣지 않는다.

- name: 필수, 100자 이하.
- capacity: 성인·아동 구분 없는 전체 투숙객 수, Java Integer/최소 1.
- nightlyPrice: 새 Create/Update 요청은 양수 BigDecimal. DB는 DECIMAL(12,2), 기존 Entity/읽기에는 0도 가능하다.
  DTO에 `@Digits`는 없지만 UI는 저장 범위에 맞춰 정수 10자리·소수 2자리 이하만 받고 조용히 반올림하지 않는다.
  입력은 문자열로 유지한 뒤 기존 money Utility로 범위를 확인하고 숫자 JSON으로 전송한다.
  과거 가격 0을 임의 양수로 보정하지 않으며 저장하려면 확인한 양수를 입력해야 한다.
- amenities: WIFI/AIR_CONDITIONER만 지원한다.

기본 가격 수정은 Room PUT 책임이다. 날짜별 Override는 Daily Price API 책임이며 이번 화면에서는 호출하지 않는다.
가격/상태 수정으로 기존 예약 Snapshot·날짜 재고를 브라우저에서 수정하지 않는다.
비활성 숙소에도 Backend가 허용하는 객실 준비 Form을 제공하지만 예약 가능 여부를 보장하지 않는다.

## 경로와 상태 귀속

| Frontend 경로 | 동작 |
| --- | --- |
| `/admin/rooms` | 요청 없이 숙소 선택 안내·ID 입력 |
| `/admin/rooms?accommodationId=7` | 대상 숙소 조회 후 해당 숙소의 객실 목록 |
| `/admin/rooms/new?accommodationId=7` | 대상 숙소가 조회된 후 빈 생성 Form |
| `/admin/rooms/3?accommodationId=7` | 객실 상세의 숙소 ID가 선택값과 일치해야 편집 가능 |
| `/admin/rooms/3` | 상세 응답의 실제 accommodationId로 대상 숙소 조회·목록 링크 구성 |

숙소 관리 목록/상세의 “객실 관리” 링크로 진입하거나 숙소 ID를 직접 선택한다.
별도 Admin 숙소/객실 목록 API를 만들어 가정하지 않는다. 기존 ADMIN ProtectedRoute와 메모리 인증을 유지한다.
읽기는 공개 GET이므로 토큰을 보내지 않고, 쓰기는 기존 Bearer Client를 사용한다.
서버의 JWT/ADMIN 검사가 실제 권한 경계이며 UI 역할 Hint는 권한 증명이 아니다.

관리 목록에는 ACTIVE·가용 기간을 고정하지 않는다. minCapacity/minPrice/maxPrice/status/amenities,
page/size, ID/NAME/CAPACITY/NIGHTLY_PRICE와 ASC/DESC만 사용한다. 복수 amenities는 AND이다.
가격 필터 UI도 저장 범위의 소수 2자리를 사용하되 0을 허용한다. 최소 가격 ≤ 최대 가격을 확인한다.
page는 0부터 Integer 범위, size는 1~100이다. 잘못된 URL·중복 단일 파라미터는 HTTP 전에 거절한다.
가용성/숙박 날짜 필터는 이 관리 목록에 전용하지 않는다.

검색 조건과 page는 URL에 남겨 페이지 이동/History가 보존한다. 조건 검색은 page=0으로,
숙소 선택은 필터와 page를 모두 초기화한다. 숙소·조회 조건 변경은 이전 Query를 Abort하고
늦은 응답을 무시한다. 생성/편집의 숙소·객실 ID 또는 로그인 세션 변경은 Form/쓰기 상태를 다시 만든다.
Create/Update/Status Response도 요청의 객실 ID/숙소 ID와 대조한다.

성공 후 생성은 반환 ID의 상세 GET, 수정/상태 변경은 최신 상세 GET을 수행한다.
목록은 재마운트할 때 GET하며 명시적 새로 조회도 있다. 편집에서 목록으로 이동하면 동일 숙소를 유지하되
이전 목록의 필터는 기본 조건으로 돌아간다. 브라우저 뒤로가기는 원래 URL 조건을 유지한다.

## 오류와 쓰기 안전성

기존 `useAdminMutation` Ref Gate를 정보 수정/상태 변경에 공유한다. 처리 중 모든 쓰기와 상세 새로 조회를 막고
동일 프레임의 중복 제출도 차단한다. 공통 Feedback을 재사용하되 객실 결과 확인 링크·안내만 전달한다.

- 400: 공통 ErrorResponse의 code/message/errors를 표시한다. Frontend UX 검증은 서버 검증을 대체하지 않는다.
- 401: 모든 쓰기는 `retryOnUnauthorized:false`. 재발급 후 자동 POST/PUT/PATCH를 하지 않고 기존 재로그인 처리에 맡긴다.
- 403: 서버 권한 거절을 표시하고 JWT Hint를 임의로 USER로 변경하지 않는다.
- 404/409: 서버의 미존재/충돌 정보를 유지하며 다른 작업으로 자동 전환하지 않는다.
- Network/Timeout/Abort/잘못된 성공 응답/5xx: Commit 후 오류일 수 있어 쓰기를 잠근다.
  객실 목록/상세 재조회와 별도 결과 확인 후 체크·명시적 해제를 해야 새 요청이 가능하다.
  재조회만으로 잠금을 풀지 않으며 해제 자체도 HTTP 요청을 만들지 않는다.

화면 이동·Abort는 서버 Rollback 증명이 아니다. 잠금은 페이지 메모리 범위이며 재진입 후에도 결과를 확인해야 한다.
서버 요청 멱등성은 이번 범위가 아니다. 숙소 변경/Unmount/새 로그인 뒤 오래된 쓰기 응답은
현재 페이지의 성공 처리·Navigation을 만들지 않는다. 새로고침은 기존처럼 재로그인이 필요하다.

## 자동 검증

기존 공개 Room/가용성 API·Card·Admin Route·숙소 관리 테스트를 유지했다. 새 API/입력/화면 Suite는
실제 Router/AuthProvider/API Client를 사용하며 HTTP 경계만 Mock한다.

- `api/adminRoom.test.ts`: 실제 GET/POST/PUT/PATCH 경로와 DTO/인증, 모든 쓰기 401 재전송 금지,
  400/403/404/409/500와 Field 오류, 생성/수정/상태 응답 ID·숙소 관계 검증.
- `components/admin/roomValidation.test.ts`: 수용 인원/금액/ID 범위, 잘못된 Query, AND 편의시설·정렬.
- `pages/admin/AdminRoom.test.tsx`: 전체 상태 목록·검색·페이지·History, 숙소 전환/늦은 응답,
  생성·수정·상태 변경과 성공 후 GET, Null/빈/미존재·관계 오류, 중복 Gate·오류 잠금과 권한 경계.
- 기존 `app/adminRoutes.test.tsx`: 숙소 미선택 Room 진입에 선택 Form이 있다는 점과 새 깊은 경로만 반영했다.
  인증/인가·로그아웃·재로그인·미등록 경로 테스트를 삭제하지 않았다.

실행 결과:

- `pnpm install --frozen-lockfile --offline`: Already up to date (pnpm 11.19.0).
- `pnpm typecheck`, `pnpm lint`, `pnpm format:check`: 성공.
- 관련 6개 Suite: 153개 테스트 통과.
- `pnpm test`: **63개 파일, 805개 테스트 통과**.
- `pnpm build`: 성공 (Vite 8.3.1).
- `backend/`에서 `.\gradlew.bat compileTestJava`: 성공 (3 tasks up-to-date).

로컬 Node는 24.14.0, CI는 24.19.0이며 pnpm은 같은 11.19.0이다.
동일 Major/지원 Engine에서 CI 명령을 실행했지만 원격 Runner의 OS·Patch 환경과 완전히 같지는 않다.

## 실제 연동과 남은 검증

이번 환경의 `docker info`는 `dockerDesktopLinuxEngine` Pipe 부재로 실패했다.
`127.0.0.1:6380` Redis TCP 연결 확인도 실패했다.
실제 Backend HTTP/Redis 연동·Backend 통합/전체 테스트·Browser E2E/시각 검수는 실행하지 않았으며,
HTTP Mock 테스트와 구분한다. Compose MySQL과 기존 Volume을 사용·변경·삭제하지 않았다.

인프라·Backend를 실행하고 기존 승인된 ADMIN으로 다음을 확인한다.

1. 숙소 관리 목록/상세에서 “객실 관리”를 열고 전체/비활성 객실, 필터·페이지 이동을 확인한다.
2. 검증용 숙소에만 이름 `검증용 객실`, 전체 인원 `2`, 기본 가격 `150000.50`, 편의시설 `WIFI`로 생성한다.
3. 생성된 객실의 기본 가격/인원을 수정하고 최신 상세·목록을 확인한다. 날짜별 가격과 재고 API는 호출하지 않는지 확인한다.
4. 해당 객실만 INACTIVE/ACTIVE로 바꾸고 삭제나 기존 예약 변경이 없는지 확인한다.
5. 다른 숙소 선택 시 필터·페이지·기존 결과가 초기화되고, URL의 숙소 ID를 잘못 바꾸면 편집이 차단되는지 확인한다.
6. USER/익명 직접 진입과 실제 401/403을 확인한다. 저장 응답이 불명확하면 먼저 조회하며 시험용 재제출을 반복하지 않는다.

승인된 ADMIN이 없다면 DB 권한을 임의 변경하지 않는다. 운영/개발 기존 객실을 테스트 목적으로 덮어쓰지 않는다.

의존성/Lockfile/환경변수/Compose/CI 설정은 변경하지 않았다. 기존 Frontend CI의
frozen-lockfile → lint → format:check → typecheck → test → build 명령을 유지하며 새 테스트는 외부 서비스가 필요 없다.
원격 CI 성공과 최종 f0.6.0 Browser/디자인 검수는 별도 확인 대상이다.
