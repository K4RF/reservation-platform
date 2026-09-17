# Redis Cache 기반 주요 조회 API 캐싱 전략

## 목적

조회 Baseline과 데이터 변경 특성을 기준으로 반복 조회 효과가 큰 API만 Redis에
Cache한다. 예약 정합성이나 검색 결과의 최신성을 Cache 편의를 위해 낮추지 않으며,
모든 조회 API를 일괄 캐싱하지 않는다.

## 적용 대상 선정

| 조회 | 조회·변경 특성 | 결정 |
| --- | --- | --- |
| 숙소 단건 | 상세 화면에서 반복 조회, 변경은 관리자 정보·상태 수정으로 제한 | 적용 |
| 객실 단건 | 상세 화면에서 반복 조회, 변경은 관리자 정보·상태 수정으로 제한 | 적용 |
| 숙소·객실 목록 검색 | 검색 조건과 정렬·페이지 조합이 많고 변경 시 광범위한 무효화 필요 | 제외 |
| 예약 가능 객실 | 날짜별 재고·판매 상태·정책과 현재 날짜에 따라 결과 변경 | 제외 |
| 객실 유효 가격 | 객실 기본 가격과 날짜별 가격의 두 변경 경로를 함께 무효화해야 함 | 제외 |
| 예약 단건·목록 | 생성·일정 변경·취소로 상태와 금액·재고가 변경되고 회원 소유권 적용 | 제외 |
| 재고 Calendar·정책 | 관리 작업과 예약 정합성에 직접 사용 | 제외 |

현재 적용 범위는 `GET /api/v1/accommodations/{id}`와
`GET /api/v1/rooms/{id}`의 Response DTO다. Entity나 Hibernate Proxy를 Cache Value로
저장하지 않는다.

## Cache Aside 흐름

Spring Cache의 `@Cacheable`로 Cache Aside를 구성한다.

1. Entity ID로 Redis Cache를 조회한다.
2. Hit이면 JSON을 Response DTO로 역직렬화하고 Database Query 없이 반환한다.
3. Miss이면 기존 JPA 조회와 응답 변환을 실행한다.
4. 성공한 Response DTO를 Redis에 저장한다.

존재하지 않는 Entity의 예외나 null은 캐시하지 않는다. 관리자가 숙소·객실 정보 또는
상태를 변경하면 `@CacheEvict`가 해당 Entity ID의 상세 Cache만 제거한다. Cache
Manager는 Transaction-aware로 구성해 변경 Transaction과 Cache 무효화 경계를
맞춘다. 생성은 이전 값이 존재할 ID가 아니며 목록 Cache도 없으므로 무효화 대상이
없다.

Command별 의존성과 Commit/rollback 처리의 상세 기준은
[`Cache Invalidation Policy`](../architecture/cache-invalidation-policy.md)에 기록했다.

## Key와 Value

같은 Redis Instance의 용도별 Key 공간은 다음처럼 분리한다.

| 용도 | Key 예시 |
| --- | --- |
| Refresh Token | `refresh:{memberId}` |
| 예약 생성 Lock | `reservation:lock:room:{roomId}` |
| 숙소 상세 Cache | `reservation:cache:accommodation-detail::{accommodationId}` |
| 객실 상세 Cache | `reservation:cache:room-detail::{roomId}` |

Cache 이름은 `accommodation-detail`, `room-detail`이고 Key는 Entity ID다. Value는
Spring Boot가 제공하는 Jackson `ObjectMapper`와 Cache별
`JacksonJsonRedisSerializer`를 사용해 구체적인 `AccommodationResponse` 또는
`RoomResponse` JSON으로 저장한다. Cache 이름을 사전 등록하고 런타임의 임의 Cache
생성은 허용하지 않는다.

## TTL과 설정

두 상세 Cache의 기본 TTL은 10분이다. 운영 특성과 측정 결과에 따라 환경변수로
조정할 수 있다.

| 환경변수 | 기본값 | 의미 |
| --- | --- | --- |
| `RESERVATION_CACHE_ENABLED` | `true` | 상세 조회 Cache 활성화 |
| `RESERVATION_DETAIL_CACHE_TTL` | `10m` | 숙소·객실 상세 Cache TTL |

TTL은 양수만 허용한다. Cache Hit 때 TTL을 연장하지 않는 고정 만료 방식이며 null은
저장하지 않는다. 이 설정은 Refresh Token TTL과 Redisson Lock Lease에 영향을 주지
않는다.

## 테스트와 격리

`RedisDetailCacheIntegrationTest`는 Redis 7.4 Testcontainer를 사용해 다음을 검증한다.

- 첫 조회 Miss 후 JSON Cache 저장
- 두 번째 Hit 때 Hibernate Prepared Statement 0회
- TTL 만료 후 Database 재조회
- 숙소·객실 상태 변경 후 해당 상세 Key 제거 및 최신 값 재조회
- 외부 Transaction Commit 전에는 Key를 유지하고 Commit 후 여러 Key를 함께 제거
- 외부 Transaction rollback 시 Database와 기존 Cache Value를 모두 유지

일반 H2 통합 테스트는 Transaction Rollback과 반복되는 Entity ID 때문에 Cache를
비활성화한다. Cache 전용 테스트만 독립 Redis Container에서 활성화하므로 개발용
Docker Compose Redis의 Key나 데이터는 사용하거나 삭제하지 않는다. GitHub Actions는
기존 Docker 실행 환경과 Redis Service를 유지하며 새 의존성이나 별도 외부 Service는
필요하지 않다.

## 제한과 후속 검토

- Cache 장애 시 세부 fallback 정책과 관측 지표는 아직 별도로 구성하지 않았다.
- Cache Hit Ratio, 명령 지연, 메모리·Eviction 지표는 Observability 단계에서 추가한다.
- 다중 요청의 동시 Miss를 합치는 Stampede 방지는 현재 적용하지 않았다.
- 검색 조건 Cache, 유효 가격 Cache, 예약 Cache는 실제 Traffic과 무효화 비용을
  측정하기 전까지 추가하지 않는다.
