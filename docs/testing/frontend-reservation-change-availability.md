# 예약 일정 변경 준비와 일반 가용성 재조회 (#199)

이 문서는 #199의 조회 전용 구현·검증 기록이다. 이후 #200은 참고 요금과 실제 PATCH 제출을
추가했다. 현재 실행 계약과 전송 중/결과 불명 잠금은
[일정 변경 Flow](frontend-reservation-change-flow.md)를 따른다.

## 확인한 Backend 계약

`PATCH /api/v1/reservations/{reservationId}`는 JWT 소유자만 호출할 수 있으며
`UpdateReservationScheduleRequest`의 `checkInDate`, `checkOutDate`만 받는다.
객실·인원·대표 투숙객은 변경 요청에 포함되지 않는다. CONFIRMED만 변경할 수 있고
Backend는 운영 상태, 현재 객실 수용 인원, 숙소 예약 정책, 날짜별 재고를 검증한다.
이전/새 `[check-in, check-out)`의 공유 숙박일은 그대로 유지하고 빠진 날짜를 반환하며
추가 날짜만 새로 점유한다. 새 기간 전체의 가격과 일별 Snapshot은 변경 시 다시 계산한다.

`GET /api/v1/accommodations/{accommodationId}/rooms/available`는 공개 **신규 예약** 조회다.
checkInDate/checkOutDate/guestCount와 page/size를 사용하고 ACTIVE 숙소·객실, Capacity,
숙박일마다 OPEN 상태의 잔여 재고 및 숙소 예약 정책을 적용한다. 예약 ID를 받아 본인 점유를
제외하는 변경 전용 조회는 없다. 공유일의 재고가 본인 예약 때문에 가득 차면 현재 객실은
일반 조회에 없지만 PATCH 변경은 가능할 수 있다. 일반 조회 결과로 변경을 차단하거나
Frontend에서 재고를 더하고 빼는 보정은 하지 않는다. 서버 PATCH가 최종 판단한다.

## 구현 범위와 재사용

기존 인증된 상세의 `예약 일정 변경 준비`에서 현재 일정과 고정 객실 ID·인원을 보여준다.
새 날짜는 현재 날짜로 초기화하되 **명시적 제출 전에는 조회하지 않는다**.
`YYYY-MM-DD` 실제 달력 날짜와 Checkout > Check-in을 기존 availabilityValidation/
calendarDate로 검증한다. 브라우저 today나 서버 기본 TimeZone으로 정책을 추정하지 않는다.
숙소 ID는 현재 Room 카탈로그 조회에서 얻으며 실패하면 추측하지 않고 재조회 안내를 제공한다.
CANCELLED는 준비 기능을 표시하지 않는다.

RoomAvailabilitySection의 작은 Form 상태/검증/재조회 책임을 `useAvailabilityForm`으로,
날짜 Label/Input을 `StayDateFields`로 분리해 기존 탐색과 변경 준비에서 함께 사용한다.
기존 로그인 후 조건 복원·객실 선택·Booking 생성 흐름은 그대로 유지한다. 공유
getAvailableRooms와 useDetailQuery로 DTO 검증, 공개 GET, Timeout/취소·늦은 응답 차단을 재사용한다.

`getReservationChangeAvailability`는 page=0/size=20부터 현재 roomId를 찾는다.
첫 페이지에 없다는 이유로 미포함을 확정하지 않고 마지막 페이지까지 조회한다.
현재 객실을 찾으면 추가 조회를 종료하고 다른 객실을 선택하거나 표시하지 않는다.
후속 페이지 실패는 Error이며 미포함 결과로 바꾸지 않는다. 취소된 요청은 다음 페이지로
진행하지 않는다. 이는 여러 시점의 일반 조회이므로 가격 보장/원자적 가용성 견적이 아니다.
큰 숙소에서는 페이지별 요청 비용이 있다. 새로운 Backend Batch/변경 전용 API는 추가하지 않았다.

표시는 `listed` / `not_listed`로 **일반 목록 포함 여부**를 구분하고, 각각 조회 시점 참고/
기존 점유로 인해 미포함일 수 있음을 안내한다. Loading/Error/빈 결과를 구분하며
400/401/403/404/409·5xx·Network/Timeout과 계약 오류는 기존 ApiError로 처리한다.
서버 오류 코드/메시지도 보존하고 재시도는 GET만 수행한다.

날짜 수정은 성공/오류/Loading 결과를 즉시 폐기하고 진행 중 요청을 취소한다.
동일 날짜 재조회도 새 요청을 보낸다. 준비 화면 닫기, 예약·숙소·원 일정 변경, 상세
세션 변경/이탈은 Draft와 이전 응답을 폐기한다. 조회 전후 원 예약의 날짜·가격·투숙객과
취소 정책 Snapshot은 유지된다. 개인정보/토큰/Draft를 URL 또는 Storage에 저장하지 않는다.

실제 PATCH 실행과 변경 예상 금액은 후속 이슈다. BookingSummary/bookingPrice는
현재 가격 조회이며 기존 예약 확정 Snapshot이나 변경 성공을 의미하지 않는다.
생성 전용 UI/생성 시 최종 검증 문구를 그대로 결합하지 않았고 가격 조회도 이번에는 요청하지 않는다.
후속 변경 실행은 일반 가용성 미포함을 Submit 차단 조건으로 사용해서는 안 된다.
관리자/재고 보정/전체 디자인 변경은 범위 밖이다.

## 검증 (2026-10-11)

- Frontend CI와 동일한 `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`,
  `pnpm build`: 성공. 전체 51 files / 516 tests (기존 478개 유지).
- 새 API 테스트는 고정 객실/인원의 공개 GET, 후속 페이지/최종 미포함, 조기 종료,
  잘못된 ID/기간, 서버 오류 보존, 페이지 불일치 및 요청 취소를 검증한다.
- Component 테스트는 현재 일정·날짜 검증·명시적 조회·참고 결과·객실 고정,
  날짜 편집/동일 기간 재조회·Error/Retry·늦은 응답·닫기/예약 변경·CANCELLED·카탈로그 실패를 검증한다.
- 기존 ReservationDetailPage의 Router/AuthProvider/API Client 테스트를 확장해
  본인 상세 Bearer → 공개 가용성 GET → 원 Snapshot 유지 흐름을 검증한다.
  기존 탐색/로그인 조건 복원/Booking 생성·완료/목록/상세 Suite를 재사용한다.
- Backend 기존 ReservationIntegrationTest 44개, AvailableRoomIntegrationTest 8개: 성공.
  `backend`에서 실행한 PowerShell 명령은 아래와 같다.
  새로운 Backend 테스트나 API/의존성/설정은 만들지 않았다.
- Mock 없는 실제 HTTP: 별도 임시 H2/Redis 7.4 Testcontainer로 Spring Boot를 8081에 실행하고
  Vite SSR로 실제 Frontend 모듈을 로드했다. 가용성의 공개 GET, 두 번째 페이지의 현재 객실,
  공유일 일반 미포함과 조회 후 원 Snapshot 유지가 성공했다. 프런트엔드 조회는 모두 GET이다.
  **검증 전용** HTTP PATCH로 일반 미포함이어도 공유일 축소 변경 200, 타인 403,
  잘못된 기간 400, 새 재고 부족 409/INVENTORY_005를 확인했다. 프런트엔드에 PATCH 호출을
  구현한 것은 아니다. 임시 H2만 변경했고 개발 Compose DB/Volume은 사용하지 않았다.
  검증 후 임시 서버/Redis/토큰 파일을 정리했다.

```powershell
.\gradlew.bat test --tests junsik.reservation.controller.ReservationIntegrationTest --tests junsik.reservation.controller.AvailableRoomIntegrationTest
```

의존성·lockfile·환경변수·실행 설정·GitHub Actions 변경은 없다. 기존 frozen-lockfile 설치와
CI 명령을 그대로 사용한다. 로컬 Node 24.14.0/pnpm 11.19.0, CI Node 24.19.0이다.
원격 Actions, 실제 브라우저/Google E2E·모바일/최종 시각 검수는 별도 미검증이다.
Backend 소스 변경이 없어 전체 backend test/build는 재실행하지 않았다.

## 비파괴 수동 확인

기존 Compose/Backend 및 `frontend`에서 `pnpm dev` 실행 → 기존 테스트 계정으로 로그인 →
내 예약의 CONFIRMED 상세 → 일정 변경 준비 → 현재 기간·고정 객실/인원 확인 → 새 날짜 조회 →
Network의 `rooms/available` 조건/공개 GET과 참고 결과 확인 → 날짜 수정 즉시 결과 초기화 →
같은 날짜 재조회/닫기/목록 복귀/로그아웃을 확인한다. CANCELLED에는 준비 버튼이 없어야 한다.
조회 오류와 카탈로그 실패는 새로고침/명시적 재조회로 확인하며 실제 예약 변경은 필요하지 않다.
기존 점유와 겹친 날짜에서 객실이 미포함이어도 변경 불가로 표현하지 않는지 확인한다.
토큰/연락처는 공유하지 않고 DB 삭제·Volume 제거·실제 취소를 하지 않는다.
