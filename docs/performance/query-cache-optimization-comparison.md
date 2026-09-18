# Query 및 Cache 최적화 전후 비교

## 목적과 측정 경계

v0.3.0의 N+1 제거, 검색 Index, Pagination, Redis 상세 Cache 결과를 같은 조건에서
다시 검증한다. Query 최적화와 Cache Hit 효과가 섞이지 않도록 다음 네 Probe를
분리했다.

| 영역 | 테스트 | Cache | 측정 대상 |
| --- | --- | --- | --- |
| JPA Query/N+1 | `ReadApiQueryPerformanceBaselineIntegrationTest` | 비활성 | SQL·Collection Fetch·Service 실행 시간 |
| 검색 Index | `SearchQueryExecutionPlanIntegrationTest` | 미사용 | Index 전후 `EXPLAIN ANALYZE` |
| Pagination | `PaginationQueryPerformanceIntegrationTest` | 미사용 | Offset/Count/Keyset 처리 행과 실행 시간 |
| 상세 Cache | `CacheReadPerformanceComparisonIntegrationTest` | 활성 | Cold Miss/Warm Hit SQL과 Service 실행 시간 |

HTTP, 인증 Filter, JSON 직렬화, Network 시간은 포함하지 않는다. 따라서 측정 시간은
운영 API SLO나 TPS가 아니라 같은 로컬 환경에서 방향을 확인하는 표본이다. 본격적인
다중 사용자 부하, p99, TPS와 장시간 안정성은 v0.5.0 범위다.

## 환경과 반복 조건

- 측정일: 2026-09-19
- Windows, Java 21, Spring Boot 4.0.7, Gradle 9.5.1
- Docker Desktop의 MySQL 8.4·Redis 7.4 Testcontainer
- 로컬 Docker Compose Database·Redis 및 Volume은 사용하지 않음
- Query 적용 전: `b308827` (#111 Baseline 병합 시점)
- Query 적용 후: #112~#117이 병합된 `e498e80`
- Query와 Cache 시간: 각 1회 Warm-up 후 또는 상태 준비 후 5회 측정
- p50은 정렬된 5개 표본의 중앙값, p95는 표본 수가 5개이므로 최대값과 동일
- 검색 Index 전후는 한 테스트 안에서 Index를 교체하고 `ANALYZE TABLE` 후 측정
- Pagination은 동일 10,000행에서 각 Query의 `EXPLAIN ANALYZE`를 1회 비교

Query 전후는 같은 소스의 `ReadApiPerformanceFixture` 조건을 사용한다.

- 숙소 10개, 숙소당 객실 5개
- 숙소 편의시설 2개, 객실 편의시설 2개
- 객실당 3박 재고, 첫 숙박일 Daily Price 1개
- 검색 결과 숙소 5개, 객실 3개

절대 시간에는 별도 JVM·Container 시작 순서와 Host 부하가 반영된다. 성공 조건은
시간 임계값이 아니라 SQL 수, Collection Fetch 수, 선택 Index와 실제 처리 행이다.

## N+1 및 Query 최적화 결과

`@BatchSize(100)` 적용 전후를 동일 Fixture와 조회 조건으로 실행했다.

| 조회 | SQL 전→후 | Collection Fetch 전→후 | 감소율 | 평균 ms 전→후 | p50 ms 전→후 | p95 ms 전→후 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 숙소 통합 검색 | 8→4 | 5→1 | 50.0% | 20.80→18.67 | 20.23→18.51 | 23.11→19.36 |
| 숙소 상세 | 2→2 | 1→1 | 0% | 5.51→8.14 | 5.52→8.33 | 5.93→11.40 |
| 숙소별 객실 목록 | 6→4 | 3→1 | 33.3% | 12.36→12.02 | 12.36→11.87 | 12.95→13.34 |
| 예약 가능 객실 | 7→5 | 3→1 | 28.6% | 13.44→12.13 | 13.29→12.32 | 14.12→12.75 |
| 객실 유효 가격 | 2→2 | 0→0 | 0% | 6.18→6.22 | 6.15→6.10 | 6.57→6.59 |
| **합계 SQL** | **25→17** | **12→4** | **32.0%** | - | - | - |

목록 편의시설 N+1은 제거되어 결과 수에 비례하던 Collection Query가 한 번으로
고정됐다. 숙소 상세와 유효 가격은 최적화 대상이 아니므로 SQL이 줄지 않았다.
숙소별 객실 목록 p95는 SQL 감소에도 개선되지 않았으며 예약 가능 검색에는 재고 상관
Subquery와 Count Query가 남아 있다. 작은 표본에서 몇 ms 차이를 일반화하지 않고
개선되지 않은 결과도 그대로 기록한다.

## 검색 Index 비교

숙소 200개, 목표 숙소 객실 400개와 3박 재고 1,200개에서 기존 Index와 최종 Composite
Index를 같은 테스트 실행 안에서 비교했다.

| 단계 | 적용 전 | 적용 후 | 예상 후보 행 전→후 | 실행 완료 시간 표본 전→후 |
| --- | --- | --- | ---: | ---: |
| 숙소 위치·상태 | `(city, region)`, `ref` | `(city, region, status, id)`, `ref` | 40→20 | 0.0506→0.0373 ms |
| 객실 숙소·상태 | `(accommodation_id)`, `range` | `(accommodation_id, status, id)`, `ref` | 400→200 | 0.0423→0.0249 ms |
| 가용 객실 Room 단계 | 기존 객실 Index, `range` | 최종 객실 Index, `ref` | 400→200 | 전체 0.116→0.102 ms |

재고 단계는 전후 모두 UNIQUE `(room_id, inventory_date)`를 사용하고 객실당 3행을
읽는다. 최종 Plan에는 선택 대상 단계의 Full Scan과 filesort가 없다. 실행 시간은
단일 `EXPLAIN ANALYZE` 표본이므로 Index 선택과 후보 행 절반 감소를 핵심 결과로 본다.

## Pagination 비교

한 회원의 예약 10,000건, 페이지 크기 20, 깊은 Offset 8,000 조건이다.

| Query | 실제 처리 행 | 실행 완료 시간 표본 | 판단 |
| --- | ---: | ---: | --- |
| 첫 페이지 Offset | 20 | 0.069 ms | 작은 첫 페이지는 효율적 |
| 깊은 페이지 Offset | 8,020 | 1.70 ms | 8,000행을 버린 뒤 20행 반환 |
| 전체 Count | 10,000 | 0.921 ms | 전체 회원 범위를 집계 |
| ID Keyset | 20 | 0.132 ms | 깊이와 무관하게 페이지 크기만 처리 |

Keyset은 깊은 Offset보다 400배 이상 적은 행을 처리하고 Count Query가 없다. 임의
페이지와 전체 건수가 필요한 검색 화면은 기존 Offset을 유지하며, 연속 예약 이력에만
Cursor API를 적용한 결정은 유지한다.

## Redis Cache 비교

Query Probe와 같은 10개 숙소·50개 객실 Fixture에서 대표 숙소 상세를 측정했다. Cold
조건은 매회 해당 Key를 제거한 뒤 측정하고, Warm 조건은 앞선 성공 조회가 저장한
Value를 유지한다. Cache 제거 시간은 Cold 응답 시간에 포함하지 않는다.

| 상태 | 반복 | SQL/요청 | DB 접근 감소 | 평균 | p50 | p95 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Cold Miss | 5 | 2 | 0% | 31.44 ms | 11.61 ms | 108.34 ms |
| Warm Hit | 5 | 0 | 100% | 2.01 ms | 1.81 ms | 2.68 ms |

Cold Miss는 Database 조회 외에 Redis Miss 확인, Cache Lock, JSON 저장 비용이 있어
Cache 비활성 숙소 상세 Query Probe와 직접 같은 시간으로 해석하지 않는다. Warm Hit의
확정 결과는 Database 접근이 2회에서 0회로 줄었다는 점이다. Cold p95의 큰 편차도
5회 Micro 표본을 Latency 보장으로 사용하지 않는 이유다.

Cache 무효화는 `RedisDetailCacheIntegrationTest`와
`RedisCacheInvalidationIntegrationTest`가 정보·상태 변경, Commit, rollback 및 다중
Key를 검증한다. `RedisCacheFallbackIntegrationTest`는 연결 실패와 명령 Timeout의 DB
Fallback, Redis 복구 후 재적재를 검증한다. 성능 비교 테스트에서 이 동작을 중복
구현하지 않는다.

## 결론과 남은 영역

- N+1 제거는 목록 Query 합계를 25회에서 17회로 32% 줄였다.
- 검색 Composite Index는 숙소·객실 후보 행을 각각 절반으로 줄였다.
- 예약 ID Keyset은 깊은 페이지에서 처리 행을 8,020개에서 20개로 제한한다.
- Redis Warm Hit는 숙소 상세의 Database 접근을 2회에서 0회로 줄였다.
- 단건 Query, 유효 가격, 예약 가능 검색의 상관 Subquery와 Count는 개선되지 않은
  영역으로 남는다.
- 5회 Micro 표본은 GC, JIT, Docker·OS Scheduling 영향을 받는다. 통계적 성능 보장,
  동시 사용자, 처리량, p99와 자원 사용량은 v0.5.0 k6/Monitoring에서 검증한다.

## 재현 명령

```powershell
cd backend
.\gradlew.bat test --tests "junsik.reservation.performance.*" --rerun-tasks
.\gradlew.bat test --tests "junsik.reservation.cache.*" --rerun-tasks
```

macOS/Linux에서는 `./gradlew`을 사용한다. 세부 SQL과 측정값은 Gradle XML/HTML Test
Result의 `system-out`에 남는다.
