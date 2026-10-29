# Catalog Media #272 검증 기록

검증일: 2026-10-29. develop `f37566c`(PR #285)에서
`feature/#272-catalog-media-read` 생성. 병합된 로컬 #271 브랜치는 삭제했고 원격 브랜치는 변경하지 않았다.
요청 범위는 Backend Media 모델·읽기이며 #273 업로드/관리 UI·#276 Frontend 사진 연결은 구현하지 않았다.
[계약/실행 설정](../architecture/catalog-media.md), [ADR-007](../adr/007-catalog-media-local-storage.md),
[일회성 SQL](../erd/mysql-catalog-media-upgrade.sql)을 함께 본다.

## 구현 경계

- 기존 숙소/객실/가용 객실 응답에 대표/이미지 배열을 추가, page-batched window SQL로 반환량 제한.
- `GET /api/v1/media/{id}/content` 공개 읽기와 임시/로컬 파일 크기·경로 검증.
- 상세 캐시 v2 prefix·Media JSON·transaction-aware eviction hook. Search bypass 유지.
- 입력 권한/업로드 decode/파일 commit 정리/자동 eviction 연결은 후속 #273.
  #272 Repository 변경만으로 캐시가 자동 갱신된다고 보고하지 않는다.

## 실행 환경·명령

Windows 11 / Java21.0.12 / Gradle Wrapper9.5.1 / Docker Engine29.7.2.
테스트 설정의 H2 및 기존 MySQL8.4/Redis7.4 Testcontainers를 사용했다.
실제 개발 Compose MySQL DB/Volume이나 실제 사진/사용자 계정을 변경하지 않았다.
파일 테스트는 `Files.createTempDirectory`로 만든 자기 임시 경로만 사용·정리했다.

`backend/`에서:

```powershell
.\gradlew.bat test --tests '*CatalogMediaTest' --tests '*CatalogMediaIntegrationTest'
.\gradlew.bat test --tests '*CatalogMedia*Test' --tests '*MediaContentIntegrationTest' --tests '*RedisDetailCacheIntegrationTest' --tests '*RedisCacheInvalidationIntegrationTest'
.\gradlew.bat test --tests '*DatabaseConstraintIntegrationTest' --tests '*ReadApiQueryPerformanceBaselineIntegrationTest' --tests '*CacheReadPerformanceComparisonIntegrationTest'
.\gradlew.bat test build
```

초기 카탈로그 검증에는 기존 AccommodationIntegrationTest/RoomIntegrationTest/AvailableRoomIntegrationTest도 실행했다.
`frontend/`의 기존 API 소비자 회귀는 아래 **2 files / 23 tests 통과**다. 새 Media UI 검증이 아니다.

```powershell
pnpm test src/api/accommodation.test.ts src/api/room.test.ts
```

## 검증 내용

| 테스트 | 실제로 확인한 범위 |
| --- | --- |
| CatalogMediaTest | 소유/필수 metadata·권리·UUID key/경로 거부·수량/크기 범위 |
| CatalogMediaIntegrationTest | H2/실제 Service·MockMvc: 공개 detail/list/available, owner 분리, 대표·동률·삭제/재정렬, Gallery20/목록1, legacy null/empty, OpenAPI |
| 같은 Suite의 SQL 통계 | 여러 owner의 Media 반환을 한 SQL로 처리, 빈 ID 목록은0 SQL. metadata는 반환하지만 bytes/내부 rights/key는 JSON 미노출 |
| MediaContentIntegrationTest | H2+실제 임시 디스크+MockMvc: PNG bytes/Content-Type/no-store/nosniff, DB 삭제·파일 없음/크기 불일치404, 잘못된 ID400, 미인증 쓰기401 |
| CatalogMediaMySqlIntegrationTest | 실제 MySQL8.4: window SQL/상한/동률·Room 매핑, XOR/FK/UNIQUE/정렬·크기·필수 CHECK. SQL 스크립트를 별도 test table에 적용 후 제거 |
| 기존 RedisDetailCacheIntegrationTest 확장 | Redis7.4 typed JSON roundtrip/Media 포함 Warm hit0 SQL, 구 prefix의 불완전 JSON과 격리, Search는 warm detail과 무관하게 DB Media 조회. 기존 TTL/coalescing/수정 회귀 유지 |
| 기존 RedisCacheInvalidationIntegrationTest 확장 | 트랜잭션 안 hook은 commit 후에만 숙소/객실 캐시 제거, rollback은 원래 snapshot 유지 |
| 기존 Controller·Security·전체 Suite | catalog ADMIN 쓰기/공개 GET, 예약·Auth·Redis/Kafka 등 기존 동작 회귀 |

## 발견·보정한 테스트 기준

1. MySQL CHECK 위반은 정상 차단됐으나 JdbcTemplate이 `HY000/3819`를
   UncategorizedSQLException으로 전달했다. Spring 예외 하위 타입을 단정하는 대신 실제3819/FK1452를 확인했다.
2. 첫 전체 실행은 **340 tests / 3 failed**였다. Media 조회 추가에 따른 성능 기준2건과
   MySQL EXPLAIN의 join order 고정1건이며 ApplicationContext 실패가 아니다.
3. 기존 Query baseline은 Search4→5, 숙소 상세2→3, Room 목록4→5, 가용 목록5→6이다.
   각 경로에 `catalog_media` SQL이 **정확히1개**임을 추가로 검사하고 편의시설 collection fetch 기준은 유지했다.
   적용 가격2 / Redis Warm0은 그대로, Cold 비교 기준만2→3으로 갱신했다.
4. 실제 EXPLAIN은 숙소 scan→`idx_rooms_accommodation_status_id` lookup→재고 UNIQUE index를 선택했다.
   기존 Room scan→숙소 PRIMARY lookup 경로와 이 유효한 대안을 모두 검증하되
   `uk_room_inventories_room_date` 사용 검사는 유지했다. 쿼리/인덱스를 임의로 바꾸거나 테스트를 비활성화하지 않았다.

보정한 관련 Suite 재실행은 통과했다. 최종 전체 test/build 결과는 아래 인계 결과에 기록한다.

## CI·실제 연동·미검증 경계

- `.github/workflows/backend-ci.yml`은 JDK21, Redis7.4 `6380:6379`, Docker 가능한 Ubuntu에서
  Wrapper `test`, `build -x test`를 실행한다. MySQL/추가 Redis는 기존 Testcontainers가 공급한다.
- 의존성/Wrapper/lockfile/CI service 변경은 없다. 새 설정은 기본값이 있어 CI Secret/디렉터리 생성이 필요 없다.
  실제 파일 테스트는 DynamicPropertySource의 temp root를 사용하고 `../docs/erd` 경로는 checkout에 포함된다.
- 로컬은 CI와 같은 Wrapper/test 자원을 사용했지만 OS/JDK 배포판까지 동일하지 않고 **원격 Actions는 미실행**이다.
- MockMvc는 실제 Controller/DB/파일 코드를 호출하지만 실제 TCP/Browser HTTP 업로드가 아니다.
  MySQL/Redis Testcontainers는 실제 서버이며 개발 Compose DB를 대체한 격리 자원이다.
- 실제 시설 사진 업로드/ADMIN→공개 읽기 수명주기/Browser Gallery·사진 실패 시 UI/운영 디스크 권한·quota·CDN 성능은
  #273/#276/#284에서 검증해야 한다. f0.6.0 사용자 최종 승인도 별도다.

## 최종 인계 결과

- 최종 `gradlew.bat test build`: **BUILD SUCCESSFUL (2m25s)**.
  XML 집계 **70 suites / 340 tests / failures0 / errors0 / skipped0**.
- 관련 Media/기존 catalog·캐시·DB/성능 Suite와 Frontend API23건을 실행했다.
- `git diff --check` 및 변경 문서8개의 로컬 링크106개 확인 통과.
  생성물/실제 파일/비밀값은 추가하지 않았다. 개발 DB SQL 업그레이드는 실행하지 않았다.
- CI 명령/설정은 검토했지만 push/원격 Actions/실제 업로드·Browser E2E는 실행하지 않았다.
