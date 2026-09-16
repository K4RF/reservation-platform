# 주요 조회 API Query 성능 Baseline 및 N+1 최적화

## 목적

이 문서는 Query 또는 Cache 최적화 전의 조회 구조와 편의시설 N+1 최적화 결과를
고정한다. 실제 MySQL 8.4에서 서비스 계층을 호출해 SQL 수, Entity Load, Collection
Fetch와 실행 시간을 기록했다. 이후 변경은 동일 테스트의 Query 수와 결과 정합성을
먼저 비교해야 한다.

HTTP, 인증 Filter, Network 직렬화 시간은 측정 범위 밖이다. 따라서 아래 시간은 API
응답 시간이나 처리량 목표가 아니라 같은 개발 환경에서 병목 후보를 찾기 위한 참고값이다.

## 측정 환경과 데이터셋

- 측정일: 2026-09-16
- Runtime: Java 21, Spring Boot 4.0.7, Hibernate, MySQL 8.4 Testcontainer
- 숙소: 10개, 숙소마다 `PARKING`, `BREAKFAST` 편의시설과 Booking Policy 1개
- 객실: 숙소당 5개, 총 50개, 객실마다 `WIFI`, `AIR_CONDITIONER` 편의시설
- 재고: 객실당 3박, 총 150개, 모두 `OPEN`, 수량 3개
- 일별 가격: 객실당 첫 숙박일 1개, 총 50개
- 기간: `2035-05-10`부터 `2035-05-13`까지 `[check-in, check-out)` 3박
- 각 조회는 1회 Warm-up 후 5회 측정하며 Query 수가 모든 측정에서 같은지 검증
- Hibernate `StatementInspector`로 실제 Prepared SQL을 수집하고 Statistics로
  Query 및 Loading 수를 측정

Fixture 이름에는 UUID를 사용하고 검색 조건에도 같은 값을 넣어 다른 테스트 데이터가
결과에 섞이지 않게 했다. Testcontainers Database만 사용하며 로컬 Docker Compose
Database와 Volume은 사용하거나 변경하지 않는다.

## 최적화 전 Baseline

아래 시간은 한 차례 로컬 실행의 5회 측정값이다. CI나 Docker Runtime에 따라 달라질 수
있으므로 테스트는 시간 자체를 성공 조건으로 사용하지 않는다.

| 조회 | 결과 크기 | SQL | Entity Load | Collection Fetch | 최소 / 중앙 / 최대 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 숙소 통합 검색 | 5 / 전체 10 | 8 | 5 | 5 | 17.15 / 19.03 / 32.72 ms |
| 숙소 상세 | 1 | 2 | 1 | 1 | 6.04 / 8.52 / 8.98 ms |
| 숙소별 객실 목록 | 3 / 전체 5 | 6 | 3 | 3 | 10.63 / 11.82 / 15.35 ms |
| 예약 가능 객실 목록 | 3 / 전체 5 | 7 | 5 | 3 | 12.73 / 14.50 / 18.90 ms |
| 객실 유효 가격 | 1 | 2 | 2 | 0 | 5.08 / 5.35 / 5.68 ms |

## 연관관계 및 전략 검토

- `Accommodation.amenities`와 `Room.amenities`는 모두 LAZY `ElementCollection`이다.
- `Room.accommodation`을 포함한 주요 `ManyToOne`과 정책의 `OneToOne`도 명시적으로
  LAZY이며, 이번 범위에서 불필요한 EAGER 연관관계는 확인되지 않았다.
- 숙소·객실 Response가 편의시설을 필요로 하므로 LAZY Collection 자체를 제거하거나
  조회하지 않는 Projection은 현재 응답 계약에 맞지 않는다.
- 단건 조회에는 Fetch Join이나 EntityGraph를 적용할 수 있지만 Query 감소 폭이 1회에
  그치며 N+1로 확장되지 않는다.
- 목록 조회에 Collection Fetch Join이나 EntityGraph를 적용하면 Pagination 전에 Join
  행이 증가해 중복 결과 또는 Hibernate의 Memory Pagination이 발생할 수 있다.
- DTO Projection은 필요한 Column만 고를 수 있지만, 동적 Specification과 Enum
  ElementCollection을 함께 Projection하는 전용 Query가 필요해 이번 N+1 제거 범위를
  넘어선다.

따라서 연관관계의 LAZY 전략을 유지하고 두 편의시설 Collection에만 Hibernate
`@BatchSize(size = 100)`을 적용했다. API의 최대 Page Size가 100이므로 한 Page의
편의시설을 하나의 `IN` Query로 가져오며, 조회하지 않는 흐름에서는 Collection을
초기화하지 않는다. Content와 Count Query를 분리하는 기존 Pagination 의미도 유지한다.

## 최적화 후 결과

| 조회 | 최적화 전 SQL | 최적화 후 SQL | 감소 | 전/후 Collection Fetch |
| --- | ---: | ---: | ---: | ---: |
| 숙소 통합 검색 | 8 | 4 | 50.0% | 5 / 1 |
| 숙소 상세 | 2 | 2 | 0% | 1 / 1 |
| 숙소별 객실 목록 | 6 | 4 | 33.3% | 3 / 1 |
| 예약 가능 객실 목록 | 7 | 5 | 28.6% | 3 / 1 |
| 객실 유효 가격 | 2 | 2 | 0% | 0 / 0 |
| **합계** | **25** | **17** | **32.0%** | **12 / 4** |

최적화 후 한 차례 로컬 실행의 최소/중앙/최대 시간은 숙소 검색
17.56/25.27/26.73ms, 숙소 상세 8.45/9.32/10.90ms, 객실 목록
11.53/12.05/13.45ms, 예약 가능 객실 9.92/12.23/14.73ms, 유효 가격
4.97/5.03/6.63ms였다. 이 작은 Fixture의 시간 차이는 성능 향상을 판정할 자료가
아니며 Query 수와 결과 정합성만 회귀 조건으로 사용한다.

최적화 후 Query 수와 Collection Fetch 수를 회귀 테스트의 기대값으로 고정했다.

## 실제 SQL 구조 분석

### 숙소 통합 검색

1. Booking Policy의 현지 날짜 계산을 위해 숙소의 서로 다른 TimeZone을 먼저 조회한다.
2. 숙소 Page Content Query에서 숙소 편의시설, 객실 편의시설, 객실 가격·인원,
   숙박일별 판매 가능 재고, Booking Policy를 상관 Subquery로 필터링한다.
3. 같은 조건의 Pagination Count Query가 별도로 실행된다.
4. 반환된 숙소 5개의 편의시설을 하나의 Batch `IN` Query로 조회한다.

따라서 현재 페이지 크기 5에서는 `TimeZone 1 + Content 1 + Count 1 + 편의시설 Batch 1
= 4` Query다. 최적화 전 편의시설 5회가 한 번으로 줄었다.

### 숙소 상세

숙소 본문 1회와 해당 숙소 편의시설 1회로 총 2회다. 단건 조회이므로 현재 결과에서는
N+1 확장 문제는 없다.

### 숙소별 객실 목록

숙소 존재 확인 1회, Page Content 1회, Pagination Count 1회, 반환 객실 3개의 편의시설
Batch 1회로 총 4회다. 최적화 전 편의시설 3회가 한 번으로 줄었다.

### 예약 가능 객실 목록

숙소와 TimeZone 확인 1회, Booking Policy 1회, 재고 가용성 상관 Subquery를 포함한 Page
Content 및 Count 각 1회, 반환 객실 3개의 편의시설 Batch 1회로 총 5회다. Content와
Count 모두 숙박일별 재고 수를 계산한다.

### 객실 유효 가격

객실 존재 및 기본 가격 조회 1회와 해당 날짜의 일별 가격 조회 1회로 총 2회다. 일별
가격이 없을 때도 두 번째 Query 결과만 비어 있고 기본 가격으로 Fallback한다.

## 남은 병목 후보와 우선순위

편의시설 N+1은 제거했으며 아래 항목은 이번 범위에서 변경하지 않는다.

1. **P1 — 재고 가용성 Content/Count 비용**: 숙소 통합 검색과 예약 가능 객실 조회가
   각 객실의 전체 숙박일 재고 수를 상관 Subquery로 계산한다. 더 큰 데이터셋에서
   `EXPLAIN ANALYZE`와 현재 Index 사용 여부를 먼저 확인해야 한다.
2. **P2 — 숙소 검색 TimeZone 선행 조회**: 검색마다 전체 숙소의 서로 다른 TimeZone을
   조회한다. Booking Policy의 현지 날짜 의미를 유지하면서 대상 범위를 줄일 수 있는지
   검토가 필요하다.
3. **P2 — 선행 존재·정책 조회**: 객실 목록의 숙소 존재 확인과 예약 가능 객실 목록의
   숙소·Booking Policy 조회는 명확한 오류와 정책 검증에 필요하다. Query 통합 시 기존
   오류 응답과 정책 경계가 바뀌지 않아야 한다.

## 재현 방법

Repository Root에서 다음 명령을 실행한다. Docker 호환 Container Runtime이 필요하다.

```powershell
cd backend
.\gradlew.bat test --tests junsik.reservation.performance.ReadApiQueryPerformanceBaselineIntegrationTest --rerun-tasks
```

macOS/Linux에서는 `./gradlew`을 사용한다. 상세 SQL과 실행 시간은 Gradle Test Result의
`system-out`에 `Read API query baseline` Log로 남는다.

후속 최적화는 Fixture와 조회 조건을 유지하고 Query 수, 결과 정합성, 실행 계획을 변경
전후로 함께 기록해야 한다. 부하 환경의 평균·P95·P99 응답 시간과 TPS는 v0.5.0 범위다.
