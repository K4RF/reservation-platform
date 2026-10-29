# ADMIN Media #273 검증 기록

2026-10-29. develop `9357571`(PR #286) pull 후 병합된 **로컬** #272 브랜치를 삭제하고
`feature/#273-admin-media-management`를 생성했다. 원격 브랜치 삭제/push/PR은 이번 요청에서 실행하지 않았다.
[관리 API·입력 예시](../architecture/media-management.md), [ADR-008](../adr/008-media-file-lifecycle.md),
[정리 테이블 업그레이드 SQL](../erd/mysql-media-file-cleanup-upgrade.sql)을 함께 읽는다.

## 실행과 검증 범위

`backend/`에서 checked-in Gradle Wrapper와 Java21을 사용했다.

```powershell
.\gradlew.bat compileJava
.\gradlew.bat test --tests '*ImageUploadValidatorTest' --tests '*MediaManagementIntegrationTest'
.\gradlew.bat test --tests '*MediaManagementMySqlIntegrationTest'
.\gradlew.bat test --tests '*MediaManagement*Test' --tests '*ImageUploadValidatorTest'
.\gradlew.bat test --tests '*MediaManagementIntegrationTest' --tests '*GlobalException*' --tests '*OpenApiIntegrationTest'
.\gradlew.bat test build
```

개발 Compose DB/Volume·실제 계정/Token·시설 사진을 변경하지 않았다.
파일은 `Files.createTempDirectory`의 자기 경로만 사용하고 종료 시 정리한다.
입력 이미지 `MediaUploadFixture`는 BufferedImage로 직접 만든 합성 픽셀이며 실매물 사진이 아니다.
기존 #272·권한·예약·가격·재고·Redis/Kafka Suite를 삭제/비활성화하거나 중복 Lifecycle Suite를 만들지 않았다.

| Suite | 실제 검증 |
| --- | --- |
| ImageUploadValidatorTest | JPEG/PNG 실제 decode, filename/MIME 비신뢰, 빈/가짜/GIF/10MiB 초과/8192px 초과/16M픽셀 초과 거부, 재인코딩 후 trailing script 미보존 |
| MediaManagementIntegrationTest | H2+실제 임시 파일+MockMvc. ADMIN/USER/익명, 숙소/객실 분리·소속404, upload→metadata→대표→전체 순서→새 ID 교체→삭제/공개404, ETag/오래된 제출409, 20장 제한 |
| 같은 Suite의 입력/OpenAPI | 필수 metadata400, file part 누락/잘못된 part Content-Type은 COMMON_002, OpenAPI Bearer/JSON 오류 schema/실제201/metadata part application/json |
| 같은 Suite의 주입 실패 | Storage write 실패503/DB 변경 없음, 파일 저장 후 Repository 실패500/파일 보정, 교체 실패 시 원래 ID/ETag/파일 보존, 삭제 commit 후 물리 정리 실패는 intent 유지/재시도 |
| 같은 Suite의 복구 상태 재현 | 예약 intent+파일만 남긴 상태를 만들고 cleaner 실행, 삭제 IO 실패/attempts 증가/다음 시도 성공. 실제 JVM 강제 종료/재시작 실험은 아님 |
| MediaManagementMySqlIntegrationTest | **실제 TCP HTTP 서버(127.0.0.1 random port)** + MySQL8.4/Redis7.4 Testcontainers + 실제 임시 파일. 업로드/metadata/PUT multipart 교체/삭제/공개 파일, Warm Redis owner detail 무효화와 Room 분리 |
| 같은 Suite의 MySQL 경합 | 동일 revision에서 서로 다른 대표 지정2건→성공1/409 MEDIA_005 하나. intent 잠금 중 cleaner 대기→commit 후 살아 있는 파일 보존. 이미 참조된 파일에 남은 정리 intent도 파일을 지우지 않음 |
| 같은 Suite의 실행 설정/DDL | cleanup scheduler 켜짐(테스트 간격1시간), 비활성 Kafka Outbox scheduler는 생성되지 않음. 실제 Servlet10MB 초과400 MEDIA_003. 새 SQL을 별도 격리 테이블에 적용 후 제거 |

MockMvc는 Controller/DB/파일 코드를 실제 호출하지만 네트워크 Browser 검증이 아니다.
별도 MySQL Suite의 JDK HttpClient 요청은 Mock이 아니며 실제 HTTP multipart를 사용했다.
다만 ADMIN JWT는 기존 JwtTokenProvider로 발급한 **테스트 fixture**다. 실제 이메일 로그인/Google Browser
인증을 새로 검증했다고 주장하지 않는다. 실제 시설 사진/권리 확인/Frontend Gallery도 별도다.

## 확인된 결함과 수정

초기 MySQL in-flight cleanup 테스트에서 `CannotAcquireLockException`/deadlock이 재현됐다.
Cleaner가 due-time secondary index를 잠근 뒤 PK를 기다리고, uploader가 PK를 가진 채
삭제/commit의 secondary index를 기다리던 순서 문제였다.

만기 후보 비잠금 조회→정렬된 PK 단위 잠금으로 바꿨고, 잠금 뒤 현재 DB 참조를 읽도록
cleaner의 트랜잭션을 READ_COMMITTED로 명시했다. 만기/행 존재도 잠금 후 재확인한다.
문제가 난 검사를 지우거나 자동 retry로 덮지 않고 같은 경합 테스트의 통과를 확인했다.

## GitHub Actions 검토

- JDK21/Wrapper9.5.1, 기존 Redis7.4 `6380:6379`, Ubuntu Docker 가능한 runner의
  `./gradlew test`와 `./gradlew build -x test` 구성을 확인했다.
- 의존성/Wrapper/CI service/Secret 추가 없음. ImageIO/BufferedImage는 JDK의 headless 처리이며 새 GUI 서비스가 필요하지 않다.
- 새 Media 설정은 기본값이 있다. 실제 Storage 경로는 테스트의 temp root로 대체하고,
  테스트 기본에서는 cleanup timer를 끈다. 실제 scheduler 등록 테스트만1시간 간격으로 켠다.
- 새 SQL은 `../docs/erd`에서 읽으므로 일반 checkout에 포함되며 개발 DB에 적용하지 않는다.
- 로컬 Windows/Oracle JDK 검증이지 원격 Ubuntu/Temurin Actions 실행 결과는 아니다.
  push/원격 CI·실제 운영 파일 권한/공유 mount·프로세스 강제 kill 복구·Frontend 전체 회귀는 미실행이다.

## 남은 범위

- #276 Frontend API client의 쓰기 replay 금지/불명 결과 잠금·신선한 ADMIN GET 후 명시적 재검토 UI.
- WebP 업로드 decoder/다중 rendition·CDN·총 quota/운영 모니터링·사용권 자동 검증.
- DB/파일/Redis 원자성, 영속 요청 멱등성/ABA 이력, 모든 in-flight cache fill과 eviction 선형화는 제공하지 않는다.
- 공유 DB를 쓰는 인스턴스는 같은 Media 디스크가 필요하다. DB/root 복구 시점을 검토하고 cleaner를 켠다.
- f0.6.0 사용자 시각/반응형/접근성 최종 승인과 실제 시설 사진 연결은 이 Backend 이슈 완료와 구분한다.

## 최종 결과

- 최종 `gradlew.bat test build`: **BUILD SUCCESSFUL (2m10s)**.
- XML 합계 **73 suites / 354 tests / failures0 / errors0 / skipped0**.
- 관련 이미지/관리/실제 HTTP·MySQL/Redis·입력/Swagger Suite도 개별 재실행 통과.
- 변경 문서9개의 로컬 링크125개와 `git diff --check` 확인 통과.
- Backend build 파일/외부 의존성/CI 서비스/필수 Secret은 변경하지 않았다. Frontend 소스/빌드는 이번 Backend 작업에서 변경·실행하지 않았다.
- 테스트 생성물·사진·실제 비밀값은 커밋하지 않는다. 개발 DB 업그레이드와 원격 CI는 미실행이다.
