# f0.3.0 Accommodation Search → Booking 통합 검증 (#185)

## 검증 경계

현재 Source 기준 흐름은 공개 `/accommodations` 검색 → 숙소 상세 → 날짜/전체 인원 조회 →
가용 객실 선택 → 날짜별 적용 요금 조회 → 필요 시 로그인/선택 재검증 → 대표 투숙객 입력/확인 → 예약 생성 POST →
`/reservations/{id}/complete`의 본인 예약 GET입니다.

`frontend/src/test/BookingCreationFlow.integration.test.tsx`는 실제 AuthProvider, Router,
검색/상세/Booking 컴포넌트와 API Client를 함께 사용합니다. HTTP 응답만 Mock하며
존재하지 않는 Endpoint/Method는 실패하게 정의합니다. Component/Hook/API 자체를 Mock하지 않습니다.
이는 Backend/DB/Redis 동시성 통합 테스트나 실제 브라우저 E2E가 아닙니다.

## 커버리지와 기존 테스트 재사용

| 확인 영역 | 테스트 소스 (`frontend/src/` 기준) | 검증 내용 |
| --- | --- | --- |
| 전체 성공 흐름 | `test/BookingCreationFlow.integration.test.tsx` | 검색 URL 복원·페이지 이동·검색 카드→상세·객실·가용성·혼합 DAILY/DEFAULT·투숙객·POST·서버 완료 GET |
| History와 확정 결과 | 위 통합 테스트 | 상세 뒤로/앞으로 검색 조건 복원, 완료 replace 후 Booking Draft 제거, 완료 재방문은 GET만 수행 |
| 재고/동시성/정책 거절 | 위 통합 테스트 | `INVENTORY_005`, `INVENTORY_011`, `BOOKING_POLICY_005` 409 표시, 투숙객 유지, 자동 POST 재전송 없음 |
| Validation/Network/Loading | 위 통합 테스트 | 서버 필드 오류 유지·명시적 재시도, 불명 결과 잠금, 대기 중 클릭·수정 차단 |
| 예약 불가 객실 | 위 통합 테스트 | 일반 목록에 객실이 있어도 가용성 Empty이면 선택/가격/POST 차단 |
| 검색 조건/Empty/Error | `pages/AccommodationSearchPage.test.tsx`, `components/accommodation/searchQuery.test.ts` | 날짜쌍·순서·인원·가격·허용 Query·빈 목록·재시도·늦은 응답 |
| 검색 URL/Pagination | `pages/AccommodationSearchNavigation.test.tsx` | 페이지·크기·조건 변경·뒤로/앞으로·인증 후 재마운트 복원 |
| 가용성·선택 초기화 | `components/room/RoomAvailabilitySection.test.tsx`, `pages/BookingFlowNavigation.test.tsx` | 날짜/인원/숙소/페이지 변경·선택 해제·재조회 시 초기화, 상세 재진입의 Draft 폐기 |
| 가격 계약/계산 | `api/bookingPrice.test.ts`, `components/booking/BookingSummary.test.tsx`, `utils/money.test.ts` | 체크아웃 제외·윤년·동시 요청 제한·정확한 합산·부분 실패·취소·재시도 |
| Booking 입력/State | `components/booking/bookingState.test.ts`, `components/booking/BookingFlow.test.tsx` | 필수/길이/형식·Capacity·선택 일치·입력/확인/수정·조건 변경·재마운트 |
| 생성/완료 계약 | `api/reservation.test.ts`, `components/booking/BookingSubmit.test.tsx`, `pages/BookingCompletePage.test.tsx` | Body/Bearer·401 무재전송·불명 결과·늦은 응답·ID·권한·404·취소 상태 |
| 인증·새로고침 정책 | `app/protectedRoutes.test.tsx`, `test/AuthenticationFlow.integration.test.tsx`, `test/SessionReload.test.ts` | 로그인 복귀·USER/ADMIN 보호·만료·JS Module 재로드 시 Token/Role 미복원 |

중복된 개별 테스트 파일을 새로 만들지 않고 기존 Booking 통합 Suite를 확장했습니다.
새로고침 검증은 컴포넌트 재마운트와 JS Module 재로드 정책 검증이며 실제 브라우저 Refresh를
실행한 결과로 표현하지 않습니다. 409 Mock은 UI의 서버 충돌 응답 처리 검증이며 실제 Race 검증이 아닙니다.

## 최종 책임/타입 구조

- `api/accommodation.ts`: Backend 검색 Request와 숙소 Response 계약, 공용 Client 호출/응답 검증.
- `components/accommodation/searchQuery.ts`: URL Query 변환·검증. 제출 조건·페이지의 Source는 URL;
  Form 편집은 제출 전까지 별도 Draft입니다. 결과는 해당 Query/요청에만 귀속됩니다.
- `api/availabilityValidation.ts`: 필수 숙박 기간·양의 전체 인원 입력 안내.
  검색과 Booking의 동일한 달력 검증은 `utils/calendarDate.ts` 하나를 사용합니다.
- `api/room.ts`, `api/bookingPrice.ts`: 객실·가용성·날짜별 Backend 요금 조회. Frontend 재고 계산/
  자체 가격 fallback은 없습니다. 검색 기본 가격 Filter와 날짜별 예상 합계는 다른 개념입니다.
- `api/booking.ts`: 실제 예약 생성 Body 타입. 회원 ID·숙소 ID·예상 가격·API에 없는 필드를 추가하지 않습니다.
- `components/booking/bookingState.ts`: 선택 숙소/객실/기간/인원·대표 투숙객 Draft 및 input/review 전이.
  Auth State와 분리되고 Storage/URL에 개인정보를 저장하지 않습니다.
- `api/reservation.ts`: 실제 서버 ID/공개 번호·현재 상태·확정 금액의 Response Projection, POST/본인 GET.
  생성 응답과 완료 조회에 같은 Reader를 재사용하며 전송·인증·오류 정규화는 공유 `api/client.ts`/
  `api/errors.ts`에 유지합니다. 상이한 API 계약을 억지로 일반화하지 않았습니다.
- `pages/useDetailQuery.ts`, `LoadingState`, `ErrorState`, `RoomCard`: 기존 공통 조회/UI를 재사용합니다.
  검색은 URL별 응답/History 책임이 있으므로 단순 Detail Hook으로 바꾸지 않았습니다.
- `app/routePaths.ts`: 서버의 안전한 양의 정수 ID로 완료 URL을 만드는 `bookingCompletePath`.

## f0.4.0 인계 계약과 제한

Reservation Management는 서버의 `reservationId`로 본인 단건/목록을 조회하고
`reservationNumber`는 고객에게 보여주는 공개 식별자로 사용해야 합니다. 공개 번호 기반 GET API는
없습니다. 완료 화면은 현재 상태와 저장 금액을 GET으로 다시 읽으며 navigation state에 보관된
Guest/성공 표시를 신뢰하지 않습니다. 완료는 결제 완료가 아닙니다.

본인 목록, 일정 변경, 취소의 Frontend는 후속 범위입니다. 예상 가격은 서버 확정액을 대체하지 않으며
Backend 재고·정책·권한·동시성이 Source of Truth입니다. 비멱등 POST의 네트워크/응답 유실은
생성 불명 상태로 유지합니다. 새 탭/화면 재진입 중복 생성을 보장할 수 없으며 향후 서버 멱등성 계약이
필요합니다. JSON Number의 안전한 금액 범위를 넘는 경우 문자열 금액 계약도 후속 검토 대상입니다.

## 실행/실제 연동 확인

`frontend/`에서 기존 Frontend CI 명령을 사용합니다:

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
```

이번 작업은 의존성·환경변수·실행 설정·Workflow를 변경하지 않습니다. 로컬 동일 명령 통과와
원격 GitHub Actions Run 통과는 별개이며 새 브랜치 원격 CI는 push/PR 후 확인해야 합니다.
#195의 공개 정책·Empty 조사·추가 브라우저 검수·비파괴 데모 준비 절차는
[공개 탐색 문서](public-exploration-booking-flow.md)를 따릅니다. 전체 실제 로그인/예약 E2E와 HTTP Mock은 별개입니다.

수동 절차:

1. 기존 Compose MySQL/Redis/Kafka와 Backend, `pnpm dev`를 실행하고 테스트 계정으로 로그인합니다.
2. 테스트 숙소를 이름/기간/인원으로 검색하고 URL·Pagination·뒤로/앞으로 조건 복원을 확인합니다.
3. 상세 일반 객실 목록과 별개로 날짜/인원을 제출하고 Backend 가용 객실만 선택합니다.
4. Network의 각 `[check-in, check-out)` 가격 GET과 DAILY/DEFAULT 표시·예상 합계를 확인합니다.
5. 투숙객 입력/확인 후 POST 201, 응답 ID/공개 번호와 완료 GET 200을 확인합니다.
6. 서버 본인 예약 조회로 날짜·인원·최종 금액을 확인하고 재고 차감은 Backend에서 확인합니다.
7. 재고 없는 기간·정책 위반과 브라우저 재진입/새로고침도 확인합니다. 불명 POST는 재전송 전
   서버 본인 예약 기록을 조회합니다.

실제 예약은 데이터를 변경하므로 별도의 테스트 계정/객실을 사용하고 개발 DB/Volume을 삭제하지
않습니다. 자동 Frontend 검증은 개발 DB를 사용하거나 변경하지 않습니다.
