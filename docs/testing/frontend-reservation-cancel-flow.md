# 예약 취소 API 및 Cancel Flow (#202)

## 계약과 책임

- JWT 본인 전용 `PATCH /api/v1/reservations/{reservationId}/cancel`, **Request Body 없음**.
  별도 Request DTO/Preview API를 만들지 않았다. Backend Controller/Service/Response와 OpenAPI를 확인했다.
- `ReservationCancellationResponse`: reservationId, CANCELLED, cancelledAt(UTC),
  cancellationDate(숙소 TimeZone), daysBeforeCheckIn, totalAmount, cancellationFeeRate,
  cancellationFeeAmount, estimatedRefundAmount. 상세 GET에서는 예상 환불 필드가 refundAmount이다.
- Frontend는 ID/상태/날짜/UTC 시각/정수 비율/안전한 금액 및 `수수료 + 예상 환불 = 총액`만 검증한다.
  브라우저 시각·정책 구간으로 취소 가능 여부, 수수료 비율/금액, 환불액을 계산하지 않는다.
  이전 상세 총액과 응답 금액을 강제로 일치시키지 않는다. 최종 처리 값은 서버 응답이다.
- Backend는 저장 정책 Snapshot을 숙소 기준 날짜로 평가하고 HALF_UP 수수료 계산,
  모든 `[check-in, check-out)` 재고 해제, CANCELLED 및 결과 저장을 한 트랜잭션에서 수행한다.
  PG 결제 취소/실제 환불 완료는 없다. 이를 성공 문구에서도 명시한다.

## 실행·갱신·실패 경계

본인 상세 → `취소 정책 및 수수료 확인` → 최신 본인 GET → 저장 정책/사전 금액 미제공 안내 →
Checkbox 동의 → **예약 취소 확정** 클릭 → 본문 없는 PATCH. 동의 자체는 요청이 아니다.
확인 GET에서 이미 CANCELLED이면 저장 결과/GET 갱신만 제공한다.
사전 확인은 카탈로그를 필요로 하지 않으며 기존 #201 조회 검증/정책 Component를 재사용한다.

전송 Ref와 UI 잠금으로 중복 클릭, 동의 수정/닫기/재조회, 동시에 일정 변경을 차단한다.
일정 변경이 진행 중이거나 결과 불명이면 취소 UI도 잠근다. AbortController/세션 버전으로
이탈/로그아웃/다른 로그인 뒤 늦은 완료 응답을 폐기한다. Abort는 서버 롤백이 아니다.
이 잠금은 현재 화면에 한정하며 다중 Tab/재진입/서버 멱등성을 보장하지 않는다.

성공은 모든 완료 응답 필드를 표시하고 본인 상세 GET으로 상태/저장 Snapshot을 갱신한다.
완료 응답은 화면 메모리에 유지해 후속 GET 오류 시에도 성공을 잃지 않는다. 이때 재시도는
GET뿐이며 PATCH를 반복하지 않는다. 목록에는 공유 Cache가 없어 재진입 시 새 GET을 수행한다.
결과 불명 뒤 GET에서 CANCELLED가 확인되면 상세에 있는 저장 결과만 표시한다.
상세에 없는 적용 비율/달력 일수/취소일은 역산하지 않는다.

400/401/403/404/409 및 정책/재고 오류는 ApiError의 서버 코드·메시지·필드 상세를 유지한다.
이미 취소된 예약(RESERVATION_005), 취소 마감(RESERVATION_009), 소유권(RESERVATION_004),
누락(RESERVATION_003), INVENTORY 오류를 서버 응답에 따라 안내한다.
Network/Timeout/5xx/잘못된 응답은 이미 처리됐을 가능성이 있어 재전송을 금지한다.
**모든 취소 실패 후에는 상세 GET과 새 확인을 거쳐야 다시 PATCH를 보낼 수 있다.**
조회 실패는 GET만 재시도한다. PATCH 401 자동 재발급/Replay는 비활성화했다.
전송 전 기존 Client의 Token 유효성 확인/재발급은 유지한다. Auth 실패는 보호 Route에서 로그인으로 이동한다.
Token/동의/결과/투숙객 정보를 URL/Storage에 추가하지 않았다.

## 검증 (2026-10-12)

Frontend 전체 **56 files / 635 tests**와 `pnpm lint`, `pnpm format:check`,
`pnpm typecheck`, `pnpm test`, `pnpm build` 성공. 기존 #201 조회/무자동실행 테스트와
#200 변경·기존 생성/상세/목록 회귀를 유지했다. API 계약/잘못된 결과, 명시적 제출,
중복/진행 상태/오류, 세션/이탈, 상세/목록 갱신, GET 실패/불명 결과 복구와 401 무재전송을 검증했다.
공통 Client 기존 테스트가 Timeout/Abort의 Error 종류 분류를 검증한다.
기존 Backend 테스트를 중복 생성하지 않고 아래 **58 tests**를 `--rerun-tasks`로 재실행해 성공했다.

```powershell
cd backend
.\gradlew.bat test --rerun-tasks --tests '*ReservationIntegrationTest' --tests '*ReservationCancellationPolicyTest' --tests '*CancellationPolicySnapshotTest' --tests '*CancellationPolicySnapshotIntegrationTest' --tests '*AccommodationCancellationPolicyIntegrationTest'
```

Mock 없는 HTTP는 별도 H2 + Redis 7.4 Testcontainer에서 실제 Spring Boot와 Frontend
API 모듈/React 완료 Component를 연결했다. 실제 PATCH로 무료와 50% 취소를 실행해
총액 100,000.01 → 수수료 50,000.01 / 예상 환불 50,000.00의 HALF_UP 결과와 UI 표시,
상세 refundAmount/상태 및 목록 갱신, 반복 취소 409, 마감 409, 타인 403, 누락 404,
익명 401, OpenAPI의 Request Body 없음까지 확인했다.
서버 종료 전 DB에서 취소 성공 예약의 reservedQuantity=0/CANCELLED와
거절된 예약의 reservedQuantity=1/CONFIRMED를 확인했다.
첫 Probe는 응답 Instant의 나노초와 DB 저장 후 마이크로초 문자열 차이로 검증 Assertion이 실패했다.
Probe 시각 비교를 밀리초 시각 동등성으로 조정해 새 임시 DB에서 전체 HTTP 검증을 통과했다.
애플리케이션의 시각을 임의로 변환/수정한 것이 아니며 두 UI는 각각 서버 문자열을 표시한다.
임시 서버/Redis/자격 파일을 정리했다. 개발 Compose MySQL/Volume과 .env는 사용/변경하지 않았다.

의존성·lockfile·환경변수·Backend 실행 설정·Workflow는 변경하지 않았다. 기존 Frontend
CI frozen-lockfile 설치 및 위 검증 명령과 호환된다. 로컬 Node 24.14.0/pnpm 11.19.0,
CI Node 24.19.0/Linux는 차이가 있다. 원격 Actions 성공으로 주장하지 않는다.
Backend 소스 변경이 없어 전체 Backend test/build는 재실행하지 않았다.
실제 Browser E2E, Google 로그인, MySQL HTTP 연동, 최종 반응형/시각 검수는 미검증이다.

## 수동 확인

조회만 확인할 때는 기존 예약 정책 확인/동의까지만 진행하고 확정 버튼을 누르지 않는다.
실제 취소는 데이터가 바뀌므로 **전용 폐기 가능한 예약/재고**로 검증한다. 기존 개발 예약을
임의로 취소하거나 DB/Volume을 삭제하지 않는다.

1. 본인 테스트 예약 → 취소 확인: 최신 GET/Bearer, 저장 정책, 사전 금액 미제공 확인.
2. 동의 후 확정 → Network의 PATCH 1회/본문 없음, 진행 중 버튼/변경 차단 확인.
3. 완료의 서버 비율/수수료/환불/취소일·UTC 시각 확인 → 상세 CANCELLED/저장 결과 확인.
4. 목록 재진입 → 새 GET/CANCELLED 확인. 재취소/일정 변경 버튼이 없어야 한다.
5. 폐기 가능한 환경에서 응답 유실/GET 실패를 재현하면 PATCH 대신 상세 GET만 재시도한다.
   이미 취소됐으면 저장 결과를 확인하고, 거절됐다면 새 정책 확인 후에만 다시 요청한다.
