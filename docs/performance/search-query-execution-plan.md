# 검색 Query Execution Plan 및 Index 최적화

## 목적과 범위

숙소 구조화 위치 검색, 숙소별 객실 검색, 예약 가능 객실 검색을 MySQL 8.4에서
`EXPLAIN`과 `EXPLAIN ANALYZE`로 비교했다. Index는 실제 Equality 조건, Cardinality,
정렬과 기존 UNIQUE/FK Index를 기준으로 선정했으며 모든 선택 조건과 정렬 조합에
Index를 추가하지 않았다.

측정은 HTTP나 JPA 변환 비용을 제외한 Database 실행 계획 비교다. 단일 로컬 실행의
시간은 Cache와 Docker 상태에 영향을 받으므로 절대 성능이나 운영 응답 시간을
의미하지 않는다.

## 재현 데이터와 Query

- 숙소 200개: 동일 지역 200개 중 목표 도시 40개, `ACTIVE/INACTIVE` 각 20개
- 목표 숙소의 객실 400개: `ACTIVE/INACTIVE` 각 200개
- 객실별 3박 재고: 총 1,200개, 모두 `OPEN`이고 예약 가능
- 숙소 검색: `city = ? AND region = ? AND status = 'ACTIVE' ORDER BY id`
- 객실 검색: `accommodation_id = ? AND status = 'ACTIVE' ORDER BY id`
- 가용 객실 검색: 위 객실 조건과 수용 인원, 3박 재고 Count 상관 Subquery

Fixture는 UUID로 격리하고 측정 후 삭제한다. 테스트 중 Baseline/최적화 Index를
교체하며 `ANALYZE TABLE`로 통계를 갱신한 뒤, 최종 Schema는 최적화 Index로
복구한다. 로컬 Docker Compose Database와 Volume은 사용하지 않는다.

## 적용 전 Index와 분석

| 대상 | 적용 전 Index | 조건과의 관계 |
| --- | --- | --- |
| `accommodations` | `(city, region)` | 위치 Equality에는 맞지만 `status` 50%를 Index 밖에서 필터링 |
| `rooms` | `(accommodation_id)` FK Index | 숙소 후보는 제한하지만 `status` 50%를 Index 밖에서 필터링 |
| `room_inventories` | UNIQUE `(room_id, inventory_date)` | 객실 Equality 뒤 숙박일 범위 3행을 바로 조회하므로 이미 적합 |
| 편의시설 Table | UNIQUE `(owner_id, amenity)` | 상관 Subquery의 두 Equality 조건과 중복 방지를 함께 지원 |

적용 전 Plan은 다음과 같았다.

| Query | Access | 선택 Index | 예상 행 | Estimated Cost | 실제 시간 표본 |
| --- | --- | --- | ---: | ---: | ---: |
| 숙소 위치·상태 | `ref` | `(city, region)` | 40 | 5.75 | 0.024–0.596 ms |
| 객실 숙소·상태 | `range` | `(accommodation_id)` | 400 | 41.2 | 약 1.25 ms |
| 가용 객실의 Room 단계 | `range` | `(accommodation_id)` | 400 | 전체 41.3 | 0.068–0.153 ms |
| 가용 객실의 Inventory 단계 | `ref` | UNIQUE `(room_id, inventory_date)` | 객실당 3 | - | 객실별 3행 |

선정 Query에는 Table Full Scan이 없었지만, 숙소와 객실 단계는 상태 필터 전 후보를
두 배 읽었다. 가용성 Join 순서는 PK로 숙소 1행을 확인한 뒤 객실 후보를 조회하고,
각 객실에서 재고 UNIQUE Index로 숙박일 3행을 확인하는 구조였다.

## Composite Index 설계

### 숙소: `(city, region, status, id)`

`city`, `region`, `status`는 Equality 조건이므로 먼저 배치하고, 기본 ID 정렬을 마지막에
배치했다. 기존 `(city, region)`의 Leftmost Prefix를 포함하므로 기존 Index는 제거한다.
도시만 검색할 때도 `city` Prefix를 사용할 수 있다. 지역 단독 검색은 이 Index의
Leftmost Prefix를 사용할 수 없으므로 기존 `(region)` Index를 유지한다.

### 객실: `(accommodation_id, status, id)`

모든 숙소별 객실·가용 객실 조회의 필수 Equality인 `accommodation_id`를 먼저 두고,
가용성 및 운영 상태 검색의 `status`, 기본 ID 정렬 순서로 구성했다. 이 Index의
`accommodation_id` Prefix가 FK 검사와 기존 숙소별 후보 축소를 지원하므로 단일 FK
Index가 별도로 남으면 중복이다.

`capacity`와 `nightly_price`는 선택적인 Range 조건이고 정렬 필드도 요청마다 달라진다.
첫 Range 이후 Column 활용이 제한되며 가능한 조합마다 Index를 만들면 쓰기 비용이
커지므로 이번 Index에는 포함하지 않았다.

## 적용 후 결과

| Query | Access | 선택 Index | 예상 행 | Estimated Cost | 실제 시간 표본 |
| --- | --- | --- | ---: | ---: | ---: |
| 숙소 위치·상태 | `ref` | `(city, region, status, id)` | 20 | 5.75 | 0.017–0.038 ms |
| 객실 숙소·상태 | `ref` | `(accommodation_id, status, id)` | 200 | 23.8 | 0.021–0.023 ms |
| 가용 객실의 Room 단계 | `ref` | `(accommodation_id, status, id)` | 200 | 전체 10.4 | 0.034–0.100 ms |
| 가용 객실의 Inventory 단계 | `ref` | UNIQUE `(room_id, inventory_date)` | 객실당 3 | - | 객실별 3행 |

숙소와 객실 모두 예상 후보 행이 절반으로 줄었고 `Using filesort` 없이 ID 순서를
사용했다. 가용성 Query는 숙소 `PRIMARY` → 객실 신규 Composite Index → 재고 기존
UNIQUE Index 순서를 유지했으며 어떤 단계도 `ALL` Access를 사용하지 않았다.

실제 시간은 적용 전 측정이 먼저 수행되어 Warm Cache 효과를 분리할 수 없으므로
개선율로 사용하지 않는다. 반복 테스트는 Index 선택, Access Type, 예상 행 감소와
Inventory Index 사용을 회귀 조건으로 검증한다.

## 추가하지 않은 Index

- `lower(name) LIKE '%keyword%'`: 선행 Wildcard 때문에 일반 B-tree Name Index로
  해결되지 않는다. 검색 규모가 커지면 Full-text 또는 별도 검색 엔진을 검토한다.
- `(room_id, sale_status, inventory_date)`: 현재 UNIQUE Index가 객실별 3박만 읽고,
  `OPEN`은 낮은 Cardinality다. 재고는 예약마다 갱신되는 Hot Table이므로 중복
  Secondary Index의 쓰기 비용이 이득보다 크다.
- 모든 객실 가격·수용 인원·정렬 조합: 선택적인 Range와 동적 정렬 조합 수가 많다.
  실제 Traffic 분포 없이 조합별 Index를 만들지 않는다.
- 숙소 `status` 단독 Index: 상태 값이 두 개뿐이며 단독 선택도가 낮다.

## 쓰기 비용과 운영 적용

숙소와 객실 INSERT, 상태 변경 시 신규 Secondary Index 유지 비용이 추가된다. 대신
기존 숙소 `(city, region)` Index와 객실 단일 FK Index는 신규 Index의 Leftmost
Prefix와 중복되므로 제거해 순증가를 제한한다. 재고 Hot Table에는 Index를 추가하지
않았다.

신규 Database는 Entity 매핑에서 최종 Index를 생성한다. 기존 개발 Volume은 Hibernate
`ddl-auto=update`가 기존 Index를 안전하게 교체한다고 가정하지 않고, 검토 후
[`mysql-search-index-optimization.sql`](../erd/mysql-search-index-optimization.sql)을
한 번 적용해야 한다.

## 재현 방법

Docker 호환 Container Runtime이 필요하다.

```powershell
cd backend
.\gradlew.bat test --tests junsik.reservation.performance.SearchQueryExecutionPlanIntegrationTest --rerun-tasks
```

macOS/Linux에서는 `./gradlew`을 사용한다. Plan과 `EXPLAIN ANALYZE` Tree는 Gradle Test
Result의 `system-out`에 기록된다.
