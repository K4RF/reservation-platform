# 관리자 숙소 관리 (#212)

## 실제 계약과 지원 범위

`AccommodationController`, 두 Policy Controller, `SecurityConfig`,
`dto/accommodation/request`·`response` 및 정책 도메인 검증을 기준으로 구현했다.
새 Backend API·DB Schema·권한·의존성은 추가하지 않았다.

| 작업 | Backend API (`/api/v1` 기준) | 화면 동작 |
| --- | --- | --- |
| 관리 목록 | `GET /accommodations` | 공개 GET 재사용, 상태 미지정/ACTIVE/INACTIVE, name 부분검색, city/region 정확검색 |
| 관리 상세 | `GET /accommodations/{id}` | 현재 정보와 편집 Form, 과거 null 위치·운영시간은 미등록/빈칸 |
| 생성 | `POST /accommodations` | ADMIN, 성공 ID의 상세를 GET, 새 행은 ACTIVE |
| 정보 수정 | `PUT /accommodations/{id}` | ADMIN, 전체 DTO 저장 후 상세 GET |
| 운영 상태 | `PATCH /accommodations/{id}/status` | ADMIN, 명시적 확인 후 ACTIVE/INACTIVE 변경·상세 GET |
| 예약 정책 | `POST/PUT /accommodations/{id}/booking-policy` | ADMIN, 작업 직접 선택·전체 입력·확인, 성공 Response 표시 |
| 취소 정책 | `POST/PUT /accommodations/{id}/cancellation-policy` | ADMIN, 작업 직접 선택·전체 입력·수수료 구간·확인, 성공 Response 표시 |

삭제 API는 없다. 정책 GET/DELETE도 없으며 숙소 DTO에 정책이 포함되지 않는다.
현재 정책 조회·기존값 자동 편집·존재 여부 판별·POST/PUT 자동 전환은 구현하지 않았다.
예약의 정책 Snapshot을 현재 숙소 정책으로 사용하지 않는다. 정책 성공 응답은 **직전 쓰기 결과**로
표시하며 재조회된 최신 정책이라고 하지 않는다. 나중에 다른 관리자가 바꾸었는지도 알 수 없다.

목록은 공개 검색 Form의 ACTIVE/available·날짜/활성 객실 조건을 가져오지 않는다.
`page`(0부터)/`size`(1~100), `ID/NAME`과 `ASC/DESC`를 URL에 보관하며 조건 변경 시 page=0으로
돌아간다. 페이지 이동·뒤로가기는 조건을 유지한다. 재진입 시 목록은 다시 GET하고, 명시적 새로 조회도 제공한다.
정렬과 상태 등의 잘못된 URL은 요청 전에 거절한다. 페이지 번호는 Backend Integer 범위 내에서 받는다.

## Form과 검증

- Create/Update는 `name`, `description`, `country`, `city`, `region`, `address`,
  `amenities`, `checkInTime`, `checkOutTime`, `timeZone`만 보낸다. status와 정책은 별도 작업이다.
- 필수 문자열·DTO 길이, TimeZone 저장 길이 50자, 서로 다른 유효 운영시간을 검사한다.
  시간대의 브라우저 Intl 검사는 입력 UX이며 최종 허용 ZoneId는 Backend가 검증한다.
- 편의시설은 PARKING/BREAKFAST/POOL/GYM/PET_FRIENDLY만 보낸다.
  기존 null 위치·시간은 주소에서 추측하거나 기본값으로 채우지 않는다.
- 예약 정책은 숙박일 정수 1 이상, 사전 예약일 정수 0 이상, 최소 ≤ 최대를 검사한다.
- 취소 정책은 무료 기준 > 마감 ≥ 0, 구간 시작은 마감 이상·무료 미만이고 중복 불가,
  마감일 구간 필수, 수수료율 정수 1~100%를 검사한다. 구간을 추가/제거할 수 있으며 내림차순으로 보낸다.
  최소 한 구간을 유지하고 입력이 바뀌면 정책 확인 체크를 해제한다.
- 정책 Form의 모든 값은 직접 입력한다. 임의 기본 정책으로 기존값을 가장하지 않는다.

최종 ADMIN 인증·도메인 유효성·저장은 서버가 담당한다. 공개 GET은 인증 없이 재사용하지만
관리 Route 전체는 기존 `ProtectedRoute`의 ADMIN 검사 아래에 있다. JWT role은 UI Hint일 뿐이다.
새로고침은 메모리 인증을 잃으며 재로그인이 필요하다.

## 중복 요청·오류·수명 경계

한 숙소 페이지의 정보/상태/두 정책 쓰기는 같은 동기 Ref Gate를 사용한다. 처리 중에는 모든
쓰기 Form과 상세 새로 조회를 비활성화한다. POST/PUT/PATCH 모두 `retryOnUnauthorized:false`이며
401도 자동 재발급 후 재전송하지 않는다. 공유 인증 처리가 재로그인으로 보낸다.
403은 서버 오류를 표시하고 임의로 USER로 바꾸지 않는다. 400의 errors 배열, 오류 code/message를
표시하고 404/409에서 정책 작업을 자동 전환하지 않는다.

네트워크·시간초과·중단·잘못된 성공 응답·5xx는 Commit 후 오류일 수 있어 모든 쓰기를 잠근다.
숙소 상세/목록 GET으로 결과를 확인할 수 있다. 정책은 GET이 없어 서버 기록 등 별도 확인이 필요하다.
“저장 결과를 별도로 확인” 체크 후 명시적 잠금 해제를 해야 같은 화면에서 새 쓰기가 가능하다.
해제 자체는 요청을 보내지 않으며 정책은 다시 확인 체크가 필요하다. 브라우저 중단은 서버 Rollback 증명이 아니다.
페이지 이동·새로고침까지 쓰기 잠금을 영구 저장하지 않으므로 다시 진입해도 결과 확인 없이 재제출하지 말아야 한다.
서버 요청 멱등성/정책 조회가 없는 한 클라이언트만으로 이 한계를 없앨 수 없다.

Unmount/숙소 ID 변경/새 로그인 세션 후 늦은 쓰기 응답은 화면 이동·성공 표시를 만들지 않는다.
각 조회는 기존 `useDetailQuery`의 Abort/응답 귀속 처리를 재사용한다. 쓰기 성공 후 숙소 상세는
GET으로 교체하고 목록은 재마운트 시 GET한다. 정책은 숙소 DTO에 없으므로 성공 Response를 별도로 표시한다.

## 자동 검증

신규 API 계약 Suite `api/adminAccommodation.test.ts`와 화면 Suite
`pages/admin/AdminAccommodation.test.tsx`가 실제 Router/AuthProvider/API Client를 사용하고
HTTP 경계만 Mock한다. 기존 Admin Route 권한·인증 Suite는 유지하며, 숙소 메뉴 이동 시 새 GET만 반영했다.

검증 범위: 모든 상태 목록/검색/정렬/Pagination/History, Loading/Empty/Error와 읽기 재시도,
Create DTO와 중복 Submit, Update/Status 성공 후 GET, 과거 null 보존, 잘못된 ID/조건,
정책 작업 선택/전체 입력/구간 검증/직전 성공 응답, 400/401/403/404/409/5xx,
자동 재전송 방지·불명확 결과 잠금·공유 Gate·Unmount 뒤 응답 무시와 ADMIN 경계를 포함한다.

실행 결과:

- `pnpm install --frozen-lockfile --offline`: Already up to date (pnpm 11.19.0).
- `pnpm lint`, `pnpm format:check`: 성공.
- `pnpm typecheck`: 성공.
- `pnpm test`: **60개 파일, 735개 테스트 통과**.
- `pnpm build`: 성공 (Vite 8.3.1).
- `backend/`에서 `.\gradlew.bat compileTestJava`: 성공 (3 tasks up-to-date).

로컬 Node는 24.14.0이며 CI는 24.19.0이다. 동일 Major/지원 Engine에서 같은 명령을 실행했지만
원격 Runner와 완전히 같은 OS/Patch 환경의 실행 증거는 아니다.

## 실제 연동·수동 확인 절차와 제한

이번 환경에서는 `docker info`가 `dockerDesktopLinuxEngine` Pipe 부재로 실패했다.
`127.0.0.1:6380` Redis TCP 확인도 실패했다. Backend 통합 테스트와 전체 test는 실행하지 않았다.
실제 Backend HTTP·Redis 연동과 Browser E2E/시각 검수는 실행하지 못했으며 HTTP Mock 통과와 구분한다.
개발 Compose MySQL/Volume은 사용·수정·삭제하지 않았다.

인프라와 Backend를 정상 실행한 후 기존 승인된 ADMIN으로 다음을 확인한다.

1. `pnpm dev` → `/admin/accommodations`에서 전체/ACTIVE/INACTIVE, 검색과 페이지 이동을 확인한다.
2. 새 테스트 숙소를 실제 위치·운영시간·IANA ZoneId로 생성하고 반환 ID의 상세가 열리는지 확인한다.
3. 해당 테스트 숙소만 수정/운영 중지/활성화하고 상세와 관리 목록의 갱신을 확인한다.
4. 정책 GET 부재를 확인하고 테스트 숙소에만 전체 정책 POST, 명시적 PUT을 수행한다.
   중복 POST 409와 미존재 PUT 404를 확인하되 실제 운영 숙소의 정책을 시험용으로 변경하지 않는다.
5. USER/익명 직접 진입은 Form을 마운트하지 않으며, 서버 403/만료 401은 자동 쓰기를 만들지 않는지 확인한다.

정책 예시(현재값이 아닌 직접 입력용): 예약 `1 / 14 / 0 / 365`, 취소 무료 `7`, 마감 `1`,
구간 `3일·30%`, `1일·50%`. API 주소/요청 예시는 위 표와 실제 Swagger를 따른다.
승인된 ADMIN이 없다면 권한을 DB에 임의 추가하지 말고 환경 준비를 요청한다.

## CI 영향

package.json/lockfile, 환경변수, Backend/Compose/Workflow는 변경하지 않았다.
기존 Frontend CI의 frozen-lockfile 설치 → lint → format:check → typecheck → test → build 경로를 유지한다.
새 테스트도 실제 DB/Redis 없이 HTTP Mock 경계에서 실행되며 Backend CI의 서비스 설정에 영향을 주지 않는다.
원격 CI 성공은 push/PR 후 별도 확인 대상이다.
