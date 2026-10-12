# 예약 일정 변경 API 및 확인 Flow (#200)

## 소스에서 확인한 계약

`ReservationController.updateSchedule`의 JWT 본인 전용
`PATCH /api/v1/reservations/{reservationId}`는 `UpdateReservationScheduleRequest`의
`checkInDate`, `checkOutDate`만 받고 `ReservationResponse` 전체를 반환한다.
객실·인원·대표 투숙객·공개 번호·취소 정책 Snapshot은 유지된다.
`ReservationService.updateSchedule`은 한 Transaction에서 소유권, CONFIRMED 상태,
기간, 숙소/객실 운영 상태, 현재 Capacity, Booking Policy를 재검증한다.
이전/새 기간의 합집합 재고를 조회해 공유일은 유지하고 제거일을 해제하며 추가일만 차감한다.
전체 새 `[check-in, check-out)`의 현재 일별 요금/기본 가격으로 첫날·총액·일별 Snapshot을
다시 저장한다. 실패는 롤백된다. 생성 전용 Redis Lock/Retry는 변경에 적용되지 않는다.
Version 충돌은 `409 INVENTORY_011`이다. 브라우저에서 재고를 보정하거나 정책을 추정하지 않는다.

일반 가용성은 소유 예약 점유를 제외하지 않아 공유일이 미포함이어도 PATCH는 가능할 수 있다.
조회 실패와 미포함을 구분하지만 일반 목록 포함 여부를 변경 Submit 조건으로 사용하지 않는다.
변경 견적/가격 보장 Token/Idempotency Key/변경 진행 상태 조회 API는 없다.

## 화면과 상태 책임

- 기존 상세의 `예약 일정 변경 준비`와 날짜 검증·가용성 재조회 흐름을 유지한다.
  `일정 변경 내용 확인`을 누르기 전에는 요금 조회나 변경 PATCH를 요청하지 않는다.
- 확인 화면은 기존 기간/확정 총액과 새 기간/참고 예상액을 구분한다. 일별 조회는
  `getBookingPrice`를 재사용해 DAILY/DEFAULT 출처와 BigInt 소수 단위 합계를 표시한다.
  API에 없는 세금·통화·추가 요금은 만들지 않는다. 가격 조회 성공/안내 확인 전에는 제출을 막는다.
- 예상액은 여러 시점의 읽기 합계이지 원자적 견적이 아니다. 서버가 변경 시 재계산한
  응답 `totalAmount`가 확정값이다. 요청에는 예상 금액·guestCount·roomId·memberId가 없다.
- `changeReservationSchedule`은 기존 Client Bearer 인증과 DTO 검증을 재사용한다.
  전체 새 일별 합계, 날짜/ID 일치 및 불변 필드 보존을 확인한다. 401 자동 재전송은 끈다.
- 동기 Ref로 연속 클릭을 차단하고 전송 중 날짜·동의·재조회/닫기를 비활성화한다.
  날짜 수정/새 조회는 이전 참고 요금/동의/확인 화면을 버린다. 세션·예약 변경/이탈 뒤
  늦은 응답은 무시한다. URL/Storage에 개인정보·Token·Draft를 추가하지 않는다.
- 성공은 응답 금액을 알린 뒤 상세 GET을 새로 실행한다. 조회 오류의 재시도는 GET만 한다.
  예약 공용 Cache는 없으며 목록은 재마운트 시 새 GET이다. Catalogue Cache/서버 상세
  Response Cache의 범위는 예약 변경과 무관하여 별도 Eviction을 추가하지 않았다.
- 400/401/403/404/409는 서버 거절 안내·코드/메시지·필드 오류로 구분한다.
  재고 부족/누락·낙관적 충돌, Booking Policy, CANCELLED 상태도 서버 응답을 따른다.
  거절 시 원 예약의 날짜·가격·투숙객/정책 및 새 입력을 유지한다. 자동 PATCH 재시도는 없다.
- Network/Timeout/취소/응답 계약 오류/5xx는 이미 Commit됐을 수 있는 결과 불명이다.
  Submit·편집/닫기를 잠그고 `예약 상세 다시 조회`를 제공한다. GET은 저장된 현재 상태를
  보여줄 뿐 진행 중 PATCH의 종료/롤백을 증명하지 않는다. 자동 재전송하지 않는다.
  화면 이탈/Abort가 서버 롤백을 보장하지 않으며 다중 탭/서버 멱등성은 후속 과제다.

예약 취소 실행, Admin 관리, 새 Backend API/Schema, 디자인 전체 개편은 추가하지 않았다.
기존 생성 UI를 변경 화면에 결합하지 않고 날짜 Hook, 가격 API, 조회 Hook,
Loading/Error, money Formatter와 기존 Form/Button/Table 스타일만 재사용했다.

## 자동 검증 (2026-10-12)

Frontend CI와 같은 명령:

```powershell
cd frontend
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
```

전체 53 files / 560 tests. API 계약/날짜/불변 필드·Snapshot/401 무재전송,
확인·가격 실패·중복 클릭·도메인 거절·결과 불명 잠금·늦은 응답을 검증한다.
기존 상세 Router/Auth/Client Suite를 확장해 일반 미포함 → 가격 확인 → PATCH → 새 GET,
서버 확정액과 참고액 차이, 실패 시 기존 Snapshot 유지, 날짜 수정 시 동의 초기화,
응답 유실 후 GET 복구, 성공 후 조회 실패의 GET 전용 재시도, 401 로그인 복귀를 검증한다.
기존 Booking 생성/공개 탐색/로그인 복귀/목록/상세 테스트는 유지했다.

Backend 테스트는 중복 생성하지 않고 기존 Suite를 실행했다: 54 tests 성공.

```powershell
cd backend
.\gradlew.bat test --tests '*ReservationIntegrationTest' --tests '*AvailableRoomIntegrationTest' --tests '*BookingPolicyReservationIntegrationTest'
```

Mock 없는 HTTP 검증은 별도 임시 H2/Redis 7.4 Testcontainer의 실제 Spring Boot 8081과
Vite SSR로 로드한 실제 Frontend API 모듈을 사용했다. 기존 예약 2030-01-10→15/500,000을
01-11→14로 바꾸면서 일반 미포함, DAILY/DEFAULT/DAILY 예상 합계 400,000,
실제 PATCH 200·3박/첫날 125,000/총액 400,000·일별 Snapshot과 상세 GET을 확인했다.
타인 403/RESERVATION_004, 최소 숙박일 409/BOOKING_POLICY_005,
재고 부족 409/INVENTORY_005, 취소 상태 409/RESERVATION_006 및 거절 후 원 예약 보존을 확인했다.
서버 종료 전 DB 단언으로 11/12/13일 점유 유지, 10/14일 해제와 총액 재계산을 확인했다.
임시 서버·Redis·자격 파일은 정리했고 개발 MySQL/Compose Volume은 변경하지 않았다.

의존성/lockfile/환경변수/실행/Workflow 설정은 변경하지 않았다. frozen-lockfile 설치 및
기존 Frontend CI 명령을 그대로 쓴다. Backend 소스 변경이 없어 전체 backend test/build는
재실행하지 않았다. 원격 Actions, 실제 Browser/Google E2E, 최종 Responsive/시각 검수와
실제 MySQL HTTP 변경 검증은 이번에 실행하지 않았다. HTTP와 jsdom 검증을 구분한다.

## 수동 확인

테스트 전용 계정/객실/예약에서만 진행한다. Compose/Backend와 `pnpm dev` 실행 → 로그인 →
CONFIRMED 상세 → 변경 준비 → 고정 객실/인원 확인 → 새 기간 조회 → 변경 내용 확인 →
기존/참고 금액·일별 출처 확인 → 동의 → 변경 확정 → Network PATCH 날짜 전용 Body와
Bearer 확인 → 상세 GET의 새 기간·총액·일별 Snapshot 및 불변 투숙객/취소 정책 확인.
빈 일반 결과, 정책/재고 오류, 중복 클릭, Network 응답 유실 후 GET 복구도 확인한다.
모든 테스트 변경은 실제 재고를 수정하므로 실사용 예약이나 개발 데이터를 삭제하지 않는다.
