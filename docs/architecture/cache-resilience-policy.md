# Cache Stampede 및 Redis 장애 대응 정책

## 범위와 목표

Redis 상세 Cache는 숙소·객실 조회 성능을 높이는 보조 계층이다. Redis가 느리거나
접속 불가능해도 원본 Database가 정상이라면 두 단건 조회는 동작해야 한다. 반면
Refresh Token과 예약 생성 Distributed Lock은 각각 인증 상태와 재고 정합성에
관여하므로 Cache 폴백 정책을 공유하지 않는다.

## Stampede 발생 조건과 확인 결과

인기 상세 Key가 없거나 만료된 직후 여러 Application Instance가 동시에 조회하면
모든 요청이 Cache Miss를 보고 같은 JPA 조회를 실행할 수 있다. 고정 TTL 자체보다
동일 Key의 높은 요청량과 느린 원본 조회가 이 구간의 부하를 키운다.

기존 non-locking Redis Cache Writer에서는 `@Cacheable`만으로 Instance 간 동시 Miss를
합치지 못한다. `RedisDetailCacheIntegrationTest`에서 같은 숙소를 20개 Thread가
동시에 조회하는 Case를 구성하고 Repository 원본 로드 횟수를 검증한다.

## 적용 전략

숙소·객실 단건 조회에 `@Cacheable(sync = true)`를 적용하고 Spring Data Redis의
locking Cache Writer를 사용한다. 동작 순서는 다음과 같다.

```text
동일 Cache Miss 요청들
  → Redis Cache Lock 획득 요청
  → 한 요청이 Cache를 다시 확인하고 Database에서 로드
  → Response DTO 저장 후 Lock 해제
  → 대기 요청은 저장된 값을 반환
```

- Lock 재확인 간격 기본값은 50ms다.
- Lock에는 기본 5초 TTL을 둬 프로세스 종료나 통신 실패 시 영구 Lock을 방지한다.
- Spring Data Redis locking Writer의 Lock 범위는 개별 Key가 아니라 Cache 이름이다.
  따라서 같은 Cache의 서로 다른 Key Miss도 짧게 직렬화된다. 현재 Cache가 숙소·객실
  단건 두 종류뿐인 점을 고려해 분산 Instance에도 적용되는 단순한 방법을 선택했다.
- 원본 조회가 Lock TTL보다 오래 걸리면 Lock이 만료되어 중복 로드가 발생할 수 있다.
  5초를 넘는 상세 조회는 Cache 설정보다 Database 성능 문제로 먼저 조사한다.

### TTL Jitter 결정

이번 단계에서는 TTL Jitter를 적용하지 않는다. 각 Key는 실제 조회 시점에 개별
적재되어 만료 시각이 자연스럽게 분산되고, 동시 Miss는 locking Writer가 합친다.
무작위 TTL은 만료와 성능 테스트의 재현성을 낮춘다. 향후 대량 사전 적재나 같은
시각의 다수 Key 만료가 관측되면 기준 TTL의 제한된 비율로 Jitter를 추가한다.

## Redis 장애 폴백

Cache 전용 `CacheErrorHandler`는 get/put/evict/clear 중 발생한 Runtime 예외를
경고로 기록하고 Cache 예외를 호출자에게 전파하지 않는다.

```text
Cache get 또는 Lock 실패
  → Cache Error 기록
  → 기존 Service/JPA 조회 실행
  → Database 결과 반환
```

연결은 기본 2초, Redis 명령은 기본 1초 안에 실패하도록 제한한다. 따라서 폴백은
무제한 대기가 아니라 해당 Timeout 이후 시작된다. Redis 장애 중에는 Cache Hit와
Stampede Lock이 모두 없으므로 모든 요청이 Database로 전달된다. 이는 가용성을 위한
의도적 성능 저하이며, 장애 시 유입량 제한과 Database 여유 용량은 운영 계층에서
별도로 준비해야 한다.

Redis가 복구되면 다음 조회가 정상적인 Cache Aside 경로로 값을 저장하고 이후 요청은
다시 Cache Hit가 된다. 별도 재기동이나 수동 초기화는 필요하지 않다.

## 책임 경계

같은 Redis Server를 사용하더라도 Client와 오류 정책은 다음처럼 구분한다.

| 용도 | Client/API | 장애 정책 |
| --- | --- | --- |
| 숙소·객실 상세 Cache | Spring Cache / Spring Data Redis | 경고 기록 후 Database 조회 |
| Refresh Token | Spring Data Redis Repository | 인증 상태 저장소 오류를 그대로 실패 처리 |
| 예약 생성 Lock | Redisson | DB Lock 없는 fail-fast, `503 INVENTORY_013` |

Cache Error Handler는 Spring Cache Interceptor에만 연결된다. 따라서 Refresh Token
오류를 무시하거나 Redisson 예약 Lock 실패를 Database 처리로 우회하지 않는다.

## 트레이드오프와 한계

- Redis 장애 중 Database 부하 증가는 허용하며 Read API 가용성을 우선한다.
- locking Writer는 Cache 단위라 서로 다른 인기 Key의 동시 Warm-up도 직렬화할 수
  있다. 실제 지연이 문제가 되면 Key 단위 Redisson Lock이나 Local Request
  Coalescing을 비교 측정한다.
- Cache put 실패는 응답을 실패시키지 않으므로 Redis가 복구될 때까지 같은 조회가
  Database를 반복할 수 있다.
- 변경 Transaction의 evict 실패도 Database Commit을 되돌리지 않는다. 이 경우
  기존 Value는 최대 상세 TTL 동안 남을 수 있다. 엄격한 무효화 재시도가 필요하면
  Transactional Outbox 또는 Versioned Key를 도입한다.
- Cache 오류 로그와 Hit Ratio, Redis 지연, Database 폴백 횟수의 Metric/Alert는
  Observability 단계의 후속 범위다.

## 검증

- 동일 숙소 Key의 20개 동시 Miss가 Repository 원본 로드 1회로 합쳐지는지 검증한다.
- Redis 연결 실패와 명령 Timeout에서 상세 조회가 Database 결과를 반환하는지
  검증한다.
- 연결 복구 후 최초 조회가 Cache를 다시 채우고 다음 조회가 Database를 사용하지
  않는지 검증한다.
- 테스트는 Redis 7.4 Testcontainer와 H2를 사용하며 로컬 Docker Compose Data를
  변경하지 않는다.
