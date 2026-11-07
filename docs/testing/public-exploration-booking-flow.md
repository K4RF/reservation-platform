# 공개 숙소 탐색과 로그인 후 예약 (#195)

## 접근 정책과 상태

로그인 없이 다음 GET만 호출할 수 있습니다. SecurityConfig에 정확한 경로/Method를
등록했으며 `/api/v1/**` 전체를 공개하지 않습니다.

| GET | 용도 |
| --- | --- |
| `/api/v1/accommodations` | 검색·페이지 목록 |
| `/api/v1/accommodations/{id}` | 숙소 상세 |
| `/api/v1/accommodations/{id}/rooms` | 일반 객실 목록 |
| `/api/v1/accommodations/{id}/rooms/available` | 기간·전체 인원 기반 가용 객실 |
| `/api/v1/rooms/{id}` | 객실 상세 |
| `/api/v1/rooms/{id}/prices/{stayDate}` | 일별 적용 가격 |

프런트엔드 공개 조회는 로그인 상태에서도 `includeAuth: false`입니다. 만료된 Bearer가
공개 탐색을 막거나 조회 때문에 재발급을 강제하지 않습니다. 명시적으로 잘못된 JWT를
보내면 기존 JWT Filter의 401 처리는 유지됩니다. 예약 생성·본인 예약 조회/변경/취소는
인증/소유권 검사를 유지하고, 관리자 쓰기·재고 Calendar 조회는 ADMIN 권한을 유지합니다.
정책 GET은 새로 만들거나 공개하지 않았습니다. Swagger의 공개 조회에는 bearerAuth
requirement가 없고 관리 쓰기/예약에는 남아 있습니다.

헤더는 공개 숙소 검색을 항상 제공합니다. 익명은 로그인·회원가입, USER는 내 예약·로그아웃,
ADMIN은 추가로 관리자 메뉴를 제공합니다. 인증 확인 중에는 로그인·회원가입·역할 메뉴를
노출하지 않습니다. 세션 만료 후 공개 Home/숙소 화면은 유지하고 재로그인 안내를 표시하며,
보호 페이지는 기존 로그인 복귀 정책을 따릅니다.

익명은 객실 선택과 예상 요금까지 확인할 수 있지만 투숙객 입력/예약 POST는 할 수 없습니다.
`예약하려면 로그인`은 내부 상세 URL에 `checkInDate`, `checkOutDate`, `guestCount`,
`roomId`, 필요하면 `roomPage`만 담아 기존 안전한 로그인 복귀 경로로 전달합니다.
이메일 로그인과 기존 Google 복귀 경로에 같은 URL을 사용할 수 있습니다.
투숙객 개인정보와 토큰은 URL/Storage에 저장하지 않습니다. 복귀 시 가용성 API를 다시
호출하고 새 결과에 선택 객실이 있을 때만 입력 단계가 열립니다. URL은 재고/가격 보장이
아니며 예약 시 Backend가 정책·재고·요금을 다시 검증합니다. 전체 Reload 후에는 기존
메모리 토큰이 사라지므로 공개 탐색은 가능하지만 예약 전 재로그인이 필요합니다.

## 객실 없음 조사 결과

2026-10-08 로컬 Compose MySQL을 읽기 전용으로 확인한 결과:

- 숙소 3 `Swagger City Residence`: ACTIVE.
- 객실 5 `City Studio`: ACTIVE, 정원 2; 객실 6 `City Twin Room`: ACTIVE, 정원 3.
- 두 객실 모두 `room_inventories`가 0행이며 숙소 3의 Booking Policy도 없습니다.

RoomService는 숙소 정책을 먼저 검증하고 RoomRepository는 숙소/객실 ACTIVE, 정원,
모든 `[check-in, check-out)` 날짜의 OPEN·잔여 수량을 검사합니다. 재고 행이 전혀 없으므로
현재 데이터에서 숙소 3의 유효한 숙박 기간 가용성 조회는 빈 목록이 맞습니다. 과거 사용자가
입력한 날짜·인원/당시 데이터는 제공되지 않았으므로 당시 실패 원인까지 동일하다고 단정하지
않습니다. Frontend는 실제 checkInDate/checkOutDate/guestCount를 전달하며 잘못된 응답
구조와 API 실패를 Empty로 바꾸지 않습니다. 따라서 가용성 SQL의 조건을 완화하지 않았습니다.

다른 환경에서는 ADMIN 재고 Calendar와 아래 조건을 확인하세요:

1. 숙소/객실 ACTIVE, guestCount가 capacity 이하인지 확인.
2. 체크인 포함·체크아웃 제외 날짜 **각각**의 재고 행 존재, OPEN, total > reserved 확인.
3. 숙소 Booking Policy의 숙박일수와 사전 예약일 조건 확인. 정책 오류는 400/409 Error이지 Empty가 아닙니다.
4. 브라우저 Network에서 accommodationId와 날짜/인원 Query, HTTP status 및 content를 확인.

## 재현용 새 데이터 준비 (선택적 수동 실행)

기존 숙소/예약/재고를 수정하거나 Volume을 삭제하지 않습니다. Swagger에서 기존 개발용
ADMIN으로 로그인한 뒤 아래 POST로 **새 데이터**를 생성합니다. 자격 증명/토큰을 문서나 Git에
기록하지 마세요. POST의 반환 ID를 사용하고 3/5/6 같은 기존 ID를 덮어쓰지 않습니다.

1. `POST /api/v1/accommodations`:

```json
{
  "name": "#195 공개 탐색 데모",
  "description": "예약 흐름 검증용 테스트 숙소",
  "country": "대한민국",
  "city": "서울특별시",
  "region": "강남구",
  "address": "테스트 상세 주소",
  "amenities": ["PARKING"],
  "checkInTime": "15:00:00",
  "checkOutTime": "11:00:00",
  "timeZone": "Asia/Seoul"
}
```

2. 반환 accommodationId의 `POST /api/v1/accommodations/{id}/rooms`:

```json
{"name":"데모 트윈","capacity":2,"nightlyPrice":100000,"amenities":["WIFI"]}
```

3. 반환 roomId의 `POST /api/v1/rooms/{id}/inventories`를 아래 두 날짜에 각각 호출:

```json
{"inventoryDate":"2030-01-10","totalQuantity":5}
```

```json
{"inventoryDate":"2030-01-11","totalQuantity":5}
```

새 재고는 OPEN/예약수량 0입니다. 정책과 일별 가격을 생성하지 않으면 기본 객실 요금을
사용합니다. 테스트 날짜가 지나면 향후 날짜 두 개로 모두 바꾸세요.

4. 로그아웃/새 브라우저 세션에서 숙소를 검색하고 상세에서 **2030-01-10 → 2030-01-12,
2명**을 조회합니다. 새 객실이 나오며 예상 합계는 200000.00입니다. 체크아웃 날짜의 재고는
필요하지 않습니다. 기간을 2030-01-13까지 늘리면 12일 재고가 없어 Empty가 됩니다.
5. 로그인 버튼 → 이메일/Google 로그인 → 같은 객실/기간/인원 복귀 → 투숙객 입력/확인 →
예약 생성 → 서버 완료 GET을 확인합니다. 실제 생성은 새 데모 재고를 차감합니다.
6. Network에서 공개 GET은 Authorization이 없고 예약 POST/본인 GET은 Bearer가 있는지 확인합니다.
익명의 예약 POST/본인 GET은 401, USER의 관리자 API는 403, 다른 회원의 예약은 기존 소유권 오류여야 합니다.

## UI와 검증 경계

[Airbnb](https://www.airbnb.com/)의 목적지·일정·인원 중심 검색 구조를 참고하고,
[Agoda](https://www.agoda.com/)는 비교 대상 링크로만 기록합니다(정적 조회에서 상세 UI 확인 불가).
브랜드/화면을 복제하지 않고 teal/cream 톤과 자체 카드·간격·버튼 체계를 적용했습니다.
숙소 사진·평점·리뷰·할인·통화는 API에 없으므로 만들어 표시하지 않습니다. 카드의 패턴은
사진 대체 장식이며 `사진 정보 미제공`을 명시합니다. 홈의 개발 준비 문구는 탐색 안내로 대체했습니다.
검색 필터는 접고 펼칠 수 있고 모바일은 한 열 입력으로 표시합니다. 키보드 Focus/Label,
Loading/Error/Empty와 명시적 재시도는 유지합니다. 내 예약 목록·관리자 CRUD 화면은 후속 범위입니다.

기존 Backend/Frontend Suite를 확장했습니다. Frontend 통합 테스트의 HTTP 응답은 Mock이며
실제 Backend/Google 브라우저 E2E라고 표현하지 않습니다. Backend는 격리된 H2/MySQL/Redis
Testcontainers 및 Embedded Kafka를 사용하고 개발 DB를 테스트에 사용하지 않습니다.
로컬 브라우저의 실제 공개 검색/숙소 3 상세/빈 가용성은 별도 읽기 전용으로 검증합니다.
실제 예약 생성/Google 동의는 위 수동 절차로 추가 확인해야 합니다.

의존성, 환경변수, 기본 실행 설정, DB Schema, CI Workflow는 변경하지 않았습니다.
Backend CI의 Redis 6380 service와 Testcontainers 조건, Frontend CI의 frozen lockfile/
lint/format:check/typecheck/test/build 명령은 그대로 사용합니다. 원격 CI는 push/PR 후 별도 확인합니다.

### 2026-10-08 로컬 검증 결과

- `backend/gradlew.bat test`: 331 tests, 실패/오류/skip 0. MySQL/Redis Testcontainers 포함.
- `backend/gradlew.bat build -x test`: 성공 (CI와 동일한 빌드 명령).
- `frontend/`의 `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build`: 성공, 361 tests 통과.
- 실제 공개 GET 여섯 종류 200, 익명의 본인 예약/관리 재고 GET 401 확인.
- 브라우저에서 공개 목록/숙소 3 상세/2030-01-10 → 12, 2명 Empty 확인.
  키보드 Enter로 고급 필터 펼침과 390px 모바일 Home의 입력 겹침 수정/가로 넘침 없음 확인.

기존 8080 서버가 실행 중이므로 중지하지 않고 검수용 Backend를 8081로 실행했습니다.
검수 프로세스에만 `spring.jpa.hibernate.ddl-auto=none`, `reservation.kafka.enabled=false`,
Outbox enabled/scheduling-enabled=false, cache enabled=false를 적용해 스키마 갱신/이벤트
소비·발행을 막았습니다. 별도 Vite 5174 프로세스의 `API_PROXY_TARGET`만 8081로 연결했습니다.
이 임시 옵션은 파일에 저장하지 않았고 검수용 프로세스는 종료했습니다. 실제 로그인/예약 생성/
Google 동의/원격 GitHub Actions는 이번 브라우저 검수 결과에 포함하지 않습니다.

## 격리 검색·예약 검증 (#301)

[격리 환경 실행 절차](frontend-backend-integration.md)로 JAR와 Frontend 의존성을 준비한 뒤,
루트에서 `node scripts/integration/run.mjs --booking`을 실행합니다.
브라우저에서 이어서 확인하려면 `--hold`와 마스킹 입력한 `INTEGRATION_FIXTURE_PASSWORD`를
사용합니다. 스모크가 출력하는 도시·날짜·2인 조건은 자동 HTTP 검증과 재고를 공유하지 않습니다.
격리 화면에서만 `fixture-owner@example.test`로 로그인하고 합성 투숙객 정보를 사용하세요.

| 검증 경계 | 확인할 내용 |
| --- | --- |
| 실제 검색/카탈로그 HTTP | 정상 사진·공개 PNG와 사진 없는 숙소 응답, AND 필터·NAME 정렬·1건씩 페이지, 빈 검색, 날짜/인원 오류 및 존재하지 않는 사진 404 |
| 실제 가용성·예약 HTTP | 정원 초과·INACTIVE·CLOSED·재고 0 제외와 직접 POST 거절, 숙박 정책 위반, 익명 POST 401. 마지막 재고 소진 뒤 별도 계정의 POST 409와 저장 재고 대조 |
| 실제 금액/소유자 HTTP | DAILY 16,000 + DEFAULT 10,000 미리보기 후 첫날 가격을 17,000으로 변경. 예약/본인 GET은 확정 합계 27,000과 실제 2박 스냅샷을 사용하고 체크아웃 날짜는 차감하지 않음 |
| 브라우저 | A1 Home에서 검색·상세·객실 선택 → 로그인 → 새 가용성으로 선택 복귀 → 입력·검토·완료. 저장 전 가격은 예상치이며 완료는 본인 GET 결과. 보호 완료 URL 새로고침은 재로그인이 필요 |
| 기존 DOM/HTTP Mock | 잘못된 조건·레이어 취소·Back/Forward·포커스·Room ID 불일치·로그인 중 가용성 소실·사진 오류·중복 클릭·401 무재전송·5xx 결과 불명 등은 기존 Booking/Search/Room Suite를 재사용 |

브라우저 예약을 제출했다면 `--hold` 종료 시 그 회원·객실·일정의 저장 행만 검사해
확정 1건·2박·26,000인지 출력합니다. 네트워크 요청 수의 증거는 아니며, 재제출 및
Back/Forward 무재전송은 기존 Frontend 회귀와 별도로 봅니다. 요청 본문·비밀번호·토큰·
투숙객 정보나 원본 로그는 저장하지 않습니다. 실패 시 같은 요청을 다시 보내지 말고
격리 저장 상태를 먼저 확인합니다. 개발 Compose 및 운영 데이터는 대상이 아닙니다.

`503 INVENTORY_013`은 Redis 락 획득뿐 아니라 DB Commit 뒤 락 해제에서도 발생할 수
있습니다. Frontend는 이를 결과 불명으로 취급해 편집·재제출을 잠그고 본인 예약 확인을
안내합니다. 503 응답은 Mock으로 검증했으며 실제 Redis 장애 주입이나 서버 멱등성 검증은 아닙니다.
