# Pagination Query 최적화와 대용량 조회 전략

## 목적과 현재 조회 계약

현재 목록 API의 Pagination 특성과 데이터 증가 시 비용을 확인하고, 기존 계약을
유지하면서 대용량 예약 이력에 적용할 전략을 결정했다. 소스에서 확인한 페이지 API는
다음과 같다.

| API | 현재 방식 | 필요한 계약 |
| --- | --- | --- |
| 숙소 통합 검색 | `Page` + Offset | 페이지 번호, 전체 건수, ID/이름 정렬 |
| 숙소별 객실 검색 | `Page` + Offset | 페이지 번호, 전체 건수, 여러 정렬 필드 |
| 예약 가능 객실 검색 | `Page` + Offset | 페이지 번호, 전체 건수, ID 정렬 |
| 본인 예약 검색 | `Page` + Offset | 페이지 번호, 전체 건수, 상태·기간 필터와 여러 정렬 필드 |
| 본인 예약 Cursor 검색 | ID Keyset | 최신 이력부터 연속 탐색, 다음 페이지 존재 여부 |

기존 `PageResponse`는 `totalElements`와 `totalPages`를 제공하므로 Content Query 외에
Count Query가 필요하다. 기존 네 API의 응답 계약과 정렬 기능은 변경하지 않는다.

## 방식별 검토

| 방식 | Count Query | 깊은 페이지 비용 | 임의 페이지 이동 | 동적 정렬 | 판단 |
| --- | --- | --- | --- | --- | --- |
| `Page` + Offset | 필요 | Offset만큼 행을 지나감 | 가능 | 가능 | 검색·관리 화면에 유지 |
| `Slice` + Offset | 없음 | Offset 비용은 동일 | 순차 이동 | 가능 | Count만 병목일 때 후보 |
| Cursor/Keyset | 없음 | Cursor 이후 Index Range부터 조회 | 불가 | Cursor 계약별 제한 | 긴 예약 이력에 적용 |

`Slice`는 `size + 1` 조회로 다음 페이지 존재 여부를 알 수 있지만 Offset 자체를
제거하지 못한다. Cursor/Keyset은 페이지 번호와 전체 건수를 포기하는 대신 이전
페이지의 마지막 정렬값에서 바로 조회를 시작한다.

## MySQL 8.4 실행 계획 비교

`PaginationQueryPerformanceIntegrationTest`가 임시 MySQL 8.4 Testcontainer에 한
회원의 예약 10,000건을 만들고 페이지 크기 20, Offset 8,000을 비교한다. 로컬 Docker
Compose Database와 Volume은 사용하지 않는다. 2026-09-17 단일 실행 표본은 다음과
같다.

| Query | 실제 Index 처리 행 | 실행 시간 표본 | 실행 계획 |
| --- | ---: | ---: | --- |
| 첫 페이지 Offset 0 | 20 | 0.054 ms | 역방향 Covering Index Lookup |
| 깊은 페이지 Offset 8,000 | 8,020 | 1.50 ms | 8,020행 조회 후 Offset 폐기 |
| 전체 Count | 10,000 | 1.22 ms | 회원 범위 전체 Covering Index Lookup |
| `id < cursor` Keyset | 20 | 0.103 ms | 복합 Index Range Scan |

모든 Query는 `idx_reservations_member_id(member_id, id)`를 사용했다. 시간은 Docker
상태와 Cache 영향을 받는 단일 로컬 표본이므로 운영 Latency나 개선율로 해석하지
않는다. 회귀 테스트의 핵심 조건은 깊은 Offset과 Count가 데이터 증가에 따라 많은
행을 처리하는 반면 Keyset은 페이지 크기만 읽는다는 점과 복합 인덱스 선택이다.

## 적용한 Cursor 계약

`GET /api/v1/reservations/cursor`를 기존 예약 Page API에 추가했다.

- 정렬은 고유하고 단조 증가하는 예약 `id DESC`로 고정한다. `id` 자체가 안정적인
  Tie-breaker이므로 동일 정렬값 중복 문제가 없다.
- 첫 요청에서는 `cursor`를 생략한다. 다음 요청은 직전 응답의 `nextCursor`를 그대로
  전달한다.
- Repository는 `size + 1`건만 조회한다. 초과 한 건으로 `hasNext`를 계산하고 Count
  Query를 실행하지 않는다.
- 상태와 체크인·체크아웃 기간 필터는 기존 예약 Page API와 동일하게 적용한다.
- `nextCursor`는 다음 페이지가 있을 때만 반환한다. 응답에는 전체 건수와 페이지
  번호가 없다.
- 새 예약이 중간에 추가되어도 이미 받은 Cursor보다 큰 ID이므로 다음 페이지가
  밀리지 않는다. 예약은 물리 삭제하지 않으므로 기존 Cursor가 가리키는 경계도
  유지된다.

`cursor`는 양수, `size`는 1~100이며 기본값은 20이다. Cursor API에는 임의 정렬을
허용하지 않는다. 체크인 날짜나 금액 정렬까지 Cursor로 제공하려면 `(sortValue, id)`
복합 Cursor, 방향별 비교 조건, 대응 복합 인덱스와 공개 API 계약이 각각 필요하므로
실제 Frontend 요구와 Traffic을 확인한 뒤 별도 검토한다.

## 선택과 Trade-off

확정 적용은 예약 이력의 ID Keyset API 하나다. 숙소·객실 검색은 조건 조합, 정렬,
페이지 번호 이동과 전체 건수가 UI에 유용하므로 Offset `Page`를 유지한다. 관리자
목록도 같은 요구가 확인되기 전에는 일괄 Cursor 전환하지 않는다.

Frontend가 무한 스크롤이나 “더 보기” 형태의 본인 예약 이력을 구현할 때는 Cursor
API를 사용한다. 페이지 번호 이동 또는 전체 결과 수가 필요하면 기존 예약 Page API를
사용한다. 데이터 규모와 Slow Query 지표가 확보되면 Count 캐시, 제한된 검색 범위,
`Slice` 또는 도메인별 Keyset API를 독립적으로 평가한다.

## 기존 Database 적용

신규 Database는 `Reservation` Entity 매핑으로
`idx_reservations_member_id(member_id, id)`를 생성한다. Hibernate
`ddl-auto=update`에 기존 인덱스 교체를 맡기지 않는다. 기존 개발 Volume은 백업과
`SHOW INDEX FROM reservations` 확인 후
[`mysql-pagination-index-optimization.sql`](../erd/mysql-pagination-index-optimization.sql)을
한 번 적용한다. 정식 Migration 도구 도입은 이번 범위에 포함하지 않는다.

## 재현 방법

Docker 호환 Container Runtime이 필요하다.

```powershell
cd backend
.\gradlew.bat test --tests junsik.reservation.performance.PaginationQueryPerformanceIntegrationTest --rerun-tasks
```

macOS/Linux에서는 `./gradlew`을 사용한다. 전체 `EXPLAIN ANALYZE` Tree는 Gradle Test
Result의 `system-out`에 기록된다.

Query·Index·Cache와 함께 재측정한 최종 비교는
[`Query 및 Cache 최적화 전후 비교`](query-cache-optimization-comparison.md)에 기록했다.
