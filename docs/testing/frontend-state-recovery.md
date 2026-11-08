# 프런트엔드 실패와 상태 복구 (#304)

## 재현

[격리 실행 준비](frontend-backend-integration.md) 후 루트에서
`node scripts/integration/run.mjs --recovery`를 실행한다. `--hold`와 마스킹 입력한
`INTEGRATION_FIXTURE_PASSWORD`는 브라우저 검증에만 사용한다. 테스트 계정·MySQL·Redis·Kafka·
Media 파일은 개발 Compose와 분리된다. 실제 Google, 결제, 운영 데이터는 사용하지 않는다.

| 오류·상황 | 실제 서버/격리 환경 | 화면 동작 및 회귀 |
| --- | --- | --- |
| 400 `COMMON_001` / 형식 오류 | 중첩 `representativeGuest.email` 필드 오류를 실제 POST로 확인. 형식 오류 `COMMON_002`는 [공통 계약](../api/error-response.md) 참조 | `BookingCreationFlow`: 입력 보존, 수정·확인 이후에만 명시적 재시도 |
| 401 / 403 | [인증](frontend-authentication-flow.md)·[관리 권한](frontend-admin-management-flow.md#격리-관리자-검증-303): 만료/무인증, 역할·소유권 거절 | `AuthenticationFlow`와 `client.test.ts`: 401 동시 읽기는 재발급 한 건을 공유, 읽기 재요청 최대 한 번. 로그아웃/새 세션 뒤 늦은 재발급으로 이전 세션이 복구되지 않음. 쓰기 미재전송 |
| 404 | [예약관리](frontend-reservation-management-flow.md#격리-예약관리-검증-302): 없는 예약, [관리 가격](frontend-admin-management-flow.md#격리-관리자-검증-303): 없는 Override PUT | 상세 404는 기존 내용·행동을 복원하지 않음. 예약 생성 404는 새 가용성 조회로 복귀. 가격 404에서 자동 POST 전환 없음 |
| 409 오래된 예약·가격·앨범 | 두 읽기가 동일한 가용성/기본가격을 본 뒤 한 쓰기만 저장. 뒤늦은 가격 POST `ROOM_PRICE_002`, 예약 POST `INVENTORY_005`, 취소 재요청 `RESERVATION_005`, 앨범 편집 `MEDIA_005`. 새로운 GET으로 가격·예약·점유·앨범 비교 | 생성 404/409에서 동일 POST 재제출을 막고 별도 가용성 GET과 객실 재선택 요구. 가격은 새 가격 GET으로 확인, 앨범은 강한 ETag의 새 GET과 명시적 검토. `AdminDailyPrice`·`MediaManager`의 쓰기 횟수 검증 재사용 |
| 5xx | Redis 락에 만료되는 잘못된 타입을 **격리 환경에서 주입**, 실제 서버 `503 INVENTORY_013` 수신. 예약/점유는 생성되지 않음 | 이 주입은 락 획득 전 실패만 증명한다. 해제 실패는 Commit 뒤일 수 있어 UI는 5xx를 결과 불명으로 잠그고 내 예약 조회로 안내 |
| Network / Timeout / 응답 유실 / 비정상 201 | 통제된 HTTP Mock. 실제 네트워크 단절 또는 Backend 500 강제 발생과 구분 | `BookingCreationFlow`: 실패 후 완료 이동·POST 재전송 금지. `ReservationManagementFlow`: 변경·취소 결과 유실 후 최신 owner GET으로 복구. `AdminManagementFlow`·`MediaManager`: 저장 결과 검토 전 쓰기 잠금 |
| 이미지 실패 | [관리 사진 검증](frontend-admin-management-flow.md#격리-관리자-검증-303)의 제거된 공개 URL 404·잘못된 이미지 400 | `CatalogImage`, `AccommodationList`, `routes.test.tsx`: 실패 대체 표현, 텍스트·입력·탐색 동작 보존 |
| 느린 응답 / Loading·Empty·Error / History | 지연·응답 순서는 기존 제어된 Mock과 아래 브라우저 확인을 구분 | `AccommodationDetailPage`, `RoomAvailabilitySection`, `AdminRoom`, `AdminDailyPrice`: 이전 경로·날짜·인원·대상이 현재 선택/가격/초안을 덮지 않음. Back/Forward·새로고침 후 보호 읽기는 현재 인증으로 재진입하며 쓰기를 재생하지 않음 |

## 실패 뒤 다음 행동

- 400은 실패 화면에 입력을 유지한다. 예약 생성 404/409는 투숙객 정보를 확인 화면에 남기되
  제출을 잠근다. 가용 객실 다시 조회를 누르면 기존 객실·예상가·투숙객 입력을 지우고 동일 일정/인원으로
  새 GET을 보낸다. 객실이 아직 가용하면 다시 선택하고 최신 요금과 최종 입력을 확인한 뒤 제출할 수 있다.
- 예약 생성의 결과 불명은 새 POST 전에 내 예약을 읽는다. 일정 변경·취소는 최신 본인 상세,
  가격은 최신 적용 가격, 재고는 새 Calendar, 사진은 새 관리 앨범과 강한 ETag가 기준이다.
  읽기 실패의 명시적 재시도와 쓰기 자동 반복은 별개다. 가격 PUT에는 If-Match가 없으므로
  중복 생성 거절이 모든 관리자 동시 수정에 대한 버전 제어를 뜻하지 않는다.
- 성공하면 실행기가 해당 격리 Compose 프로젝트/Volume 및 전용 파일만 제거한다. 실패하면
  같은 쓰기를 반복하지 말고 GET·필요한 범위의 읽기 전용 DB 조회로 확인한 뒤
  [실패 정리 절차](frontend-backend-integration.md)를 따른다. 증거에 비밀번호·토큰·투숙객 정보를 남기지 않는다.

## 실제 브라우저 확인

1. 출력된 객실/날짜의 관리 가격을 두 탭에서 열어 모두 DEFAULT를 확인한다. 첫 탭에서
   22,000을 생성하면 재조회가 DAILY를 표시한다. 둘째 탭의 23,000 생성은 `ROOM_PRICE_002`로
   거절되고 초안은 실패 화면에 남는다. 적용 가격을 다시 조회하면 저장값 22,000이 표시된다.
   새로고침은 로그인으로 이동했고 재로그인 후 같은 날짜의 저장값을 다시 읽었다.
2. 별도 회원 탭에서 같은 날짜의 객실을 선택하고 로그인 후 가용성을 다시 읽어 확인 화면을 연다.
   관리자 탭에서 그 날짜 재고를 CLOSED로 변경한다. 회원 탭의 기존 제출은
   `409 INVENTORY_009`로 거절되고, 확인 입력을 유지한 채 재제출이 잠긴다.
3. 가용 객실 다시 조회를 누르면 동일 날짜·인원의 빈 결과가 표시된다. Back/Forward에서
   이전 확인 화면이 복원되지 않았다. 격리 MySQL에서 가격 22,000, 총량 1·예약 0·CLOSED,
   해당 날짜의 예약 행 0건을 대조했다.

브라우저에서 본 상태·DB 결과는 실제 요청 횟수의 증거가 아니다. 요청 횟수와 타임아웃·
응답 유실은 위 Mock 테스트가 검증한다. 실기기·운영 네트워크·최종 시각 검수는 수행하지 않았다.
