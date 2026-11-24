# 숙소 검색·위치 자동완성 HTTP Baseline (#343)

[#342의 격리 러너](../../load-test/README.md)를 사용한다. 제품 검색 로직, 인덱스, API, 캐시 정책은
변경하지 않았다. 이전 [SQL 중심 실행계획](search-query-execution-plan.md)과 달리 Boot JAR의 HTTP 비용을
포함한다. Vite·프록시·운영 데이터와 운영 처리량은 범위 밖이다.

## 재현

Java 21/Gradle Wrapper로 Boot JAR를 준비하고, 이전 실행을 정리한 뒤 한 번에 하나만 실행한다.
운영·개발 주소나 기존 DB는 선택할 수 없다. 두 지역 시간대에 대해 안전한 미래 체크인 날짜를 사용한다.

```powershell
Push-Location backend
.\gradlew.bat bootJar
Pop-Location
node --test load-test/catalog.test.mjs load-test/harness.test.mjs
$stay = (Get-Date).AddDays(35).ToString('yyyy-MM-dd')
node load-test/run.mjs prepare --confirm=isolated --seed=343 "--stay=$stay" --profile=catalog-search --cache=off --catalog-size=small
node load-test/run.mjs run <run-id> --confirm=<run-id>
node load-test/run.mjs cleanup <run-id> --confirm=<run-id>
```

`catalog-search` / `catalog-suggest`는 단일 API만 호출한다. `catalog-journey`는 실제 후보를
조회한 뒤 첫 후보의 `searchParams`로 정확 위치 검색을 한 번 호출한다. 이는 선택이 있는 탐색 여정이며,
빈 후보나 입력 중 중단이 포함된 실제 사용 로그의 비율이 아니다. `small` / `expanded`를 바꾸어
데이터 규모를 분리한다. 각 실행은 동일한 #342 시드와 HTTP smoke 이후 카탈로그 데이터를 추가한다.
스키마 유지가 필요한 신·구 위치/재고 상태는 소유권 확인 후 전용 MySQL에 fixture로 넣는다.

## 검증 행렬

| 종류 | 조건과 검증 |
| --- | --- |
| 정확/자유 검색 | 인기·희소 국가/도시/지역, 순서를 바꾼 자유 토큰, 위치 충돌로 인한 빈 응답, 레거시 주소 fallback |
| 객실/일정 | 숙소/객실 편의시설 AND, 한 활성 객실의 정원·기본 1박 가격, 전체 기간 재고, ACTIVE, 예약 정책, 가용/비가용 |
| 페이징 | 같은 필터의 첫/깊은 페이지 및 전체 count, ID 양방향, 동일 이름의 NAME DESC + ID ASC tie-break |
| 후보 | 접두·부분·다중 토큰·동명·공백/대소문자 정규화, 와일드카드 리터럴, 최대 10개, 저장 튜플과 정확 선택, 빈 응답 |
| 제어 | 짧은 입력의 빈 응답과 SELECT 0회는 부하 구간에서 제외 |

각 HTTP 응답은 고정 시드에 대한 별도 기대 ID/순서·count 또는 후보 순서/정확 튜플과 비교한다.
두 번째 밤만 없는/닫힌/소진된 객실, 3박 최소 정책, 높은 첫날 override와 낮은 기본가를 넣어
하루만 확인하거나 override를 기본가 필터로 잘못 사용하는 경우를 가려낸다.

## 단계와 수집 경계

사전 단일 요청 검증에서 조건 전체를 순차 호출한 후, 읽기 전용 k6는 단계별 제공률을 고정한다.
활성 VU·iteration 수는 RPS가 아니다. 각 단계 사이 2초 간격, 마지막 요청 뒤 검증·정리를 분리한다.
오류, 결과 불일치, drop 또는 반복 부족은 실패다. 도착률 종료 경계의 1회는 #342와 같이 기록·허용한다.

| 단계 | 계획 | 요청 분포 |
| --- | --- | --- |
| low | 1 iteration/s × 12s, 최대 1 VU | 조건 순회 |
| popular | 2 iteration/s × 8s, 최대 2 VU | 같은 인기 조건 반복 |
| dispersed | 2 iteration/s × 8s, 최대 2 VU | 조건 순회 |
| steady | 3 iteration/s × 12s, 최대 3 VU | 조건 순회 |

- `catalog-fixture.json`: 추가 규모·분포·지문, 조건별 실제 검증 count, 깊은 페이지 번호.
- `summary.json`: 단계/조건별 표본·RPS·p50/p95/p99·오류/분류·도착 계획/완료. k6 측정 시간은
  [HTTP 메트릭 정의](https://grafana.com/docs/k6/latest/using-k6/metrics/reference/)를 따른다.
  조건별 `rpsOverRun` 분모에는 단계 사이 간격이 포함된다. 단계 비교의 RPS는 HTTP 표본을 각
  단계의 계획된 초로 나눈 값이며, 종료 경계의 완료가 포함될 수 있다.
- `catalog-sql.json`: 워밍업·사전 확인이 끝난 뒤부터 k6 종료까지 Performance Schema delta.
  content/count/time zone/응답 보강/후보 CTE별 SELECT 호출, 타이머(ps), 조사/전송/정렬 행과 InnoDB 읽기.
- `catalog-plans.json`: 독립 검색/후보 실행이 종료된 뒤 한 번씩 재호출하여 추적한 실제 SELECT와
  바인딩 리터럴, `EXPLAIN ANALYZE` 트리. 로그는 각 재호출 동안만 활성화된다. 진단 비용과
  사후 정합성 확인은 HTTP 및 SQL delta 측정에 포함하지 않는다. 조합 여정은 동일 대표 계획을 재사용한다.
- `observations.jsonl`: PID/JVM/Hikari, MySQL과 인프라, k6와 대상 Docker CPU/메모리/Block I/O.
  관측기가 같은 호스트에 있음을 명시한다. fixture와 사전 확인으로 버퍼가 데워진 상태이며
  완전한 cold-start/JIT steady state 또는 CPU 병목 부재를 보장하지 않는다.

산출물은 `.local/load-test/<run-id>`에 둔다. 사용자 데이터·요청/응답 본문·토큰은 PR에 첨부하지 않는다.
진단은 오직 합성 입력으로 실행하며, 대표 문장/계획의 검토 결과만 공유한다.
