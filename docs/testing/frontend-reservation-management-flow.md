# f0.4.0 Reservation Management 통합 검증 (#203)

## 검증 범위와 경계

f0.3.0 예약 생성 → 완료 GET → 내 예약 목록 → 본인 상세 → 날짜 변경 →
저장 취소 정책 확인 → 명시적 취소 → 상세/목록 GET을 연속 검증한다.
`frontend/src/test/ReservationManagementFlow.integration.test.tsx`는 실제 AuthProvider,
Router, Booking/Reservation Component와 API Client를 사용하고 **HTTP만 Mock**한다.
POST에서 저장한 Snapshot이 목록/상세/PATCH 이후 조회로 이어지도록 하나의 상태를 공유한다.
잘못된 Method/Endpoint는 실패한다. Hook/Component/API 함수를 Mock하지 않는다.

이는 실제 DB/재고 Race 또는 Browser E2E 검증이 아니다. 새 통합 Suite는 연결 흐름만
추가했으며 기존 #197–#202의 세부 계약/오류/상태 테스트는 복제하지 않고 재사용했다.

## Coverage Matrix

테스트 경로는 `frontend/src/` 기준이다.

| 이슈 확인 항목 | 재사용/추가 Suite | 확인한 책임 |
| --- | --- | --- |
| 생성부터 관리까지 전체 Lifecycle | **추가** `test/ReservationManagementFlow.integration.test.tsx` | f0.3 Booking 입력/혼합 요금/POST/완료 GET → 목록/상세 → 날짜 전용 PATCH → 저장 정책 확인 → 본문 없는 cancel PATCH → 상세/목록/History GET |
| 현재 정보 vs 저장 Snapshot | 위 통합 Suite, `pages/ReservationDetailPage.test.tsx` | 현재 이름/기본 가격과 확정 일별 요금·정책 구분, 변경 후 전체 숙박일·총액 갱신, 취소 후 저장 결과 |
| 일반 가용성 미포함 | 위 통합 Suite, `api/reservationChangeAvailability.test.ts`, `components/reservation/ReservationChangeAvailabilitySection.test.tsx` | 공유 날짜 점유 때문에 객실이 없어도 변경 거부로 확정하지 않음; 최종 변경 API가 판단 |
| 날짜 Validation·가용성·참고 가격 | `api/reservationChange.test.ts`, 위 가용성 Suite, `components/reservation/ReservationChangeConfirmation.test.tsx` | 실제 날짜/순서/인원 고정, 입력 변경 시 결과·동의 초기화, Checkout 제외, 가격 오류/Loading |
| 재고·Booking Policy 거절 | 새 통합 Suite, 기존 변경 Confirmation/상세 Suite | INVENTORY_011/BOOKING_POLICY_005 후 기존 Snapshot 유지, 자동 PATCH 없음, History 재진입은 GET |
| 사전 Fee 부재·저장 정책 | 새 통합 Suite, `components/reservation/ReservationCancellationSection.test.tsx` | 금액 미제공, 상대 기준/전체 비율 표시, Custom/0일 마감, 브라우저 시간으로 계산하지 않음 |
| Cancel 성공/거절/수수료 | 새 통합 Suite, `api/reservationCancellation.test.ts`, `components/reservation/ReservationCancellationSubmit.test.tsx`, 상세 Suite | 명시적 확인, 중복/상호 작업 잠금, 400/401/403/404/409·정책/재고 오류, 결과 모든 필드, refundAmount 명칭, 이미 CANCELLED |
| 불명 결과·후속 GET 실패 | 새 통합 Suite, 기존 변경/취소 Submit·상세 Suite | Network/5xx/계약 오류 이후 무재전송, GET으로만 복구, 성공 응답 보존, 취소 오류 후 새 GET/동의 |
| 본인 목록/Empty/Pagination | `pages/MyReservationsPage.test.tsx`, `api/reservationList.test.ts`, `components/reservation/ReservationList.test.tsx` | 소유자 Endpoint, 빈 목록, 허용 필터/정렬, URL 페이지/History, 개인정보 Projection, 401/403/404/Network/Loading |
| 없는/타인 예약·개인정보 | `pages/ReservationDetailPage.test.tsx`, 위 목록 Suite, `app/protectedRoutes.test.tsx` | 404/403, 인증 없는 요청 차단, 로그아웃/세션 변경/다른 예약의 늦은 응답 폐기 |
| 새로고침·뒤로/앞으로 | 새 통합 Suite, `test/SessionReload.test.ts`, 기존 목록/Booking navigation Suite | JS Module 재로드 Token/Role 미복원, 메모리 인증 상실 뒤 보호 상세 요청 없음, 변경/취소 동의 폐기, History 이동에서 POST/PATCH 무재전송 |
| f0.3 생성/탐색/인증 회귀 | `test/BookingCreationFlow.integration.test.tsx`, `test/AuthenticationFlow.integration.test.tsx`, 전체 기존 Suite | 공개 탐색/로그인 복귀/가용성 재검증/Booking Draft/생성·완료 경계 유지 |

새 Suite는 6건이다. 변경 거절 2건, 취소 정책 거절, 취소 응답 유실, 인증 상실 후 재마운트와
전체 성공/History를 검증한다. 409 Mock은 UI 처리 검증이며 실제 동시성 재현으로 주장하지 않는다.
새로고침은 Module 재로드와 인증 상실 뒤 Route 재마운트 검증이다. 실제 Browser Refresh를
자동 실행한 것으로 표현하지 않는다. 세부 수동 검수는 아래 절차와 f0.6.0 범위를 따른다.

## API / Type / State / Component 책임 정리

- `api/reservationContract.ts`: 반복되던 양의 안전 정수 ID/Path와 요청·응답 ID 일치 검증.
  소유권 검사로 대체하지 않으며 실제 JWT Principal/소유권은 Backend 책임이다.
- `api/reservation.ts`: 생성 Body/결과 및 완료 GET의 기본 Response Projection.
  `reservationList.ts`는 연락처를 제외한 Summary, `reservationDetail.ts`는 저장된 일별 가격·
  정책/취소 결과의 확장 타입/검증이다. 같은 Backend Response의 서로 다른 화면 Projection이므로
  무조건 하나의 큰 타입/Reader로 합치지 않는다. Query/Mutation Endpoint 계약도 분리한다.
- `reservationChange.ts`: 날짜 전용 Body와 불변 객실/인원/대표 투숙객/정책 유지 검증.
  `reservationCancellation.ts`: 저장 정책 조회 Projection과 **완료 응답** 타입을 구분한다.
  사전 견적 DTO/Request Body를 만들지 않았고 estimatedRefundAmount와 상세 refundAmount를 유지한다.
- `components/reservation/reservationFailure.ts`: 변경/취소에 중복되던 불명 결과 분류와
  HTTP 코드/메시지/필드 상세 표시. 취소의 오류 문구를 Submit JSX 밖으로 분리했다.
  코드 없는 HTTP 오류도 서버 메시지를 유지한다. 변경/취소의 잠금 정책은 합치지 않는다.
- `ReservationChangeAvailabilitySection`은 새 날짜 Draft/일반 가용성, Confirmation은 참고 가격·
  동의/제출이다. CancellationSection은 최신 저장 정책 GET/열기, Summary는 정책/결과 표시,
  Submit은 동의/PATCH/오류, Feedback은 실제 완료 응답 표시다.
- Page는 본인 GET·현재 카탈로그/화면 상태·성공 피드백·갱신을 소유한다. Auth State와
  예약 Draft/동의를 섞지 않고 URL/Storage에 투숙객/Token/결과를 저장하지 않는다.
  공용 Reservation Response Cache가 없으므로 상세/목록 재진입은 GET이다.
- 두 Submit의 Ref/AbortController/세션 버전 검증은 유지했다. 변경은 확실한 4xx 이후 입력을
  유지하며 취소는 모든 오류 뒤 새 GET/확인을 요구한다. 다른 잠금 정책을 큰 공통 Hook으로
  억지로 일반화하지 않았다. Client abort는 서버 rollback이 아니다.
- f0.3 `apiClient`, Auth/ProtectedRoute, `availabilityValidation`/`calendarDate`,
  `useAvailabilityForm`/`StayDateFields`, `bookingPrice`, `useDetailQuery`, Loading/Error/Empty,
  `money` 및 기존 스타일을 재사용한다. 생성 Booking UI를 변경 화면에 그대로 결합하지 않았다.
- 테스트의 생성 사용자 동작은 `test/bookingFlow.ts`로 옮겨 기존 Booking Suite와 신규
  Lifecycle Suite가 공유한다. 기존 테스트 사례 자체는 유지한다.

## 실행 결과 (2026-10-14)

Frontend: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build`
모두 성공. 전체 **57 files / 641 tests** 통과. #202까지의 635건을 유지하고 연결 검증 6건을 추가했다.
`pnpm install --frozen-lockfile --offline`도 Already up to date로 성공했고 lockfile은 변경되지 않았다.

기존 Backend 8개 Suite **62 tests 성공**. 새 Backend 테스트를 복제하지 않았다.

```powershell
cd backend
.\gradlew.bat test --rerun-tasks --tests '*BasicReservationMvpIntegrationTest' --tests '*ReservationIntegrationTest' --tests '*ReservationCancellationPolicyTest' --tests '*CancellationPolicySnapshotTest' --tests '*CancellationPolicySnapshotIntegrationTest' --tests '*AccommodationCancellationPolicyIntegrationTest' --tests '*AccommodationBookingPolicyIntegrationTest'
```

별도 H2 + Redis 7.4 Testcontainer의 실제 Spring Boot와 Vite로 로드한 실제 Frontend API/
React 정책·결과 Component를 연결해 **HTTP Mock 없는 전체 Lifecycle**을 확인했다.
Fixture는 테스트 회원/ADMIN·숙소/객실·3일 재고·Booking/Cancellation Policy만 준비하고
예약은 실제 로그인/Bearer와 POST로 생성했다. 개발 MySQL/Volume 및 .env는 사용/변경하지 않았다.

1. 로그인 → Empty 본인 목록 → 생성 POST: DAILY/DEFAULT 2박 200,000.02 → 완료/목록/상세 GET.
2. 같은 재고 생성 409 INVENTORY_005, 1박 변경 409 BOOKING_POLICY_005 이후 기존 Snapshot 유지.
3. 임시 ADMIN API로 현재 객실명/기본 가격/일별 가격/취소 정책만 변경: 기존 예약은 원 금액/
   저장 정책 유지, 이름은 현재 카탈로그로 조회. 이는 fixture 준비이지 Admin UI 구현이 아니다.
4. 새 기간은 공유 점유 날짜 때문에 일반 가용성에서 미포함. 실제 변경 PATCH는 성공해
   첫 숙박일 150,000.03 + 기본 가격 200,000.02 = **350,000.05**와 2일 Snapshot 재조회.
5. 현재 숙소 정책은 2일 무료지만 예약은 저장된 7일/30%/50% 정책 유지. 확인 GET의 사전 금액은
   null/미제공. 명시적 cancel PATCH는 저장 정책의 30% **105,000.02 / 예상 환불 245,000.03**
   HALF_UP 결과를 반환하며 실제 React 표시·상세 refundAmount/CANCELLED·필터 목록과 일치.
6. 재취소 409, CANCELLED 변경 409, 없는 예약 404, 다른 회원의 Empty 목록/본인 상세 403,
   로그아웃 후 상세 401 확인. 서버 종료 전 DB에서 예약 1건/CANCELLED, 확정 금액/취소 결과,
   3일 reservedQuantity 전부 0 확인. Checkout 날짜의 재고 행은 필요 없었다.

임시 서버/Redis를 종료했다. 토큰은 메모리에서만 사용하고 출력/Repository 저장하지 않았다.
이는 실제 Browser/Google OAuth2 E2E·MySQL HTTP·Kafka 후처리 검증은 아니다.
Backend 소스 변경이 없어 전체 Backend test/build는 이번에 재실행하지 않았다.

## CI와 Admin 인계

의존성·lockfile·환경변수·실행/Workflow 설정 변경은 없다. Frontend CI의 기존 frozen-lockfile
설치, lint/format/typecheck/test/build 순서를 그대로 사용한다. 새 테스트는 jsdom/HTTP Mock으로
Docker·Redis·DB·Google 없이 실행하며 임시 실제 HTTP Probe는 CI 필수 단계가 아니다.
Backend CI의 Redis 6380:6379/Testcontainers 계약도 변경하지 않았다.

기준 develop `4ade12c`의 [Frontend CI](https://github.com/K4RF/reservation-platform/actions/runs/38217579374)는
completed/success임을 확인했다. 이는 **#203 신규 커밋의 CI 성공이 아니다**.
요청 범위가 로컬 브랜치/커밋이므로 push/PR을 만들지 않았다. 신규 원격 CI는 push/PR 후 확인해야 한다.
로컬 Windows Node 24.14.0/pnpm 11.19.0과 CI Linux Node 24.19.0의 차이는 남아 있다.

f0.4는 **USER/ADMIN 모두 자기 예약만 관리**한다. ADMIN Token도 본인 이외 예약을
조회/변경/취소할 수 없다. `/admin`은 역할 접근 확인 안내일 뿐이다. 숙소/객실/가격/재고 관리와
전체 회원 예약 조회·관리, Dashboard는 f0.5.0이며 이번에 사용자 Module에 추가하지 않았다.
실제 환불/PG, 사전 Fee API, 서버 Mutation 멱등성·다중 Tab 보장, 최종 디자인/Responsive 검수는 별도 범위다.
기존 생성의 `bookingFailure.ts`는 503 INVENTORY_013을 직접 재시도 가능으로 분류한다.
Redis Lock의 unlock 실패도 같은 코드가 될 수 있어 Commit 이후 생성 불명 안전성은
루트 README에 기록된 후속 검토 사항이다. #203의 변경/취소 안전성 정리와 구분하며,
이번에는 생성 오류 정책을 변경하거나 실제 unlock 장애를 재현하지 않았다.

## 비파괴 수동 사용자 확인

**전용 폐기 가능한 예약/재고**로만 실제 생성/변경/취소를 검증한다. 기존 개발 예약을 임의로
변경하거나 DB/Volume을 삭제하지 않는다.

1. 로그인 → 가용 객실/DAILY·DEFAULT 확인 → 투숙객 입력 → 생성 → 완료 → 내 예약 → 상세.
2. 현재 카탈로그 이름과 저장 가격/정책을 구분한다. 날짜 오류, 빈 목록, 없는/타인 예약을 확인한다.
3. 새 날짜 조회에서 공유 점유로 객실이 없어도 안내만 표시되는지 확인하고 변경을 명시적으로 확정한다.
4. 저장된 일별 가격/총액 갱신, 정책·재고 오류 시 원 Snapshot 유지, Loading/중복 제출 차단을 확인한다.
5. 취소 전 저장 정책/사전 금액 미제공 확인 → 동의 → 명시적 취소 → 결과/상태/목록 GET 갱신.
6. 뒤로/앞으로 이동은 GET만 수행해야 한다. 새로고침은 메모리 인증 상실로 로그인해야 하고,
   재로그인 후 저장 상태를 새 GET으로 확인해야 한다. 이전 동의·성공 표시를 복원하지 않는다.
7. 폐기 가능한 환경에서 응답 유실을 재현하면 재전송 대신 상세 GET으로 확인한다.
   GET 실패도 조회만 재시도한다. 브라우저의 요청 중단은 서버 rollback이 아니다.
