# ADMIN Media 관리·파일 수명주기 (#273)

2026-10-29. 선행 [#272 읽기 계약](catalog-media.md), [#271 화면 명세](../ui/prototype-rebuild.md).
현재 Backend는 업로드/metadata/대표/정렬/교체/삭제를 제공한다. Frontend 관리 Form/사진/Gallery는
#276 후속이며 Room Metadata/정책 GET/숙소·객실 삭제 기능은 추가하지 않았다.
이슈 본문의 “DTO에 이미지가 없음”은 선행 구현 전 설명이다. 현재 소스에는 #272 Media 필드가 있다.

## 1. API와 재조회 계약

모두 ADMIN만 접근한다. 소유자 존재와 해당 Media의 소속을 서버에서 검증한다.
숙소·객실은 각각 독립된 album이고 INACTIVE도 사진 관리는 가능하다(예약 가능 여부와 무관).

`BASE`는 다음 둘 중 하나다.

- `/api/v1/accommodations/{ownerId}/media`
- `/api/v1/rooms/{ownerId}/media`

| Method / 경로 | 입력 | 결과 |
| --- | --- | --- |
| GET `BASE` | 없음 | DB 직접 관리 목록, ETag, Cache-Control:no-store |
| POST `BASE` | multipart `file` + JSON `metadata` | 201, 끝에 추가된 album |
| PUT `BASE/{mediaId}` | JSON metadata | 200, alt/출처/권리 수정 |
| PATCH `BASE/{mediaId}/representative` | body 없음 | 200, 해당 이미지를 첫 순서로 이동 |
| PUT `BASE/order` | `{"mediaIds":[현재 ID 전체를 원하는 순서대로]}` | 200, 첫 ID가 대표. 누락/중복/외부 ID 거부 |
| PUT `BASE/{mediaId}/content` | multipart `file` + JSON `metadata` | 200, 같은 위치에 **새 Media ID/URL**로 교체 |
| DELETE `BASE/{mediaId}` | body 없음 | 200, 삭제 후 album. 삭제된 ID의 공개 content GET은404 |
| POST `/api/v1/admin/media/cleanup` | `{"acknowledged":true}` | 만기 정리 후보 최대20개에 대한 `completed`/`failed` 집계 |

각 album 응답은 `{ownerType, ownerId, revision, images}`이고 images 원소는
`{image: MediaResponse, source, rightsRecord}`다. 키/실제 파일 경로를 반환하지 않는다.
최대20장, `(sortOrder,id)` 정렬, 첫 이미지가 대표이며 쓰기 후 순서는0부터 연속으로 정규화한다.
20장 초과 수동 legacy 데이터가 있으면 관리 API는409로 거부한다. 전체 목록을 검토해 별도 보정해야 하며
조회에서 숨겨진 행을 임의로 지우거나 사진/권리를 추측해 채우지 않는다.

모든 album 쓰기는 **관리 GET 응답의 따옴표 포함 ETag를 `If-Match`로 전달**해야 한다.
형식 오류는400 `MEDIA_007`(헤더 누락은 공통 요청 오류), 불일치는409 `MEDIA_005`다.
Revision은 owner·정렬·ID·metadata의 SHA-256 fingerprint이지 영속 증가 Version이나 요청 멱등성 키가 아니다.
현재 표현이 동일해지는 ABA를 구별하는 revision history/중복 요청 ledger는 구현하지 않았다.

소유자 row의 MySQL pessimistic lock 안에서 최신 album과 fingerprint를 다시 확인한다.
빈 album의 동시 업로드·20장 제한·대표/정렬/교체도 같은 잠금에 참여한다.
이는 Media 관리 전용이며 예약 생성의 Redis/Optimistic Lock 전략을 변경하지 않는다.

### 불명확한 쓰기 결과와 Client

- 업로드/수정/삭제/대표/정렬/교체/정리 POST를 **401 포함 자동 replay하지 않는다**.
  #276 API client는 기존 ADMIN 쓰기처럼 `retryOnUnauthorized: false`를 적용해야 한다.
- timeout/abort/네트워크/응답 파싱/5xx 뒤에는 commit 여부를 추측하지 않는다.
  입력/현재 결과를 보존하고 제출을 잠근 뒤 같은 owner의 ADMIN GET으로 ID·순서·metadata를 대조한다.
  새 ETag를 받았다는 이유만으로 재실행하지 않고, 사람이 결과를 확인하고 새 제출에 동의한다.
- 파일 교체는 ID/URL이 바뀐다. 기존 ID로 실패를 확인하려 DELETE/교체를 재전송하지 않는다.
  관리 GET에 없는 ID는 public GET404와 함께 검토하되 과거 사진을 브라우저가 자동 재연결하지 않는다.
- GET/POST 성공은 DB에 반영된 album이다. **물리 파일 삭제 완료**까지 의미하지 않는다.
  cleanup은 해당 의도를 별도 DB 테이블에 보존하고 재시도한다.

## 2. 업로드 검증·저장

- Java21 ImageIO의 실제 reader/decode로 JPEG/PNG만 허용한다. 파일명·확장자·클라이언트 MIME은 신뢰하지 않는다.
  WebP는 #272의 기존 읽기만 유지하며 새 업로드는400 `MEDIA_003`이다. 새 라이브러리는 추가하지 않았다.
- 입력/저장 결과 각각10MiB 이하, 가로/세로1–8192px, 총 **16,000,000픽셀 이하**, 소유자당20장.
  decode 전 치수/픽셀을 확인하고 decode한 pixels를 재인코딩해 EXIF 등 원본 metadata/뒤에 붙인 payload를 보존하지 않는다.
  썸네일/resize/EXIF 방향 보정/다양한 rendition이 아니라 저장용 단일 이미지다.
- Servlet은 파일10MB/요청11MB로 제한한다. 초과도 공통 JSON 형태의400 `MEDIA_003`이다.
  `metadata`는 altText1–300, source1–500, rightsRecord1–1000자 필수다.
  기록은 사용 허가를 자동 입증하지 않으므로 업로더가 실제 권리/동의를 확인해야 한다.
- 서버가 UUID key를 만든다. 사용자 경로/원격 URL fetch/기존 URL 연결 API가 없다.
  업로드 자체가 해당 소유자에 연결하며 다른 소유자 사진을 ID만으로 가져오지 않는다.
- `MEDIA_STORAGE_ROOT` 아래 CREATE_NEW로 저장한다. 이미 존재하는 파일을 덮어쓰지 않으며
  정리 시 symlink/디렉터리 등 일반 파일이 아닌 대상은 거부한다.
  root는 신뢰된 앱 전용 디렉터리로 운영하고 비신뢰 OS 사용자의 쓰기 권한을 주지 않는다.

## 3. 파일/DB 실패와 내구성

결정 근거: [ADR-008](../adr/008-media-file-lifecycle.md).

| 단계 | DB / 파일 처리 | 실패·중단 후 상태 |
| --- | --- | --- |
| 준비 | decode 후 **별도 트랜잭션**으로 `media_file_cleanup`에 새 key를 먼저 기록 | 아직 파일 없음. DB 실패면 파일을 만들지 않음 |
| 쓰기 | owner 잠금·ETag/개수/소속 확인 → intent PK 잠금 → 파일 생성 → Media 저장 | 파일/DB 오류는 Media 트랜잭션 rollback. 먼저 commit한 intent는 남음 |
| 성공 commit | Media 저장과 새 intent 삭제를 같은 트랜잭션으로 commit | 새 파일이 DB에 귀속됨. intent를 보며 기다리던 cleaner는 사라진 행을 건너뜀 |
| 교체/삭제 commit | 이전 Media 제거 + 옛 key 정리 intent를 같은 트랜잭션으로 저장 | 이전 URL은 DB 재확인에서404. 물리 파일은 후속 정리까지 남을 수 있음 |
| 실패 보정 | 요청 실패 후 별도 정리 트랜잭션으로 best-effort 삭제 | 보정 실패도 intent를 남기므로 다음 poll/재시작 뒤 다시 처리 가능 |
| 프로세스 중단 | 파일 생성 중/DB commit 전 crash도 먼저 저장한 intent가 남음 | 부분 파일/미귀속 파일을 DB 기록으로 찾아 정리. 전체 디스크 scan 불필요 |

Cleanup은 만기 후보20개를 **비잠금 조회 → 안정된 PK 순서로 개별 잠금**하고 READ_COMMITTED에서
현재 Media 참조를 확인한다. 업로드가 intent PK를 잠근 동안 파일을 지우지 않는다.
살아 있는 Media 참조가 있으면 파일은 보존하고 중복 정리 intent만 제거한다.
due-time secondary index를 먼저 잠그는 초기 구현은 실제 MySQL 경합 테스트에서 deadlock이 확인돼 제거했다.
DB 참조 확인은 잠금 대기 전의 repeatable-read snapshot을 사용하지 않는다.

파일 없음은 정리 성공, IO 실패는 attempts/lastFailure(예외 종류만)/nextAttemptAt을 기록하고 재시도한다.
삭제 성공 후 정리 트랜잭션이 실패해도 다음 시도는 파일 없음으로 안전하게 마무리한다.
DB/파일을 하나의 원자적 트랜잭션으로 만든 것이 아니라 durable intent로 보정하는 구조다.
잠금/DB 장애 시 API를 자동 retry하지 않는다. Scheduler 실패는 기록된 intent를 보존해 다음 poll로 넘긴다.

### 운영 설정·복구

| 설정 | 기본 | 의미 |
| --- | --- | --- |
| `MEDIA_STORAGE_ROOT` | `.local/media` | Backend cwd 기준. IDE cwd가 다르면 절대 경로 사용 |
| `MEDIA_CLEANUP_DELAY` | `1m` | 새 준비 intent의 유예 및 파일 실패 재시도 간격 |
| `MEDIA_CLEANUP_SCHEDULING_ENABLED` | `true` | Media 정리만 on/off. Kafka Outbox 설정과 독립 |
| `MEDIA_CLEANUP_INTERVAL` | `1m` | 시작 지연 및 fixed delay poll 간격 |

앱 root의 파일과 DB(특히 catalog_media + media_file_cleanup)를 **함께 영속/백업/복구**한다.
공유 DB를 쓰는 여러 인스턴스는 같은 Media 디스크를 공유해야 한다. 파일 없는 인스턴스에서 cleaner를 켜면 안 된다.
파일/DB 시점이 어긋난 복구 직후에는 cleaner를 끄고 참조/intent를 검토한다.
로그의 정리 실패가 반복되면 root mount·권한·남은 공간을 확인하고 next_attempt_at/attempts/last_failure를 점검한다.
원인 해결 후 scheduler를 켜거나 위 ADMIN cleanup POST를 명시적으로 한 번 실행하고 DB/파일 결과를 검토한다.

#272의 수동 파일이나 외부 도구가 intent 없이 만든 미귀속 파일은 자동 삭제하지 않는다.
정리가 필요하면 모든 writer/cleaner를 멈추고 백업한 뒤 DB key와 파일을 대조해 명시적으로 검토한다.
전체 디렉터리 삭제/임의 재귀 정리/운영 데이터 seed는 제공하지 않는다.
총 디스크 quota/모니터링 알람/공유 객체 저장소/CDN/권리 검증 시스템은 남은 개선 범위다.

## 4. 읽기·캐시·업그레이드

공개 DTO/대표 규칙/목록1장·상세20장과 v2 prefix·TTL은 유지한다.
모든 관리 쓰기는 기존 CatalogMediaCacheEviction proxy를 **같은 Media 트랜잭션 안에서** 호출한다.
commit 후 owner detail을 evict하고 rollback은 기존 cache snapshot을 유지한다.
Search/Room 목록/가용성/ADMIN GET/파일은 response cache를 우회한다.
Room 사진 변경이 숙소 사진을 만들거나 숙소 캐시를 불필요하게 지우지 않는다.

Redis eviction 실패 때 기존 TTL까지 stale metadata/옛 URL이 보일 수 있다.
옛 URL의 content GET은 DB를 다시 보므로404이며 no-store다. 이미 내려받은 bytes를 회수하는 기능은 없다.
eviction 재시도 Outbox나 모든 in-flight cache fill과의 선형적 원자성은 추가하지 않았다.

신규 환경은 JPA DDL, 기존 DB는 [#272 테이블](../erd/mysql-catalog-media-upgrade.sql) 후
[#273 정리 테이블 SQL](../erd/mysql-media-file-cleanup-upgrade.sql)을 백업/대상 확인 후 적용한다.
이번 작업은 개발 Compose DB/Volume에 SQL을 실행하거나 사진을 넣지 않았다.
IF NOT EXISTS가 기존 불완전한 테이블/제약을 수리한다는 뜻은 아니다.

## 5. 격리된 재현·입력 예시

개발 실데이터 대신 테스트 Suite의 임시 MySQL/Redis/디스크·합성 픽셀을 우선 사용한다.
[#273 검증 기록](../testing/media-management-273.md)의 실제 HTTP 테스트가 테스트용 ADMIN JWT 발급·가상 숙소/객실 Fixture 저장부터
업로드/조회/교체/삭제까지 재현하고 종료 시 자기 임시 파일만 정리한다.
실제 호텔 사진이나 [참조 전용 시안 자산](../ui/prototypes/premium-travel/ASSETS.md)을 사용하지 않는다.

별도 격리된 개발 환경에서 Swagger/curl로 확인할 때에는 해당 DB의 가상 숙소/객실을 선택하고,
그 용도로 직접 만들거나 사용 허가를 확인한 작은 JPEG/PNG만 준비한다.
Swagger Authorize에 그 격리 환경의 ADMIN Access Token을 입력한다. 실제 Token을 문서/명령 이력에 남기지 않는다.

1. GET `BASE`: body 없음. 응답 ETag(예: `"64자리 hex"`)와 현재 목록을 확인한다.
2. POST `BASE`: If-Match에 받은 값을 그대로, `file`에 준비한 이미지,
   `metadata` part는 `application/json`으로 아래 JSON을 입력한다.

```json
{"altText":"직접 만든 테스트 픽셀","source":"본인이 생성한 격리 테스트 이미지","rightsRecord":"테스트 이미지 생성자 본인, Demo 전용"}
```

3. PUT `BASE/{실제 mediaId}`: 새 ETag와 같은 형식의 JSON. 파일은 보내지 않는다.
4. PATCH `BASE/{mediaId}/representative`: 최신 ETag, body 없음.
5. PUT `BASE/order`: 최신 ETag, 예를 들어 실제 ID가12/15일 때 `{"mediaIds":[15,12]}`.
   고정 예시 ID를 그대로 실제 DB에 사용하지 않는다.
6. PUT `BASE/{mediaId}/content`: 최신 ETag + 새로운 file/metadata. 새 ID/URL과 옛 URL404를 확인한다.
7. DELETE `BASE/{mediaId}`: 최신 ETag, body 없음. 새 album과 content404 확인.
8. 실패/응답 유실은 쓰기를 재전송하지 말고 GET 후 명시적으로 검토한다. 물리 파일 삭제는 후속 cleanup 결과와 구분한다.

Frontend Form/시각 재현·최종 사용자 승인은 이 API 검증으로 완료되지 않는다.
