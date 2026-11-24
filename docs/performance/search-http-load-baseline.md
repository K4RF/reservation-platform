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

## 실측 결과 — 2026-11-24 (JST, UTC+09:00)

- 대상: `develop` `0c52457`에서 분기한 측정 코드 `a5f9851a5631a5f862762c7dafb6ebd6299daf4c`
  (clean worktree). Boot JAR SHA-256 `b1480bccd8eb738abf4f5c198285e6f548fc8ef0386da6c92e5db82f194f0fb1`.
  각 로컬 manifest에 전체 이미지 식별자·실행 시각·하네스 지문이 남는다.
- Node 24.14.0, Docker Desktop Linux 엔진 29.7.2·Compose 5.5.0, Windows x64 호스트
  24 논리 CPU/15.7GiB RAM, 엔진 24 논리 CPU/7.6GiB. Backend는 Temurin 21.0.13.1,
  2 CPU/1536MiB, `-Xms256m -Xmx512m`, Hikari 최대 10. MySQL 8.4.11은 2 CPU/1536MiB,
  Redis 7.4.10은 0.5 CPU/320MiB(영속화 없음), Kafka 4.3.1은 1 CPU/1024MiB(단일 브로커·3 파티션),
  k6 2.0.0은 1 CPU/320MiB. 이미지 ID 앞자리(MySQL/Redis/Kafka/Java/fixture/k6):
  `b3b90af2a655` / `e9b2e45ecd47` / `77e3df905404` / `8ad118b146aa` / `7fddd9ddeae8` / `a33a0cfdc4d24`.
- `--seed=343 --stay=2026-12-29 --cache=off`; 숙소 시간대 `Asia/Seoul` / `America/New_York`.
  각 조합에 새 스택을 할당했다. 부하 창은 Base seed·smoke와 카탈로그 순차 검증 뒤 시작했다.
  이 캐시 옵션은 상세 응답 캐시만 끈다. 검색이나 자동완성에 Redis 캐시 효과를 가정하지 않는다.

### 데이터와 응답 검증

| 분포 | small | expanded |
| --- | ---: | ---: |
| 총 숙소 / 객실 / 재고 행 (기본 시드 포함) | 104 / 216 / 680 | 776 / 1,560 / 4,600 |
| 추가 숙소 ACTIVE / INACTIVE / 레거시 위치 null¹ | 84 / 12 / 4 | 672 / 96 / 38 |
| 추가 위치 국가 / (국가, 도시) / (국가, 도시, 지역) | 2 / 24 / 25 | 2 / 28 / 29 |
| `Fixtureland` 내 `Port Meridian` 추가 숙소 | 57 / 96 | 464 / 768 |
| 추가 비활성 객실 / 정책 행 | 11 / 30 | 86 / 244 |
| 추가 객실 2일차 OPEN·여유 / OPEN·소진 / 미생성 / CLOSED | 144 / 16 / 16 / 16 | 1,152 / 128 / 128 / 128 |
| 인기 정확 / 희소 정확 / 자유 위치 검색의 전체 count | 32 / 5 / 37 | 270 / 38 / 308 |
| 편의시설·가격 / 2박 가용 / 2박 비가용 응답의 전체 count | 35 / 15 / 52 | 275 / 105 / 433 |
| 첫 페이지 → 깊은 페이지 offset (`size=10`) | 0 → 70 | 0 → 660 |

¹ 레거시 행은 상태 행과 중복된다. 양쪽에서 `Riverwalk` 후보는 10개, `Downtown` 동명 후보는 3개였고
고유 후보 16개를 선택해 저장 위치에 맞는 정확 검색 결과를 검증했다. 없는 위치·리터럴 `%`·레거시 주소의
자동완성은 빈 200으로 성공했다. 짧은 `P`는 빈 200·SELECT 0회로 별도 검증했다.

### HTTP 결과

2026-11-24 14:13:14~14:23:58 JST에 다섯 독립 스택에서 총 500 HTTP 요청을 측정했다.
모두 `200`이며 응답 정합성 오류, 도착 누락, 타임아웃·전송 오류, 도메인 오류는 0건이었다.
측정 전후 재고·예약/가격·이벤트 원장이 일치했고, 측정을 위해 만든 스택만 정리했다.

| 실행 | HTTP n | p50 / p95 / p99 (ms) | 전체 RPS | low / popular / dispersed / steady RPS | 완료 iterations (같은 순서) | popular / dispersed p95 (ms) |
| --- | ---: | --- | ---: | --- | --- | --- |
| 검색 / small | 82 | 18.23 / 35.28 / 136.25 | 1.80 | 1.08 / 2.13 / 2.00 / 3.00 | 13/17/16/36 | 26.78/35.65 |
| 자동완성 / small | 84 | 4.08 / 5.81 / 7.40 | 1.83 | 1.08 / 2.13 / 2.13 / 3.08 | 13/17/17/37 | 6.41/4.96 |
| 검색 / expanded | 83 | 15.82 / 664.95 / 975.18 | 1.80 | 1.08 / 2.13 / 2.00 / 3.08 | 13/17/16/37 | 27.97/894.15 |
| 자동완성 / expanded | 83 | 5.16 / 7.19 / 10.90 | 1.80 | 1.00 / 2.13 / 2.13 / 3.08 | 12/17/17/37 | 10.90/7.62 |
| 후보 선택 흐름 / expanded | 168 | 7.91 / 18.99 / 29.38 | 3.65 | 2.17 / 4.25 / 4.25 / 6.17 | 13/17/17/37 | 16.47/19.42 |

제공 계획은 실행당 `12 / 16 / 16 / 36` iterations였다. 마지막 실행만 iteration당 HTTP 2건이다.
그 실행에서 자동완성 84건은 4.86 / 6.52 / 7.91ms, 정확 검색 84건은 13.68 / 20.46 / 171.15ms였다.
인기·분산은 같은 명목률이지만 서로 다른 조건 믹스다. 확대 검색의 차이는 느린 날짜 요청이
분산 단계에 포함된 결과이지 캐시나 동시성 효과의 비교가 아니다.
p99는 작은 표본에서 최대값에 가깝다. 예를 들어 small의 136.25ms는 `NAME DESC` 5건 중 1건이므로
지속적인 악화나 실제 처리량/SLO를 추정하지 않는다.

실행 ID: 검색 small `dd7e9f47d32866b61cd8aef6`, 자동완성 small `5cbb746f9754520cbeaf957f`,
검색 expanded `1326bf67c4b6d8cd2f6f4bdb`, 자동완성 expanded `328013306f3b919970e9da36`, 후보 선택 흐름 expanded `6954a6b7c0fa41649a6a43f1`.

조건별 표는 독립 API 실행의 `n; p50 / p95 / p99(ms); 전체 실행 기준 RPS`다.

| 조건 | small | expanded |
| --- | --- | --- |
| `search.exact_hot` | 25; 17.46 / 24.23 / 26.78; 0.55 | 25; 15.51 / 21.72 / 27.97; 0.54 |
| `search.exact_rare` | 8; 13.46 / 19.79 / 19.79; 0.18 | 8; 14.34 / 21.77 / 21.77; 0.17 |
| `search.free_tokens` | 7; 17.75 / 26.17 / 26.17; 0.15 | 7; 14.10 / 29.69 / 29.69; 0.15 |
| `search.amenities_price` | 6; 17.57 / 30.06 / 30.06; 0.13 | 7; 19.79 / 26.93 / 26.93; 0.15 |
| `search.stay` | 6; 32.70 / 44.87 / 44.87; 0.13 | 6; 664.95 / 975.18 / 975.18; 0.13 |
| `search.not_available` | 5; 30.37 / 35.28 / 35.28; 0.11 | 5; 487.60 / 730.02 / 730.02; 0.11 |
| `search.shallow` | 5; 23.67 / 25.33 / 25.33; 0.11 | 5; 14.45 / 21.01 / 21.01; 0.11 |
| `search.deep` | 5; 22.80 / 23.97 / 23.97; 0.11 | 5; 14.50 / 23.92 / 23.92; 0.11 |
| `search.name_desc` | 5; 19.16 / 136.25 / 136.25; 0.11 | 5; 13.62 / 23.47 / 23.47; 0.11 |
| `search.empty` | 5; 12.89 / 15.75 / 15.75; 0.11 | 5; 9.85 / 12.40 / 12.40; 0.11 |
| `search.legacy` | 5; 15.96 / 20.22 / 20.22; 0.11 | 5; 15.42 / 20.12 / 20.12; 0.11 |
| `suggest.prefix` | 26; 4.05 / 6.41 / 7.40; 0.57 | 26; 5.90 / 7.61 / 10.90; 0.57 |
| `suggest.partial` | 8; 3.99 / 4.78 / 4.78; 0.17 | 8; 5.38 / 7.15 / 7.15; 0.17 |
| `suggest.tokens` | 8; 4.28 / 7.35 / 7.35; 0.17 | 8; 5.23 / 6.79 / 6.79; 0.17 |
| `suggest.homonyms` | 8; 3.68 / 5.81 / 5.81; 0.17 | 7; 5.02 / 7.62 / 7.62; 0.15 |
| `suggest.normalized` | 7; 4.15 / 5.59 / 5.59; 0.15 | 7; 5.02 / 6.68 / 6.68; 0.15 |
| `suggest.limit` | 7; 4.25 / 4.85 / 4.85; 0.15 | 7; 5.26 / 5.78 / 5.78; 0.15 |
| `suggest.empty` | 7; 4.08 / 4.71 / 4.71; 0.15 | 7; 4.14 / 5.80 / 5.80; 0.15 |
| `suggest.literal` | 7; 3.96 / 4.79 / 4.79; 0.15 | 7; 4.35 / 5.14 / 5.14; 0.15 |
| `suggest.legacy` | 6; 3.89 / 4.60 / 4.60; 0.13 | 6; 4.08 / 5.61 / 5.61; 0.13 |

### SQL 집계와 자원

각 셀은 측정 구간의 `SELECT 횟수 / 누적 ms / 조사 행`이다. SQL 타이머의 합을 HTTP 지연으로
해석하지 않는다. time zone 조회는 날짜 여부와 무관하게 검색 요청당 1회였고, 보강은 Media·편의시설 조회다.

| 실행 | 본문 | count | time zone | 응답 보강 | 후보 CTE |
| --- | --- | --- | --- | --- | --- |
| 검색 / small | 82 / 80.26 / 332,122 | 64 / 104.31 / 540,925 | 82 / 20.63 / 8,528 | 154 / 54.03 / 1,313 | — |
| 자동완성 / small | — | — | — | — | 84 / 60.97 / 644 |
| 검색 / expanded | 83 / 2,287.39 / 13,546,465 | 78 / 4,625.55 / 26,440,481 | 83 / 30.23 / 64,408 | 156 / 44.99 / 1,498 | — |
| 자동완성 / expanded | — | — | — | — | 83 / 143.46 / 659 |
| 후보 선택 흐름 / expanded | 84 / 24.02 / 1,560 | 74 / 46.39 / 25,398 | 84 / 27.61 / 65,184 | 168 / 46.10 / 1,427 | 84 / 143.53 / 874 |

| 실행 | MySQL CPU / 메모리 | Backend CPU / 메모리 | k6 CPU / 메모리 | Hikari active / pending 최대 | InnoDB 논리 읽기 증가 |
| --- | --- | --- | --- | --- | ---: |
| 검색 / small | 4.20% / 466.3MiB | 19.40% / 505.3MiB | 1.19% / 12.84MiB | 1 / 0 | 34,616 |
| 자동완성 / small | 4.23% / 463.9MiB | 4.04% / 499.1MiB | 0.83% / 12.86MiB | 0 / 0 | 3,125 |
| 검색 / expanded | 75.35% / 467.6MiB | 14.68% / 493.1MiB | 1.55% / 12.93MiB | 1 / 0 | 543,480 |
| 자동완성 / expanded | 4.25% / 462.4MiB | 8.71% / 492.5MiB | 1.04% / 12.91MiB | 0 / 0 | 9,602 |
| 후보 선택 흐름 / expanded | 5.20% / 469.5MiB | 11.52% / 502.6MiB | 1.40% / 13.27MiB | 0 / 0 | 100,902 |

CPU/메모리는 6~7회 관측의 최대값이며, 자동완성 expanded의 Docker 관측 1회는 미수집(`docker`)이다.
모든 측정에서 InnoDB 물리 읽기 및 buffer pool miss delta는 0이었다. Docker Block I/O 누적값은
시드·초기화도 포함하므로 SQL 구간 스캔량과 같은 지표가 아니다. Hikari pending은 관측상 0이었지만
간헐적 대기나 용량 한계를 입증하지 않는다.

### 대표 SQL과 실행계획

실제 바인딩에서 인기 정확 검색 조건은 `country='Fixtureland' AND city='Port Meridian' AND
region='Downtown' AND status='ACTIVE'`, 페이지는 `LIMIT 0,10`이었다. 깊은 페이지는
`lower(name) LIKE '%bench 343%'`에 `LIMIT 70,10` 또는 `LIMIT 660,10`이었다.
날짜 검색은 `nightly_price` 10000~17500, 정원 4, 숙소/객실 편의시설 AND, `inventory_date`의
`[2026-12-29, 2026-12-31)` 범위와 `OPEN`·여유 재고의 `count=2`, 숙소 시간대별 정책을 포함한다.
본문과 count는 WHERE 조건을 공유하되 count에는 LIMIT가 없다. 자동완성 `Riverwalk`의 토큰
바인딩은 `LIKE '%riverwalk%'`이며 순위 계산은 정확/접두/부분 순서다.

| 대표 조건 | small → expanded 관찰 |
| --- | --- |
| 인기/희소 정확 위치 | `idx_accommodations_city_region_status_id`로 city/region/status lookup, country는 남은 필터. 인기 count 인덱스 노드 37 → 308행. 희소는 5건짜리 첫 페이지에서 count 생략 → 38건·count 실행. |
| 자유 목적지 토큰 | 본문은 PRIMARY 순서 scan, count는 복합 인덱스 **전체 covering scan**(104 → 776행). `lower()`·선행 `%` 토큰의 동등 lookup이 아니다. |
| 첫/깊은 ID 페이지 | small 본문 PRIMARY 20 → 100행, expanded 본문 20 → 774행. 둘 다 10건 반환. 같은 규모 내에서 첫/깊은 count는 모두 숙소 테이블 104/776행을 읽는다. |
| NAME DESC | 이름 DESC + ID ASC를 위해 입력 숙소 104 → 776행을 읽어 정렬. offset이나 정렬은 count를 줄이지 않는다. |
| 넓은 편의시설·가격 | 객실 216 → 1,560행을 scan하고 숙소/편의시설을 PK로 확인. 이 조건에서 `idx_rooms_accommodation_status_id`가 시작점이 아니었다. |
| 넓은 2박 가용 | 본문·count 모두 객실 scan과 상관 재고 조회: 680행 × 67 loops → 4,600행 × 477 loops. `uk_room_inventories_room_date`가 선택되지 않았다. 정책 행은 UNIQUE lookup. 별도 `EXPLAIN ANALYZE`의 root 완료 시간은 본문/count 11.5/8.84ms → 429/550ms (각 1회). |
| 빈 정확 검색 | time zone + 본문 2 SELECT, count·응답 보강 없음. |
| 후보 `Riverwalk` | 도시·지역 가지 모두 숙소 테이블 scan(104 → 776행/가지). 지역 `ROW_NUMBER` 입력 18 → 133행, 이후 중복 제거와 정렬을 거쳐 10건 반환. |
| 짧은 `P` | DB 카탈로그 SELECT 0회. 정상 후보 부하 분모에서 제외. |

### #348에 넘길 우선순위

1. **2박 가용/비가용과 count**: 확대 시드에서 2박 가용 HTTP p95가 44.87 → 975.18ms(각 6건),
   비가용 p95가 35.28 → 730.02ms(각 5건)였다. 범용 지표보다 날짜 조건의 반복 재고 접근과
   같은 필터를 다시 평가하는 count 경로를 먼저 분리해 검증한다. 달력/가격/정책 의미와 offset
   응답 계약은 유지하고 쿼리 진입 방식이나 인덱스 후보를 한 번에 하나만 비교한다.
2. **자동완성**: 최대 10건은 반환 상한이다. 전체 후보 부하에서 정렬 행이 4,983 → 38,456으로
   늘고 CTE SQL 누적 시간은 60.97 → 143.46ms였다. 후보 수가 응답보다 빨리 늘어나는 분포와
   중복 제거·정렬을 따로 측정할 가치는 있으나, 지금 표본에서는 날짜 검색보다 후순위다.
3. **깊은 offset/NAME/free 토큰과 전역 시간대 조회**: 실행량 증가가 관측됐다. 이 낮은 도착률에서
   깊은 페이지의 일관된 HTTP 악화는 입증되지 않았다. 같은 날짜·시드·SQL/응답 정합성 기준으로
   반복 측정한 뒤 판단한다. [후속 이슈 #348](https://github.com/K4RF/reservation-platform/issues/348)에서
   전후 실행계획과 HTTP 표본을 함께 비교한다.
