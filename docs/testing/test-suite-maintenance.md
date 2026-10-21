# 테스트 정리 기록

2026-10-21, 기준 커밋 `905e056`에서 Backend/Frontend 테스트 목록과 초기 Smoke·Route
테스트를 현재 구현 및 후속 검증과 비교했다. 작성 시점만으로 삭제하지 않고, 빈 Smoke가
실제 통합 검증으로 대체됐거나 같은 조건·검증을 다른 Suite가 이미 수행하는 항목만 정리했다.

## 제거·이관과 남는 검증

아래 경로는 Backend의 `src/test/java/junsik/reservation/`, Frontend의 `src/` 기준이다.

| 정리 대상 | 이유와 남는 검증 |
| --- | --- |
| Backend `BackendApplicationTests.java` 전체 (1 test) | 빈 `contextLoads`만 있었다. 실제 전체 Spring Context를 로딩하는 `config/OpenApiIntegrationTest`, `controller/MemberSignUpIntegrationTest`, `security/SecurityIntegrationTest` 등이 Context 초기화와 실제 응답을 검증한다. 이 Suite들의 RedissonClient는 Mock이 아니다. |
| Backend `security/SecurityIntegrationTest`의 공개 회원가입 입력 오류 (1 test) | 같은 무인증 POST·invalid-email/short·400/COMMON_001을 `controller/MemberSignUpIntegrationTest.rejectsInvalidEmailAndShortPassword`가 검증하고 Field 오류 및 저장 없음까지 확인한다. JWT·401/403·역할 검증은 유지한다. |
| Frontend `app/protectedRoutes.test.tsx`의 익명 Admin 진입 2건·USER 거절 2건·알 수 없는 역할 1건 | `app/adminRoutes.test.tsx`가 같은 `/admin`, `/admin/rooms`를 포함한 경로 행렬에서 Login/Forbidden·Header·Admin Layout 부재·요청 없음까지 검증한다. 알 수 없는 역할의 Header 부재 검증도 그 Suite에 남긴다. 회원 영역·Header active 상태·복귀·재발급 검증은 유지한다. |
| Frontend `app/accommodationRoutes.test.tsx`의 회원 검색→상세 이동 (1 test) | `test/BookingCreationFlow.integration.test.tsx`의 로그인된 검색/페이지→상세/객실→예약→완료 Flow가 같은 이동을 포함한다. 기존 숙소 h1 검증을 그 Flow Helper에 유지한다. 익명의 검색/상세 직접 진입·토큰 미전송 2건은 남긴다. |
| Frontend 같은 파일의 로그인 복귀 경로 단위 검증 (이관) | 3개 입력에 대한 기존 assertion을 `app/loginReturn.test.ts`의 allowed/rejected 데이터 행렬로 옮겼다. 안전한 경로·외부 URL·접두사 유사 경로 거절은 삭제하지 않았다. |

Backend 실행 테스트는 2건 감소한다. Frontend는 중복 6건을 제거하고 한 테스트의
3개 assertion을 전용 Suite의 개별 입력 case로 이관해 전체 실행 수가 **984 → 980**이 된다.
테스트 수 감소는 목적이 아니며 Code Coverage 백분율을 측정한 것은 아니다.

## 유지한 범위와 한계

- 초기 Unit/Validation/공통 UI/Route 테스트도 현재 계약을 독립적으로 검증하면 유지한다.
- 동시성 No-lock/Pessimistic Baseline·낙관 Lock/Retry·Redisson·Query/Cache 비교는
  설계 선택의 재현 근거다. 과거 전략이라는 이유로 삭제하지 않는다.
- H2 API 검증·MySQL 제약/트랜잭션/동시성·Redis·Embedded Kafka·Frontend HTTP Mock Flow는
  서로 다른 경계다. 이름/결과가 비슷하다는 이유로 하나로 대체하지 않는다.
- 네 가지 Frontend 통합 Flow와 세부 Component/API/세션 회귀 Suite를 유지한다.
- 테스트 실패를 숨기기 위한 disable/skip, CI 제외 규칙, 실행/의존성 변경은 없다.
- 전체 목록 검토와 위 후보 비교를 수행했으며 모든 assertion에 대한 형식적 중복 증명,
  Mutation Testing 또는 미사용 테스트 전수 판정을 한 것은 아니다.

삭제한 소스는 기준 커밋의 Git 이력에서 복구할 수 있다. 개발 MySQL 데이터나 Docker Volume은
삭제·초기화하지 않는다. 테스트용 MySQL/Redis는 기존 Testcontainers 격리 방식을 유지한다.

## 검증 결과

- Backend: 설치된 JDK 21.0.12와 Gradle Wrapper를 사용했다.
  `compileTestJava` 성공, 변경과 직접 관련된 `SecurityIntegrationTest`,
  `MemberSignUpIntegrationTest`, `OpenApiIntegrationTest`의 **13 tests** 통과.
- `backend/`에서 `.\gradlew.bat test --max-workers=2`: **66 suites / 329 tests**, failures/errors/skipped 0.
  MySQL/Redis Testcontainers와 Embedded Kafka를 포함한 전체 Task가 성공했다.
- `backend/`에서 `.\gradlew.bat build --max-workers=2`: 성공. 직전에 전체 테스트를 실행했고,
  build의 test Task는 UP-TO-DATE였다.
- Frontend: `pnpm test` **71 files / 980 tests** 통과.
  `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm build`도 성공.
- Backend 검증을 위해 꺼져 있던 Docker Desktop을 실행했다. 기존 기본 테스트 설정의
  Redis 6380 연결은 `redis-cli ping`으로 PONG을 확인했다. 개발 Compose MySQL/Volume을
  테스트 DB로 바꾸거나 삭제하지 않았다.
- CI Workflow·의존성·실행 설정은 변경하지 않았고, 이번 변경의 원격 CI는 실행하지 않았다.
