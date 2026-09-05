# Basic Reservation MVP 통합 테스트 범위

## 목적

`BasicReservationMvpIntegrationTest`는 기능별 통합 테스트를 반복하지 않고 다음
사용자 흐름이 하나의 Spring Boot 애플리케이션과 데이터베이스 트랜잭션 안에서
연결되는지 검증한다.

```text
일반 사용자 회원가입·로그인
→ 관리자 로그인
→ 관리자 숙소·객실 등록
→ 테스트용 날짜별 객실 재고 준비
→ 일반 사용자 숙소·객실 조회
→ 일반 사용자 예약 생성·재고 차감·단건·목록 조회
→ 일정 변경 재고 조정
→ 예약 취소, CANCELLED 상태 및 재고 복구 확인
```

관리자 가입 API는 현재 구현 범위에 없으므로 공유 테스트 Fixture가 암호화된
관리자 계정을 테스트 데이터베이스에 생성한다. 일반 사용자는 실제 회원가입과
로그인 API를 거친다.

## 기존 테스트와의 역할 분리

| 검증 범위 | 담당 테스트 |
| --- | --- |
| 전체 MVP 성공 흐름의 연결 | `BasicReservationMvpIntegrationTest` |
| 회원가입 검증·중복 이메일 | `MemberSignUpIntegrationTest` |
| 로그인 실패 정규화·JWT 발급 | `LoginIntegrationTest` |
| 미인증 접근·역할 권한 | `SecurityIntegrationTest`, `AccommodationIntegrationTest`, `RoomIntegrationTest` |
| 숙소·객실 Validation, Not Found, Pagination | `AccommodationIntegrationTest`, `RoomIntegrationTest` |
| 예약 기간·날짜별 재고 검증, 재고 부족·타인 접근·재취소 | `ReservationIntegrationTest` |
| 예약 저장 실패 시 재고 Rollback | `ReservationInventoryRollbackIntegrationTest` |
| Google OAuth2 계정 연결 | `OAuth2MemberServiceIntegrationTest` |

위 실패 시나리오는 이미 기능별 테스트에서 더 좁고 명확하게 검증하므로 MVP
종단간 테스트에 같은 요청을 중복 추가하지 않는다.

## 데이터베이스와 격리 전략

- 테스트 설정은 기존 H2 MySQL 호환 모드와 `create-drop` Schema를 유지한다.
- 테스트 메서드는 `@Transactional`로 실행되어 생성 데이터가 자동 Rollback된다.
- 운영 코드와 동일한 Repository, Security Filter, Service, Controller를 로드한다.
- MySQL 고유 동작과 동시성 검증은 이 테스트의 목적이 아니다.

MySQL 제약조건은 별도의 Testcontainers 테스트가 담당합니다. MVP 테스트는 기능
연결을 빠르게 검증하는 H2 테스트로 유지하며, MySQL Lock·격리 수준은 이후
동시성 전용 Testcontainers 테스트에서 검증합니다.
