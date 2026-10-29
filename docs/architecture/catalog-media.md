# Catalog Media 읽기 계약 (#272)

2026-10-29, v0.4.1(Milestone #20). 선행 [재구성 명세 #271](../ui/prototype-rebuild.md).
저장소 선택 근거는 [ADR-007](../adr/007-catalog-media-local-storage.md)에 기록했다.
실제 모델·공개 메타데이터/파일 읽기를 구현한다. ADMIN 업로드/관리 쓰기는 #273,
Frontend 이미지/Gallery 연결은 #276이며 이번에 완료하지 않았다.
시안 사진·가짜 매물을 실제 카탈로그에 넣지 않았다.

## 모델·대표·순서

`catalog_media`는 accommodation_id 또는 room_id **정확히 하나**를 가진다(FK + XOR CHECK).
Room 이미지는 해당 Room 소속이며 숙소 Gallery/대표로 자동 승격하지 않는다.
부모 Entity에 Media Collection을 추가하지 않아 목록 JOIN 중복/페이징 왜곡·LAZY N+1을 피한다.

| 필드 | 저장/규칙 |
| --- | --- |
| id / storage_key | Media ID와 재사용하지 않는 canonical UUID 파일명. key UNIQUE, 파일 key/format/크기 immutable |
| format / byte_size | JPEG(.jpg)/PNG/WEBP, 1–10MiB. JSON/BLOB에 파일 bytes를 저장하지 않음 |
| width / height | 각각 1–8192px. 비율은 width/height로 계산, 원본을 임의 비율로 변형하지 않음 |
| alt_text | 필수 1–300자, 앞뒤 공백 제거 |
| sort_order | 0 이상. 동률 허용, ID 오름차순으로 결정적으로 정렬 |
| source / rights_record | 필수 1–500 / 1–1000자. 실제 출처·사용권/동의 근거를 기록, 허가 자체를 자동 검증하는 기능은 아님 |

**대표 = `(sort_order ASC, id ASC)` 첫 행**이다. 별도 boolean이 없어 대표 중복/부재 상태가 없다.
대표 지정은 #273에서 해당 이미지를 첫 순서로 재정렬하는 명시적 쓰기로 구현해야 한다.
같은 순서는 ID tie-break, 대표 삭제 시 다음 행이 대표, 전부 삭제하면 null/빈 배열이다.
이미지 bytes 교체는 새 key/새 행으로 처리하고 옛 ID/파일명을 다른 사진에 재사용하지 않는다.
순서·대표 변경의 동시 쓰기 직렬화와 전체 결과 검토는 #273의 책임이다.
카탈로그 조회는 파일 존재를 매번 검사하지 않는다. 파일만 유실되면 메타데이터는 유지되고
content GET이404가 되므로 #276이 실패 대체를 표시한다. 다른 대표로 자동 전환하지 않는다.

출처/사용권 기록과 실제 storage key/파일 경로는 공개 DTO에 노출하지 않는다.
alt에는 토큰/연락처 등 비밀값을 넣지 않는다. 공개 이미지인 만큼 운영 상태가 INACTIVE여도
기존 익명 catalog 상세 GET과 동일하게 공개 읽기다. 개인/비공개 파일 저장 용도가 아니다.

## 기존 응답에 추가한 필드

`AccommodationResponse`, `RoomResponse`에 기존 필드를 유지하고 다음 두 필드를 추가했다.

```json
{
  "representativeImage": {
    "mediaId": 123,
    "url": "/api/v1/media/123/content",
    "altText": "소유자가 확인한 실제 사진 설명",
    "width": 1600,
    "height": 1000,
    "byteSize": 245000,
    "contentType": "image/jpeg",
    "sortOrder": 0
  },
  "images": [{
    "mediaId": 123,
    "url": "/api/v1/media/123/content",
    "altText": "소유자가 확인한 실제 사진 설명",
    "width": 1600,
    "height": 1000,
    "byteSize": 245000,
    "contentType": "image/jpeg",
    "sortOrder": 0
  }]
}
```

위 숫자/설명은 **계약 설명 예시**이며 저장된 실제 매물 데이터가 아니다.
`images`는 MediaResponse 객체 배열이고 첫 원소가 representativeImage와 같다.
이미지 없는 기존 행은 `representativeImage: null`, `images: []`다.
캐시의 누락된 images 역직렬화도 빈 불변 List로 정규화하지만, 배포 시에는 아래 v2 키를 사용한다.

| 기존 API | images 상한 / 대표 |
| --- | --- |
| `GET /api/v1/accommodations` | 검색 페이지 각 숙소 대표 최대1장. 해당 숙소 Media만, Room 사진/가격 추가 집계 없음 |
| `GET /api/v1/accommodations/{id}` | 정렬된 Gallery 최대20장 |
| `GET /api/v1/accommodations/{id}/rooms` | 각 Room 대표 최대1장 |
| `GET /api/v1/accommodations/{id}/rooms/available` | 가용 결과에 들어간 Room 각각 대표 최대1장 |
| `GET /api/v1/rooms/{id}` | 해당 Room Gallery 최대20장 |
| 기존 catalog POST / PUT / status PATCH | 새 생성은 없음, 수정/상태 응답은 상세와 같은 상한. 기존 ADMIN 권한 유지 |

페이지 크기 상한은 기존100이다. 목록의 images는 전체 Gallery가 아니라 **대표 1장 projection**이며,
상세 역시 최대20장이다. 20장 초과의 별도 Gallery Pagination은 이번 범위가 아니다.
#273에서는 소유자당 최대20장 등록을 검증해 관리 화면과 공개 상한을 일치시켜야 한다.
Room Metadata/정책 GET/통화/후기/최저가/총액을 추가하지 않았다.

### 조회 비용·페이로드

기존 Specification/Offset/가용성 SQL을 그대로 실행한 뒤 반환된 page ID들만 대상으로
`ROW_NUMBER() OVER (PARTITION BY owner ORDER BY sort_order,id)`를 **한 번** 조회한다.
빈 페이지에서는 Media SQL을 생략한다. detail은 같은 쿼리에 owner 하나/limit20이다.
소유자 수나 사진 수에 비례한 추가 SQL 호출·카드별 상세 GET·사진 BLOB 직렬화가 없다.
기존 편의시설 batch loading과 `[check-in, check-out)`/booking policy/기본 가격 검색 의미는 유지한다.
인덱스는 owner/sort_order/id에 두며, DB는 선택 owner의 Media 행을 순위 계산한다.
반환 행 수가 제한된다는 뜻이지 DB가 모든 경우 딱 한 행만 읽는다는 성능 보장은 아니다.

이미지 URL은 썸네일 변환물이 아니라 **제한된 원본 파일**이다. 새 rendition/srcset/resize는 없다.
따라서 카드 개수×최대10MiB의 실제 다운로드 비용은 남는다. #273의 적절한 원본 제한과
#276의 lazy loading을 적용하고, 실제 측정 후 파생 썸네일 계약을 별도로 검토한다.

## 파일 저장·공개 URL 결정

**선택: 로컬 파일 디스크 + MySQL 메타데이터 + Backend same-origin 읽기.**
프로젝트에 Storage 제공자가 없고 개인 로컬 개발에서 비용/Secret 없이 검증할 수 있어 선택했다.
원격 URL을 저장/수집하지 않으며 S3/유료 CDN/새 외부 라이브러리·가입·배포를 추가하지 않았다.

- `MEDIA_STORAGE_ROOT` → `reservation.media.root`, 기본 `.local/media`는 **Backend 실행 cwd 기준**이다.
  `cd backend`로 실행하면 `backend/.local/media/`. IDE cwd가 다르면 절대 경로를 지정한다.
  `.env_sample`에 예시를 추가했고 `.local/`은 Git에서 제외했다. 실제 사진/비밀값은 커밋하지 않는다.
- DB와 파일을 함께 보존/백업해야 한다. `bootJar`/build 산출물 내부나 임시 디렉터리에 저장하지 않는다.
  앱 재시작으로 파일을 삭제하지 않으며, 읽기만 하는 이번 단계는 루트를 자동 생성하지 않는다.
- 컨테이너로 앱을 배포하면 해당 디렉터리를 영속 Volume에 mount해야 한다. 현재 Compose는
  Backend 앱 컨테이너/Media Volume을 추가하지 않았다. 다중 인스턴스는 공유 디스크/객체 저장소가 필요하다.
  로컬 디스크도 운영 비용/백업/용량 제한이 없는 것은 아니다. 현재는 단일 파일 크기만 제한하며 총 디스크 quota는 후속이다.
- 실제 저장·업로드는 #273에서 파일 decode/format·픽셀·개수·크기·안전 key·권한을 검증해야 한다.
  #272 Entity 검증은 메타데이터 검증이고 실제 업로드 파일 decode 검증 완료가 아니다.
  WEBP enum/읽기는 가능하지만 업로드 decoder 지원 여부도 #273에서 확정/검증한다.
- 출처/권리 확인 없는 과거 사진/alt는 backfill하지 않는다. [Prototype ASSETS](../ui/prototypes/premium-travel/ASSETS.md)는 참조 전용이며 실제 숙소의 근거가 아니다.

`GET /api/v1/media/{mediaId}/content`는 익명 접근 가능하다. DTO URL은 **API origin 기준 상대 URL**이며
Frontend origin이 다른 배포에서는 기존 API base/proxy 기준으로 해석해야 한다(#276).
DB 행을 확인하고 UUID key만 root 아래에서 읽는다. 경로 입력/원격 fetch/디렉터리 노출은 없다.
심볼릭 링크·root 밖 경로·파일 크기 불일치·DB/파일 없음은 404 `MEDIA_001`, 기타 파일 I/O 실패는
503 `MEDIA_002`이며 공통 ErrorResponse를 사용한다. bytes는 최대10MiB로 제한해 읽는다.
`Content-Type`은 enum, `X-Content-Type-Options: nosniff`, `Cache-Control: no-store`다.
이 단계에서는 CDN/브라우저 장기 캐시보다 삭제 후 다음 요청의 일관성을 우선했다.

## Redis 호환·쓰기 무효화

- 캐시 이름 `accommodation-detail` / `room-detail`, ID key·typed JSON·TTL·miss lock·transaction-aware 정책을 유지한다.
  prefix만 **`reservation:cache:v2:`**로 변경해 pre-Media 응답과 분리한다.
  옛 `reservation:cache:` 키를 flush하지 않고 기존 TTL로 만료시킨다. 롤백 배포 시 구 버전 키가 잠시 남을 수 있다.
- 상세의 immutable MediaResponse 배열까지 같은 snapshot에 저장한다. 검색/목록/가용성/파일 bytes는 Redis 응답 캐시를 우회한다.
- 기존 catalog 수정/status는 이전처럼 after-success eviction이다. 새 응답에서도 이미지가 누락되지 않도록 상세 projection을 사용한다.
- `CatalogMediaCacheEviction.accommodationChanged(id)` / `roomChanged(id)`는 **기존 Media 쓰기 트랜잭션 안에서
  별도 Spring Bean proxy를 통해** 호출하는 후속 #273용 hook이다. MANDATORY로 트랜잭션 누락을 거부한다.
  transaction-aware CacheManager가 commit 뒤 evict하고 rollback에서는 원래 snapshot을 유지한다.
  Room Media는 Room detail만, 숙소 Media는 Accommodation detail만 무효화한다.
- **Repository/직접 SQL 변경을 자동 감지하는 장치는 아니다.** #273의 생성/삭제/대표/정렬/alt 변경 모두 hook을 연결해야 한다.
  캐시 장애는 기존 Database fallback/TTL 정책을 따른다. DB와 Redis의 원자적 commit 또는 eviction 재시도 큐는 없으므로
  eviction 실패 때 stale 메타데이터가 TTL까지 남을 수 있다. 삭제된 Media URL의 content GET은 DB 재확인으로404가 된다.
- 파일/DB commit의 원자성은 아직 제공하지 않는다. #273에서 새 파일 준비→DB 반영→commit 뒤 옛 파일 정리,
  rollback/고아 파일/재시도/명시적 결과 검토를 구현하고 검증해야 한다.

## 기존 DB 업그레이드

[일회성 SQL](../erd/mysql-catalog-media-upgrade.sql)은 빈 테이블/제약/인덱스만 만든다.
먼저 의도한 DB/백업/기존 테이블을 검토하고 수동 실행한다. 개발 Compose DB/Volume을 테스트로 삭제하지 않는다.
신규 테스트 DB는 JPA DDL을 사용한다. `ddl-auto=update`가 기존 CHECK를 완전히 보강한다고 가정하지 않는다.
스크립트의 `IF NOT EXISTS`는 불완전한 기존 Media 테이블을 수리하지 않으므로 차이는 별도로 검토한다.
과거 숙소·객실/예약 행을 수정하거나 사진을 추측해 넣지 않는다.

## 검증과 남은 범위

- H2/MockMvc: 공개 기존 read DTO·정렬/대표 교체/삭제·가용 객실·빈 배열·상한·한 번의 Media SQL·OpenAPI.
- 임시 디스크/H2/MockMvc: 실제 PNG bytes 읽기, DB 삭제/파일 없음·크기 불일치·ID/권한·HTTP Header.
  실제 업로드 또는 네트워크 Browser E2E는 아니다.
- MySQL8.4 Testcontainers: window 쿼리/한 소유자 gallery 상한, XOR/FK/UNIQUE/CHECK,
  검토 SQL을 별도 격리 테이블에 적용. MySQL CHECK의 JDBC3819/FK1452를 직접 확인한다.
- Redis7.4 Testcontainers: Media snapshot typed JSON roundtrip/Warm hit 무쿼리/구 prefix 격리/TTL,
  commit/rollback 후 hook 무효화, 검색의 warm detail snapshot 우회. 기존 권한/캐시 회귀 Suite 재사용.

전체 실행 결과·CI 경계는 [#272 검증 기록](../testing/catalog-media-272.md)에 남긴다.
업로드/대표/정렬/alt/삭제 HTTP API·실제 시설 사진 준비·Frontend 연결/시안 재현·사용자 승인은 완료하지 않았다.
