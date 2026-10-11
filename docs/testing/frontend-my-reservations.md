# 내 예약 목록 (#197)

## 구현 범위와 실제 계약

`/reservations`는 기존 `ProtectedRoute`의 USER/ADMIN 영역에서 본인 예약을 조회한다.
익명은 기존 로그인 복귀 흐름을 사용하고 알 수 없는 역할은 접근을 거부한다.
Backend의 JWT 검증과 회원 ID 조건이 최종 소유권 경계다. ADMIN도 이 화면에서는
자신의 예약만 조회하며 전체 회원 예약을 조회하지 않는다.

목록은 `GET /api/v1/reservations`의 `PageResponse<ReservationResponse>`를 사용한다.
전체 건수와 이전/다음 이동이 필요한 UI이므로 Offset 방식을 선택했다. 별도
`/reservations/cursor` 계약과 혼합하지 않는다. 화면은 `page=0`, `size=20`,
`sortBy=ID`, `direction=DESC`로 시작한다. 이는 Backend 기본 ID ASC와 달리 화면에서
명시한 최신 **ID 순서**이며 생성 일시 순서라고 추측하지 않는다. `?page=1`처럼
0-based 페이지를 URL에 보관하고 뒤로/앞으로 이동 때 재조회한다.

`ReservationSearchRequest` API 타입은 Backend가 지원하는 상태, inclusive
checkInFrom/To·checkOutFrom/To, ID/CHECK_IN_DATE/CHECK_OUT_DATE/TOTAL_AMOUNT,
ASC/DESC와 size 1~100을 반영한다. #197 화면에는 추가 필터·정렬 Form을 구현하지
않았으며 URL의 page 외 조건은 API에 전달하지 않는다. 잘못되거나 중복된 page는
요청 전에 거부하고 첫 페이지 복구를 제공한다.

`api/reservationList.ts`는 기존 예약 응답 검증을 재사용하고 목록용 Projection인
`ReservationSummary`를 반환한다. 예약 ID/번호, roomId, 인원, 체크인/체크아웃,
숙박 일수, totalAmount, 상태만 유지한다. 이름·숙소 ID·createdAt는 예약 응답에
없고 대표 투숙객 연락처와 memberId는 목록 상태/카드에 보관하지 않는다.
서버 JSON을 Entity 또는 새 DTO로 간주하지 않는다.

`api/reservationCatalog.ts`가 roomId로 공개 Room GET을, 반환된 accommodationId로
공개 Accommodation GET을 호출한다. 한 조회 안에서 동일 객실·숙소 요청을
중복 제거하며 세션 간 전역 캐시는 추가하지 않았다. 이 이름은 **현재 카탈로그**이고
예약 당시 이름 Snapshot이 아니다. 이름 조회 실패는 예약 조회 실패나 Empty로
바꾸지 않으며 확보한 이름/ID와 일부 정보 조회 불가 안내를 표시한다. 명시적
재조회로 복구할 수 있고 이탈한 요청은 취소한다. 최악의 경우 페이지당 최대
20개의 객실 GET과 20개의 숙소 GET이 추가된다. 별도 Batch/확장 목록 DTO는 후속
성능 검토 사항이며 이번에 Backend 계약을 확대하지 않았다.

`components/reservation/reservationView.ts`가 API Projection/카탈로그 → Card Model
변환과 금액 표시를 담당하고 `ReservationList`/`ReservationCard`는 표시만 한다.
`totalAmount`는 서버 Snapshot이며 현재 객실 가격으로 재계산하지 않는다. 기존
money Utility의 소수 2자리 검증을 재사용한다. 응답에 통화가 없으므로 통화 기호를
추측하지 않으며 결제 완료·환불 완료로 표현하지 않는다. 과거 null 예약번호는
미등록으로 표시하고 생성 일시도 만들어내지 않는다.

목록은 Loading/Error/Empty를 분리하고 400/401/403/404/409, Network/Timeout,
잘못된 응답을 기존 `ApiError`로 처리한다. 읽기 재시도만 제공하며 생성·변경·취소를
요청하지 않는다. 기존 Client의 Access Token 준비/단일 재발급/GET 재전송을
사용한다. 재발급 실패는 기존 로그인 안내로 전환한다. 새 로그인, 로그아웃,
페이지 이동/재시도에서 이전 회원·이전 요청의 결과를 노출하지 않는다.

카드 선택은 공개 예약번호가 아닌 서버의 numeric ID로
`/reservations/{reservationId}`에 이동한다. 진입 시 본인 예약 GET을 새로 호출해
최소 읽기 전용 Summary를 표시한다. 목록 State나 History의 성공 표시를 신뢰하지
않는다. 잘못된 ID는 요청하지 않는다. 이 진입 화면은 #197의 이동 요구를 충족하며
전체 상세(숙박일/투숙객/취소 정책)는 이후 #198에서 구현했다.
현재 상세 계약은 [예약 상세 검증](frontend-reservation-detail.md)을 따른다. 일정 변경·취소 실행은 후속 이슈 범위다.
기존 `/reservations/{id}/complete`는 유지하고 내 예약 목록 링크만 추가했다.

## 자동 검증

2026-10-11 실행 결과:

- Frontend `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm build`: 성공.
- Frontend `pnpm test`: 전체 47 files / 429 tests 성공 (기존 361개 유지).
- API 검증: 실제 경로/Query/Bearer, 응답 Projection, 잘못된 Query/Response,
  Empty/과거 null/취소 상태, HTTP/Network/취소, GET 401 단일 재발급.
- 카탈로그 검증: 요청 중복 제거, 공개 GET, 이름 조회 부분 실패, 이탈 후 조회 차단.
- Component/Router 검증: 상태·번호·기간·인원·저장 금액·현재 이름, 본인 상세 GET,
  USER/ADMIN/익명/알 수 없는 역할, 페이지/History/범위 밖 복구, Error/Retry,
  늦은 응답 무시, 새 로그인/로그아웃/재인증 실패.
- 기존 인증 통합 테스트는 목록 자동 조회에 맞는 PageResponse Fixture를 제공하도록
  갱신했다. 단일 Google 교환 및 명시적 동시 401/실패 주입 검증은 유지했다.
- Backend `./gradlew test --tests 'junsik.reservation.controller.ReservationIntegrationTest'
  --tests 'junsik.reservation.controller.RoomIntegrationTest'
  --tests 'junsik.reservation.controller.AccommodationIntegrationTest'`: 기존 75개 성공,
  fail/error/skip 0. H2 격리 Transaction을 사용했고 중복 Backend Suite는 추가하지 않았다.

## 실제 HTTP Backend 연동 확인

같은 날 일회성 검증 서버를 localhost:8081에 실행했다. 테스트 Runtime Classpath와
기존 Fixture를 재사용해 별도 H2 In-Memory DB에 소유자 예약 21건(확정 20·취소 1),
다른 회원 예약 1건, 빈 회원, 숙소·객실을 구성했다. Redis는 임시 Redis 7.4
Testcontainer의 임의 포트를 사용했다. Kafka/Outbox/Response Cache는 해당 검증
프로세스 인자에서만 비활성화했다. 저장소 설정이나 실행 환경변수를 수정하지 않았다.

Vite SSR로 **이번 Frontend API/매핑 모듈을 그대로 로드**해 실제 HTTP 요청으로
본인 21건만 반환, 20+1 페이지, 취소 상태 필터, 현재 숙소·객실 매핑, 500,000.00
저장 총액, 빈 회원 Empty, 본인 상세, 익명 401·다른 회원 상세 403·없는 상세 404를
검증했다. Mock HTTP 검증과 별도이며 개발 Compose MySQL/Redis 데이터·Volume을
사용하거나 변경하지 않았다. 일회성 서버와 Testcontainer는 검증 후 종료했다.
이는 실제 개발 MySQL·Google 로그인·브라우저 전체 E2E나 UI 시각 검수의 성공을
의미하지 않는다.

## 실행/CI와 수동 확인

의존성, lockfile, 환경변수, Backend source/build/config, Workflow 변경은 없다.
기존 Frontend CI의 frozen-lockfile 설치와 lint/format/typecheck/test/build 단계를
그대로 사용한다. 로컬 Node 24.14.0/pnpm 11.19.0으로 검증했으며 CI Node는
24.19.0이다. 원격 Actions는 Push/PR 후 별도 확인이 필요하다.

일반 개발 실행은 기존 Compose/Backend 및 `frontend`에서 `pnpm dev`를 사용한다.
기존 테스트 계정으로 로그인 → Header 내 예약 → Network의 본인 목록 GET/Bearer와
현재 카탈로그 공개 GET → 다음/이전/History → 카드 상세 GET → 목록 복귀 →
로그아웃/재로그인을 확인한다. 메모리 인증이므로 전체 새로고침은 재로그인이 필요하다.
실제 예약번호·저장 금액과 화면을 비교하고 민감한 토큰·연락처는 공유하지 않는다.
예약 생성이나 재고/Volume 삭제 없이 기존 기록으로 확인할 수 있다.

일정 변경·취소 실행 및 예약 필터 UI, 관리자 관리 UI, Browser E2E와 최종
색상/반응형 시각 검수는 후속 범위다. 이번에는 예약 생성 멱등성/503 unlock 오류
시점 등 기존 Backend 안전성 계약을 변경하지 않았다.
