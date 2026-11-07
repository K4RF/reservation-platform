# Frontend / Backend 격리 통합 검증

[관련 이슈 #299](https://github.com/K4RF/reservation-platform/issues/299) ·
[기준 PR #298](https://github.com/K4RF/reservation-platform/pull/298) 병합 커밋 `e7b29e2` ·
[다음 화면 검수](../ui/frontend-guide.md)

UI Audit의 가상 응답과 별개로 **실행한 Vite → 실제 Spring Boot → 격리 DB/Redis/Kafka/Media**를
검증한다. 기존 개발 DB·Volume·Media, 실제 계정·외부 결제는 사용하지 않는다.

## 1. 실행

Java 21, 체크인된 Gradle Wrapper, 로컬 Docker Compose v2(`up --wait`),
[Frontend README](../../frontend/README.md)의 Node.js 및 pnpm 11.19.0이 필요하다.
일반 실행 설정은 [루트 .env_sample](../../.env_sample)과
[Frontend .env.example](../../frontend/.env.example)을 참고한다. 이 검증에는 기존 `.env`를 복사하지 않는다.

저장소 루트에서 다음을 실행한다(Windows는 `./gradlew` 대신 `.\gradlew.bat`).

```sh
cd backend
./gradlew bootJar
cd ../frontend
pnpm install --frozen-lockfile
cd ..
node scripts/integration/run.mjs --hold
```

| 구성 | 전용 연결 |
| --- | --- |
| Browser → Vite | `http://127.0.0.1:15199`, `VITE_API_BASE_URL=/api/v1` |
| Vite → Spring | `API_PROXY_TARGET=http://127.0.0.1:18099`, API와 `/api/v1/media/{mediaId}/content`를 같은 프록시로 보냄 |
| Spring → MySQL 8.4 | `127.0.0.1:53399`, 일회용 `reservation_integration` DB/계정/Volume |
| Spring → Redis 7.4 | `127.0.0.1:56399`, 이 실행 전용 인스턴스(Refresh/캐시/락) |
| Spring → Kafka 4.3.1 | `127.0.0.1:59399`, 이 실행 전용 Broker/Volume(기본 토픽과 그룹 이름을 공유 인프라에 사용하지 않음) |
| Spring → 파일 | `MEDIA_STORAGE_ROOT`는 `.local/integration-…/media`; JAR는 그 실행의 빈 작업 디렉터리에서 시작 |

실행기가 임의의 Compose 프로젝트 이름과 임시 DB 비밀번호, 실행별 JWT 키/issuer를 생성한다.
[전용 Compose 파일](../../infra/integration/compose.yaml)은 개발 Compose와 병합하지 않는다.
Spring에 전달하는 환경은 위 연결로 한정한다. 외부 OAuth는 더미 Client ID/Secret을 써서 **실행하지 않는다**.
실제로 검증할 때에는 별도 Google 테스트 Client의 `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`,
허용된 Backend callback `/login/oauth2/code/google`와
`VITE_OAUTH2_BACKEND_URL`/`OAUTH2_FRONTEND_BASE_URL`이 모두 맞아야 한다. 값은 보고에 포함하지 않는다.

스모크가 테스트 USER 2명과 ADMIN을 가입 API로 준비하고, 이 DB에서 마지막 fixture의 정확한 ID만 ADMIN으로 변경한다.
이메일/비밀번호는 테스트용으로만 사용한다. 로그인 후 ADMIN HTTP로 숙소·객실, 두 정책, 날짜 재고 3건,
날짜별 가격 1건, 합성 PNG(숙소·객실)를 생성한다. 날짜는 숙소 시간대의 오늘에서 30일 이후다.
예약 생성·변경·취소를 마치면 재고와 최종 저장 상태를 다시 읽는다. Kafka는 활성화해 이 예약의
Outbox 3건이 발행되고 같은 Event ID가 Consumer 원장에 기록됐는지 확인한다.

후속 수동 로그인 검증에는 `--hold` 실행 직전 현재 셸의 `INTEGRATION_FIXTURE_PASSWORD`에
12~72바이트의 **새 임시 비밀번호**를 입력한다. 계정은 `fixture-owner@example.test`(예약 소유자),
`fixture-other@example.test`(다른 회원), `fixture-admin@example.test`(ADMIN)이다.
기본 실행은 계정별 비밀번호를 무작위 생성하며 출력하지 않는다. PowerShell 7에서는 다음처럼 입력할 수 있다.

```powershell
$env:INTEGRATION_FIXTURE_PASSWORD = Read-Host -MaskInput 'Disposable fixture password'
try { node scripts/integration/run.mjs --hold }
finally { Remove-Item Env:INTEGRATION_FIXTURE_PASSWORD -ErrorAction SilentlyContinue }
```

`--hold`가 있으면 스모크 성공 후 브라우저에서 Home, `/accommodations`, 출력된 Detail 경로를 열 수 있다.
Swagger UI는 `http://127.0.0.1:18099/swagger-ui.html`, JSON은 `/v3/api-docs`다.
인증 수명주기 검증을 추가하려면 `--auth`를 지정한다.
[실제 인증 검증](frontend-authentication-flow.md#격리된-실제-인증-검증-300)에서 짧은 TTL과 검증 경계를 확인할 수 있다.
검색·예약과 별도 브라우저 일정을 준비하려면 `--booking`을 사용한다.
[격리 검색·예약 검증](public-exploration-booking-flow.md#격리-검색예약-검증-301)을 참고한다.
본인 예약 일정 변경·취소에는 `--management`를 사용한다.
[격리 예약관리 검증](frontend-reservation-management-flow.md#격리-예약관리-검증-302)을 참고한다.
ADMIN 권한과 카탈로그·가격·재고·사진 쓰기에는 `--admin`을 사용한다.
[격리 관리자 검증](frontend-admin-management-flow.md#격리-관리자-검증-303)을 참고한다.
Enter로 종료한다. `--hold`가 없으면 스모크 직후 종료한다.
실행기는 성공 시 자기 프로세스·Compose 프로젝트·Volume·전용 스크래치만 정리한다.

### 실패 시 복구

- 실패한 쓰기를 재전송하지 않는다. 실행기는 자체 서버를 종료하고 DB·저장소·로컬 로그를 보존한다.
  출력된 **이번 실행의** `reservation-integration-…` 프로젝트와 `.local/integration-…`만 확인한다.
  운영/개발 DB는 조사 대상이 아니다. 응답 불명 시 앨범의 최신 GET 또는 예약 본인 GET, 혹은 격리 DB의
  해당 ID/저장 행으로 결과를 확인한다. 서버가 내려간 상태라면 격리 DB를 읽기 전용으로 점검한다.
- 정리 전 `docker ps -a --filter label=com.docker.compose.project=<실행-프로젝트>`와
  `docker volume ls --filter label=com.docker.compose.project=<실행-프로젝트>`로 대상을 확인한다.
  아래의 `<실행-프로젝트>`는 출력된 전용 이름만 대입한다. `reservation-platform`을 넣지 않는다.

  ```sh
  docker compose --project-name <실행-프로젝트> --env-file .env_sample --file infra/integration/compose.yaml down --volumes
  ```

  이어서 본인 실행의 스크래치 폴더만 제거한다. 비정상 중단으로 포트가 남아 있으면
  새 실행 전 자신이 띄운 Java/Vite 프로세스인지 확인한다. 전역 Docker prune/개발 Compose down은 하지 않는다.
- 스모크 출력은 단계/상태만 기록한다. 요청·응답 Body, 자격 증명, 투숙객 데이터 또는
  가공하지 않은 서버 로그를 PR/이슈나 화면 캡처에 첨부하지 않는다.

## 2. API 대응표

경로는 `/api/v1` 기준이다. 전체 스키마는 실행 서버 OpenAPI, 권한의 최종 경계는
Backend Security 및 Service, 아래 Client명은 `frontend/src/api/`의 파일을 의미한다.

| 영역 | 메서드·경로 / 권한 | 화면·요청·응답 경계 |
| --- | --- | --- |
| 회원·로그인 | 공개 `POST /members`, `POST /auth/login`, `POST /auth/reissue`; Bearer `POST /auth/logout` | `member`, `auth`, `reissue`: 가입 201 + Location/USER. 로그인 200 Bearer pair, 재발급은 Access만, 로그아웃 204와 Redis Refresh 제거(Access 즉시 폐기는 아님). |
| Google | 공개 `GET /auth/oauth2/google/start?state=…`, `POST /auth/oauth2/exchange` | `googleOAuth2`, `auth`: 서버 Redirect와 일회용 코드 교환. Browser의 실제 Provider 왕복은 별도다. |
| 숙소 | 공개 `GET /accommodations`, `GET /accommodations/{id}`; ADMIN 목록 경로 POST·상세 PUT·`/{id}/status` PATCH | `accommodation`, `adminAccommodation`: `content/page/size/totalElements` 등 Offset 응답. city/region 정확 일치, 편의시설 AND, ID/NAME 정렬. 공개 UI 기본 ACTIVE는 UI 조건이며 Admin은 전체 상태를 조회 가능. |
| 객실 | 공개 `GET /accommodations/{id}/rooms`, `GET …/rooms/available`, `GET /rooms/{roomId}`; ADMIN 목록 POST·객실 PUT·`/status` PATCH | `room`, `adminRoom`: roomId·accommodationId·ACTIVE/capacity 검증. 가용성은 양의 전체 인원, `checkInDate/checkOutDate`, 해당 기간 모든 날짜 재고. 목록/가용 응답은 Offset. |
| 요금 | 공개 `GET /rooms/{id}/prices/{stayDate}`; ADMIN `POST …/prices`, `PUT …/prices/{stayDate}` | `bookingPrice`, `adminDailyPrice`: `DAILY`는 override/양의 ID, `DEFAULT`는 객실 기본가/null ID. 화면 예상 합계와 서버 저장 확정 금액은 별개. |
| 예약 | Bearer `POST/GET /reservations`, `GET/PATCH /reservations/{id}`, `PATCH …/{id}/cancel` | `reservation`, `reservationList`, `reservationDetail`, `reservationChange`, `reservationCancellation`: 생성 201, 본인만 목록·조회·변경·취소(ADMIN도 예외 없음). 생성 ID는 숫자 `reservationId`; 표시용 `reservationNumber`와 다름. 기본 UI는 Offset. Backend cursor 계약은 별도 노출. |
| 정책 | ADMIN `POST/PUT /accommodations/{id}/booking-policy` 및 `/cancellation-policy` | `adminAccommodation`: 생성 201/수정 200. 정책 GET/DELETE·존재 자동 감지 없음. 성공 응답은 방금 저장한 값이지 서버 재조회가 아님. 취소 정책은 예약 Snapshot으로 표시. |
| 재고 | ADMIN `GET/POST /rooms/{id}/inventories`, `PUT …/inventories/{inventoryDate}` | `adminInventory`: Calendar의 `startDate/endDate`는 양쪽 포함. 누락 날짜는 미생성. 총수량과 OPEN/CLOSED만 편집하며 예약/가용 수량·Version은 보내지 않음. |
| 공개 Media | 공개 `GET /media/{mediaId}/content` 및 카탈로그 응답 | `media`, `CatalogImage`, Gallery: 대표 이미지는 순서 첫 장, 목록/가용 최대 1, 상세 최대 20. 미등록 기존 행은 null/[]; 사진 실패가 Room 선택·예약 결과를 바꾸지 않음. 가짜 매물 이미지·Room Bed/Size/View는 채우지 않음. |
| 관리 Media | ADMIN 숙소/객실별 `…/{id}/media`와 하위 작업 | `adminMedia`: 최신 GET의 quoted strong ETag, 모든 쓰기 `If-Match`. POST/콘텐츠 교체는 file + application/json metadata multipart. 오래된 ETag는 409, 새 GET 후 검토. [관리 경로·형식·정리 계약](../architecture/media-management.md). |

- 재고 점유는 `[check-in, check-out)`이다. 첫날 적용가와 전체 숙박일 합계/`nights` Snapshot을 저장하며
  일정 변경은 공유 날짜를 유지하고 새 기간 전체를 다시 가격 계산한다. 취소의
  `cancellationDate`는 숙소 IANA 시간대의 달력 날짜, `cancelledAt`은 UTC Instant다.
  취소 응답의 `estimatedRefundAmount`는 상세에 `refundAmount`로 저장되며 실제 결제 환불이 아니다.
- [ErrorResponse](../api/error-response.md)의 HTTP 상태와 `status`가 맞을 때
  `errors.ts`가 서버 code/message/path/field errors를 사용한다. 400 `bad_request`
  (예: `COMMON_001` 필드, `COMMON_002` 바인딩), 401 `unauthorized`, 403 `forbidden`,
  404 `not_found`, 409 `conflict`, 5xx `server_error`. 요청이 저장됐는지 불명확한 경우에는
  생성/변경/취소/관리 쓰기를 자동 재실행하지 않고 조회로 복구한다. 스모크는 실제 400/401/403/404/409를
  검증하며 5xx를 인위적으로 발생시키지 않는다. 기존 Client 및 lifecycle 테스트가 오류/무재전송을 보완한다.
- 별도 Origin용 Backend CORS 허용 설정은 추가하지 않았다. 프록시와 달리 외부 Origin에서는
  preflight, `Authorization`·`If-Match` 허용, `ETag` 노출을 따로 검증해야 한다.
  현재 경로를 교차 Origin에서 지원한다고 간주하지 않는다.

## 3. 검증 경계

- 자동 스모크는 실제 TCP HTTP/PNG·DB·Redis·Kafka를 검증하지만 브라우저 UI 또는 Google Provider를 대체하지 않는다.
- 기존 `MediaManagementMySqlIntegrationTest`는 테스트컨테이너의 독립 검증이다.
  UI Audit 및 네 Frontend lifecycle suite는 HTTP Fixture/Mock, 원격 CI는 별도 환경이다.
- 이 실행은 기본 개발/운영 구성, 실기기, 외부 인증, 결제, 동시 부하, 시각 최종 승인을 보장하지 않는다.
