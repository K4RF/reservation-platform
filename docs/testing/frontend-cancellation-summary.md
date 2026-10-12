# 취소 정책·수수료 요약 및 취소 전 확인 (#201)

## 실제 Backend 계약

ReservationController/Service, ReservationCancellationPolicy, CancellationPolicySnapshot,
ReservationResponse, ReservationCancellationResponse와 OpenAPI를 확인했다.

- **Preview/Quote API는 없다.** 취소 직전 수수료/예상 환불 금액과 canCancel 필드는 제공되지 않는다.
  `GET /api/v1/reservations/{id}`의 CONFIRMED는 cancelledAt/cancellationFeeAmount/refundAmount가 null이다.
  null을 0원 또는 무료 취소로 해석하지 않는다.
- 예약의 `cancellationPolicySnapshot`은 무료 기준일, 마감 기준일, 내림차순 수수료율 구간이다.
  현재 숙소 정책으로 대체하지 않는다. 일정 변경도 저장 정책을 유지한다.
- 서버는 숙소 TimeZone의 취소일과 체크인 사이 달력 일수로 저장 정책을 평가한다.
  마감보다 가까우면 `409 RESERVATION_009`로 거절한다. 허용된 취소 수수료는
  예약 totalAmount × 서버 선택 비율, 소수 둘째 자리 HALF_UP이며 예상 환불은 차액이다.
  **이는 Backend 계약 설명이다. Frontend는 일수/비율 선택/수수료 계산을 구현하지 않았다.**
- 실제 취소는 JWT 본인 전용 `PATCH /api/v1/reservations/{id}/cancel`, Request Body 없음이다.
  취소 응답의 `estimatedRefundAmount`와 상세의 `refundAmount`는 명칭이 다르다.
  cancelledAt은 UTC Instant이고 취소 응답만 cancellationDate/daysBeforeCheckIn/cancellationFeeRate도 갖는다.
  Detail에 없는 결과 일수/적용 비율은 브라우저에서 역산하지 않는다.
- 서버 취소는 모든 숙박일 재고 해제·CANCELLED·수수료/환불/시각 저장을 한 Transaction에서 수행한다.
  이미 취소된 예약은 `409 RESERVATION_005`, 타인은 403, 없는 예약/재고는 404이며
  Version 재고 충돌은 409다. 결제 취소/실제 환불 완료는 수행하지 않는다.

## 이번 구현과 #202 경계

`ReservationCancellationSummary` 타입은 기존 ReservationResponse의 저장 필드 Projection이며
새 서버 DTO나 견적 타입이 아니다. `getReservationCancellationSummary`는 기존 본인 상세
GET과 전체 Snapshot 검증을 재사용한다. Preview를 얻으려고 Cancel API를 호출하지 않는다.

CONFIRMED 상세의 `취소 정책 및 수수료 확인`을 열 때 본인 상세를 다시 읽는다.
Loading/Error/상태·정책·요약을 구분하고 안내 확인 Checkbox를 제공한다.
무료 기준일, 모든 수수료율 구간, **체크인 N일 전** 형태의 마감만 표시한다.
현재 무료/유료 구간, 오늘 기반 절대 마감 날짜, 현재 취소 가능 여부나 금액은 계산하지 않는다.
기존 저장 총액은 수수료 견적과 명확히 구분하고 취소 전 수수료·환불 금액은 미제공으로 표시한다.
실제 실행 버튼은 비활성이며 동의해도 서버 변경을 요청하지 않는다.

재조회에서 CANCELLED가 발견되면 동의/실행 대신 서버 저장 결과와 상세 재조회 버튼을 표시한다.
기존 상세와 확인 화면의 정책/결과 표시는 공통 Component로 재사용한다. 0은 0.00,
과거 null은 저장된 정보 없음이며 수수료나 환불을 추정하지 않는다. 결제/환불 완료와 구분한다.
취소 확인은 숙소/객실 카탈로그를 필요로 하지 않는다. 상세 전체 갱신은 GET을 다시 실행한다.

조회 실패는 기존 ApiError/LoadingState/ErrorState를 사용하고 HTTP 코드/메시지/필드 오류를
유지한다. 400/401/403/404/409·5xx·Network·잘못된 응답은 성공/취소 허용으로 표시하지 않는다.
GET만 재시도하고 닫기·예약/Snapshot 변경·이탈/로그아웃 뒤 늦은 응답을 무시한다.
개인정보·Token·확인 동의를 URL/Storage에 보관하지 않는다.

**실제 취소 Submit과 서버 취소 거부 응답 처리, 성공 후 상태/목록 갱신, 불명 결과의
재전송 차단은 #202 범위다.** #201의 오류 처리는 확인용 상세 GET이다. Backend Preview/새
정책 API, 관리자 화면, 재고 보정, 디자인 개편은 추가하지 않았다.

## 검증 (2026-10-12)

Frontend CI와 동일한 명령이 모두 성공했다.

```powershell
cd frontend
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
```

전체 54 files / 583 tests. 새 Component Suite 20건과 기존 상세 Suite 확장 3건으로
명시적 GET/Loading, 재조회 상태·Custom 정책, 동의와 무실행, 무료/전액/부분/과거 결과,
브라우저 시각 독립성, Error/GET Retry, 닫기/변경/늦은 응답과 Auth/Router 경계를 확인했다.
기존 #200 변경과 생성·탐색·예약 목록/상세 테스트를 유지했다. 중복 Backend 테스트는 만들지 않았다.

기존 Backend 관련 58 tests 성공:

```powershell
cd backend
.\gradlew.bat test --tests '*ReservationIntegrationTest' --tests '*ReservationCancellationPolicyTest' --tests '*CancellationPolicySnapshotTest' --tests '*CancellationPolicySnapshotIntegrationTest' --tests '*AccommodationCancellationPolicyIntegrationTest'
```

Mock 없는 HTTP/정적 UI 표시 확인은 별도 임시 H2/Redis 7.4 Testcontainer의 Spring Boot와
실제 Frontend API/React 요약 Component를 사용했다. 현재 숙소 정책은 7일/default지만
기존 예약의 14일·0일 마감·20/60/100% 저장 정책이 그대로 GET·표시되는 것을 확인했다.
CONFIRMED 사전 결과 null/금액 미제공과 타인 403/RESERVATION_004도 확인했다.
Backend ReservationCancellationPolicy로 **테스트 Fixture 안에서** 취소 결과를 평가·저장하여
총액 100,000.01의 무료 0.00/100,000.01, 30% 30,000.00/70,000.01,
50% 50,000.01/50,000.00이 실제 GET 및 UI에 그대로 표시되는 것을 확인했다.
이는 취소 API 연동 테스트가 아니며 Frontend는 GET만 호출했다. OpenAPI에도 Preview/Quote가 없다.
임시 서버/Redis/자격 파일은 정리했고 개발 Compose MySQL/Volume은 사용하거나 변경하지 않았다.

의존성·lockfile·환경변수·실행/Workflow 설정은 변경하지 않았다. 기존 CI frozen-lockfile 설치와
검증 명령을 유지한다. 로컬 Node 24.14.0/pnpm 11.19.0, CI Node 24.19.0이며 원격 CI와 실행 OS는 다르다.
Backend 소스 변경이 없어 전체 backend test/build는 재실행하지 않았다.
실제 Browser/Google E2E, 최종 시각/Responsive 검수, MySQL HTTP 연동과 원격 Actions는 미검증이다.

## 비파괴 수동 확인

기존 테스트 계정으로 로그인 → 내 예약 CONFIRMED 상세 → 취소 정책 및 수수료 확인 →
Network의 본인 GET/Bearer 확인 → 저장 정책/기간/총액·사전 금액 미제공 안내 확인 →
Checkbox 동의 → 실행 버튼 비활성 및 PATCH 미발생 확인 → 닫기/다시 열기/로그아웃 확인.
이미 CANCELLED인 상세에서는 서버 저장 수수료/환불/UTC 시각만 확인한다.
정책 조회 오류는 재시도 GET, 서버 상태가 바뀌었다면 상세 다시 조회로 확인한다.
이번 UI 검증을 위해 새 예약/취소를 만들거나 개발 데이터/Volume을 삭제할 필요는 없다.
