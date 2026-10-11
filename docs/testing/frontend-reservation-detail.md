# 본인 예약 상세 (#198)

## 구현과 서버 계약

기존 `/reservations/:reservationId`에 진입하면 보호 Route와 공유 API Client를 통해
`GET /api/v1/reservations/{id}`를 새로 호출한다. USER/ADMIN 모두 본인 예약만 조회하며
Backend JWT Principal/소유권 검증이 최종 경계다. 목록/History State의 성공 표시를
신뢰하지 않는다. 기존 완료/목록 Projection과 테스트는 유지하고 별도 상세 타입을 추가했다.

`ReservationDetail`은 실제 `ReservationResponse`의 화면용 Projection이다.

| 서버 필드 | 화면 책임 |
| --- | --- |
| reservationId, reservationNumber, roomId | 조회 식별자·공개 번호·현재 카탈로그 조회 |
| checkInDate, checkOutDate, stayNights, guestCount | 저장된 기간·총 투숙 인원 |
| representativeGuest | 예약 대표 투숙객 이름/이메일/연락처; 회원 Profile로 대체하지 않음 |
| nightlyPriceSnapshot, totalAmount, nights | 첫 숙박일·총액·숙박일별 확정 가격; 실시간 가격 조회 없음 |
| cancellationPolicySnapshot | 예약에 저장된 무료 기준/마감/수수료 구간 |
| status | CONFIRMED(예약 확정) / CANCELLED(예약 취소) |
| cancelledAt, cancellationFeeAmount, refundAmount | 저장된 취소 결과; UTC 시각·적용 수수료·예상 환불 |

숙소·객실 이름은 #197의 공개 카탈로그 조회를 재사용하는 **현재 정보**다. 운영 시간은
이번 상세에서 표시하지 않으며 예약 Snapshot으로 추정하지 않는다. createdAt, Add-on,
canCancel, 사전 수수료 견적은 응답에 없어 추가하지 않는다. 금액에 통화 기호를 추측하지 않는다.

첫 숙박일 가격은 모든 숙박일의 단일 가격을 의미하지 않는다. 기존 money Utility로
정수 소수 단위를 사용해 유효성/일별 합계·첫날·총액 일치를 검증한다. 기간은
`[check-in, check-out)`이며 빈 일별 기록은 과거 예약으로 허용하되 부분·중복·Checkout 포함
기록은 오류로 처리한다. JSON Number의 안전 범위를 넘는 금액은 반올림하지 않고 거부한다.
번호·대표 투숙객·취소 결과의 과거 null 및 빈 nights는 미등록/저장된 정보 없음으로 표시한다.
과거 일별 가격이나 취소 결과를 현재 가격/정책으로 재구성하지 않는다.

취소 정책 구간은 저장된 임계일/비율의 정적 안내다. 브라우저 today/Date.now로
취소 가능 여부나 견적을 계산하지 않는다. 실제 정책 판단은 서버의 숙소 TimeZone 기준이다.
CONFIRMED의 변경 버튼은 이후 #199의 **일정 변경 준비**에 연결했다. 취소 버튼은 비활성이다.
가용성 재조회 계약은 [일정 변경 준비 검증](frontend-reservation-change-availability.md)을 따른다.
CANCELLED에는 해당 버튼을 숨기고 상태상 변경/재취소 불가와 저장된 취소 결과를 표시한다.
이번 이슈는 읽기 전용이며 PATCH나 새로운 변경·취소 Route는 추가하지 않았다.
예상 환불 금액은 결제 취소/환불 완료를 의미하지 않는다.

## 오류·개인정보 경계

기존 `ApiError`, AuthProvider, ProtectedRoute, useDetailQuery를 재사용한다. 400/401/403/
404/409·5xx·Network/Timeout·잘못된 응답은 상세 성공으로 표시하지 않는다. 재시도는 GET만
호출하며 GET 401의 기존 단일 재발급을 유지한다. 재발급 실패는 로그인 화면으로 돌아간다.
잘못된 ID는 요청 전에 차단한다. ID/세션 변경 시 재마운트하고 이탈 요청을 취소하며
늦은 이전 응답을 무시한다. 투숙객 상세는 화면 메모리에만 보관하고 URL/Storage에 저장하지 않는다.
로그아웃·새 로그인 후 이전 세션의 투숙객 정보를 재사용하지 않는다.
카탈로그 일부 실패에도 저장된 예약 정보는 표시하고 명시적 재조회를 제공한다.

## 검증 기록 (2026-10-11)

- Frontend CI와 같은 `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`,
  `pnpm build`를 실행했다. 최종 전체 테스트: 49 files / 478 tests 성공.
- API 계약: Bearer GET, ID/날짜/가격/일별 합계/정책/UTC 결과 유효성, 과거 null과 빈 nights.
- 실제 Router/AuthProvider/API Client의 HTTP Mock 테스트: 저장된 혼합 가격·대표 투숙객·정책,
  취소 결과/상태별 액션, 카탈로그 실패/과거 정보, 오류/GET 재시도, 401 재인증 실패,
  잘못된 상세 응답, 예약 이동의 늦은 응답, 새 로그인·로그아웃 개인정보 폐기.
- 기존 #197 목록/인증/상세 이동 및 #184 완료 테스트를 유지했고 상세 진입 Fixture만
  실제 추가 필드가 포함된 응답으로 갱신했다. 기존 백엔드 테스트를 중복 생성하지 않았다.
- 기존 `backend`의 `./gradlew test --tests junsik.reservation.controller.ReservationIntegrationTest`:
  44 tests 성공. 처음에는 service 패키지로 잘못 필터링해 No tests found가 발생했고,
  실제 controller 패키지로 바로잡아 성공했다.
- 별도 임시 H2와 Redis 7.4 Testcontainer로 Spring Boot를 127.0.0.1:8081에서 실행했다.
  Vite SSR로 실제 Frontend API 모듈을 로드해 **Mock 없는 HTTP**로 확정 예약/혼합 일별 가격/
  저장 정책/현재 카탈로그/취소 결과와 익명 401·타인 403·없는 예약 404를 확인했다.
  인증 토큰은 출력하지 않았고 검증 후 임시 토큰 파일·서버·컨테이너를 정리했다.
  개발 MySQL/Compose Volume은 사용하거나 변경하지 않았다.

의존성·lockfile·환경변수·Backend 설정·Workflow 변경은 없다. 기존 frozen-lockfile 설치와
Frontend CI 명령을 그대로 사용한다. 로컬 Node 24.14.0/pnpm 11.19.0이며 CI Node는
24.19.0이다. 원격 Actions 실행은 Push/PR 후 별도 확인해야 한다.
Backend 전체 test/build는 백엔드 소스 변경이 없는 이번 작업에서 재실행하지 않았다.
HTTP 연동 성공을 실제 브라우저/Google E2E·MySQL Production 검증으로 확대하지 않는다.

## 비파괴 수동 확인

기존 Compose/Backend 및 `frontend`에서 `pnpm dev`를 실행한다. 기존 테스트 계정으로
로그인 → 내 예약 목록 → 확정/취소 예약 상세 → 번호·기간·인원·대표 투숙객·첫날/일별 가격·
저장 정책과 서버 JSON 비교 → 취소 결과 UTC/수수료/예상 환불 및 버튼 차이 → 목록 복귀를 확인한다.
Browser Network에서 본인 GET Bearer와 현재 카탈로그 공개 GET을 구분하고 PATCH가 없는지 확인한다.
비소유 예약/없는 ID·로그아웃/재로그인·새로고침을 확인하되 토큰/개인정보를 공유하지 않는다.
전체 새로고침은 메모리 인증 정책상 재로그인이 필요하다. 테스트 목적의 예약 생성/취소나
개발 데이터 삭제는 필요하지 않다. 모바일·키보드/스크린리더·최종 시각 검수는 별도 수동 확인한다.

변경·취소 실행, 필터 UI, 관리자 관리, 예약 생성 멱등성과 503 unlock 결과 구분은 후속 범위다.
