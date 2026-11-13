# v0.4.1 Catalog·Media·예약 정책 회귀 검증 (#330)

[#272 Media 읽기](../architecture/catalog-media.md)·[#273 Media 관리](../architecture/media-management.md)에
[#328 객실 메타데이터](../architecture/room-metadata.md)와 [#329 예약 정책 GET](../architecture/accommodation-booking-policy.md)이
함께 동작하는지 확인한다. 제품 코드, API 계약, DB DDL은 변경하지 않았다.

| 확인 범위 | 검증 경계와 근거 |
| --- | --- |
| 객실 등록·수정·권한 | `RoomIntegrationTest`: 메타데이터 미입력/부분 입력, PUT 생략·null 보존/객체 교체/빈 객체 삭제, 상세·목록 차이, 잘못된 입력과 ADMIN 제한. 실제 HTTP 스모크는 신규 객실 등록과 상세/목록/가용 응답을 확인한다. |
| 예약 정책 GET | `AccommodationBookingPolicyIntegrationTest`, `OpenApiIntegrationTest`: 저장값 `200`, 미설정 `204`, 없는 숙소 `404`, 잘못된 ID `400`, 공개 GET과 ADMIN POST/PUT. 격리 HTTP에서 등록·수정 커밋 직후 값을 익명·USER·ADMIN으로 확인한다. |
| 사진·캐시 | `CatalogMediaMySqlIntegrationTest`, `MediaManagementMySqlIntegrationTest`: 소유자별 대표·정렬·파일 응답과 ADMIN 수정/교체/삭제를 재검증한다. 기존 HTTP 여정에서 사진 업로드와 객실 정보 PUT 각각의 커밋 뒤 Redis v3 키가 지워지고 다음 상세에 사진과 메타데이터가 함께 들어오는지 확인한다. `RedisCacheInvalidationIntegrationTest`가 v2 Room 키 무시, 구 JSON의 메타데이터 생략, 커밋/롤백을 확인한다. |
| 검색·가용성·예약 | `BookingPolicyCatalogBaselineIntegrationTest`: MySQL과 고정 시계(도쿄/뉴욕)에서 검색·재고·가격·예약 생성/변경/취소를 확인한다. 정책 GET이 2–3박을 반환할 때 4박 변경이 재고·기존 예약을 건드리지 않고 거절되고, 4–5박으로 바꾸면 최소 경계인 4박 변경이 허용된다. 현재 정책을 다시 5박으로 제한해도 기존 예약은 저장된 취소 정책 스냅샷의 30%를 적용해 취소되고 재고가 복구된다. |
| 신규 DB·업그레이드 | `RoomMetadataMySqlIntegrationTest`: MySQL 8.4 신규 JPA 스키마의 nullable 매핑·CHECK, 기존 객실 형태의 격리 테이블에 [업그레이드 SQL](../erd/mysql-room-metadata-upgrade.sql)의 동일 DDL을 적용해 기존 행·인덱스 보존/NULL/CHECK를 확인한다. Media·cleanup 업그레이드 SQL도 별도 격리 테이블에서 확인한다. 예약 정책 GET은 기존 테이블을 사용하며 새 SQL이 필요 없다. 운영 DB 복제본이나 운영 전환은 검증하지 않았다. |

## 재현

백엔드 전체 검증은 `backend`에서 `./gradlew build`(Windows: `.\gradlew.bat build`)를 실행한다.
MySQL·Redis Testcontainers와 일부 테스트용 Redis `localhost:6380`이 필요하다.
Backend CI도 PR의 대상 커밋에서 동일 Wrapper의 `test`, `build -x test`를 실행한다.

실제 HTTP는 [격리 실행 안내](frontend-backend-integration.md)에 따라 Boot JAR와 Vite 의존성을 준비한 뒤,
저장소 루트에서 실행한다.

```sh
node scripts/integration/run.mjs --booking --management --admin
```

별도 MySQL 8.4, Redis 7.4, Kafka 4.3.1, 임시 Media 디렉터리와 합성 계정을 사용한다.
성공 시 이 실행의 리소스만 정리하며, 개발 Compose DB·Volume·Media는 건드리지 않는다.
Vite 프록시를 통과한 HTTP 검증이며 브라우저 UI나 실제 OAuth는 이 명령으로 검증하지 않는다.

## 실행 기록

- 격리 HTTP 기본 스모크와 `--booking --management --admin`을 한 실행에서 통과했다.
  정책 최신값·객실 상세/목록 응답 외에도 마지막 재고 예약 충돌, 일정 변경/취소 및 수수료·환불·재고,
  숙소·객실 앨범의 ETag/대표/교체/삭제와 파일 정리, Kafka Outbox/Consumer 기록을 확인했다.
  Windows 예약 포트와 충돌해 이 실행에만 `INTEGRATION_MYSQL_PORT=54399`를 사용했다.
- 원격 CI 결과는 #330을 닫는 PR의 Checks에서 커밋별로 확인한다. 격리 HTTP 스모크는 Actions가 아닌 로컬에서 실행한다.

## 완료 범위와 남은 항목

- v0.4.1의 Backend Media 모델·관리/파일 수명주기, 선택 객실 메타데이터, 공개 예약 정책 읽기와
  회귀 범위를 확인한다. API 응답·상태·권한은 위 계약 문서, 스키마/적용 조건은 [ERD](../erd/database-schema.md)에 정리되어 있다.
- 프론트엔드는 Media를 사용하고 기존 객실 PUT을 계속 보낼 수 있지만, 상세의 객실 메타데이터 표시,
  ADMIN 메타데이터 편집, 고객 상세/ADMIN 예약 정책 GET 연동은 남아 있다. 미입력 값을 추정하지 않고,
  정책 미설정 `204`는 없는 숙소 `404`와 구분한다. 읽은 정책으로 재고나 예약 확정을 보장하지 않는다.
- 현재 숙소 취소 정책을 직접 읽는 API는 없으며, 예약 상세/취소에서 읽는 것은 예약 시 저장한 스냅샷이다.
  새 취소 정책 조회, 운영 DB 적용·백업 복원, 운영 Media 비용·용량 검증, 브라우저 최종 승인은 이번 검증 범위 밖이다.
