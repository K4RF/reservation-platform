# 가용 객실·일별 적용 요금 HTTP Baseline (#345)

[#342 격리 러너](../../load-test/README.md)를 통해 제품 Boot JAR의 두 DB 읽기 경로를 독립 측정한다.
제품 쿼리, 캐시, 인덱스, API, CI 설정은 바꾸지 않았다. 검색 결과의 기본가는 날짜별 요금 합계가 아니고
단일 날짜의 Daily Price도 전체 숙박 금액이 아니다. 예약 생성/재고 쓰기와 성능 측정을 섞지 않는다.

## 재현

Java 21/Gradle Wrapper로 Boot JAR를 빌드하고 Docker Desktop Linux 엔진을 실행한다.
저장소 루트에서 한 번에 하나의 신규 스택만 실행한다. 준비가 반환한 **동일 run ID**를 사용한다.

```powershell
Push-Location backend
.\gradlew.bat bootJar
Pop-Location
node --test load-test/*.test.mjs
$stay = (Get-Date).AddDays(35).ToString('yyyy-MM-dd')
node load-test/run.mjs prepare --confirm=isolated --seed=345 "--stay=$stay" --profile=stay-availability --cache=off --catalog-size=small
node load-test/run.mjs run <run-id> --confirm=<run-id>
node load-test/run.mjs cleanup <run-id> --confirm=<run-id>
```

`stay-availability`(가용 객실 GET)와 `stay-price`(객실·날짜별 적용 요금 GET)는 `small`/`expanded`를
각각 실행한다. `stay-journey`(여정)는 이번 결과에서 `expanded`로 따로 실행했다. 캐시 off는 상세 응답
캐시만 끄며, 두 실험 대상은 애초에 그 캐시 경로를 사용하지 않는다. 개발 DB나 운영 주소를 선택할 수 없다.

## 데이터와 결과 계약

- #342 기본 시드·인증/소유권 HTTP smoke 후, 새 숙소 5개에 실험 데이터만 추가한다. 인기 숙소(정책 있음),
  분산 숙소(정책 없음), 상반된 현지 날짜를 가진 정책 동일 숙소 두 곳, 비활성 숙소를 구분한다.
- 가용성은 1/3/7박, 정원과 동일한 인원/최소 인원/초과 인원, 날짜별 OPEN/CLOSED·판매 수량 0·
  미생성(행 없음), 객실 비활성·숙소 비활성, `size=4/16`과 shallow/deep offset을 검증한다.
  유효 7박의 checkout 당일 CLOSED는 해당 객실을 제외하지 않는다. 부족은 판매 수량 0인 테스트 행으로
  모델링하며 실제 선행 유효 예약에 의한 재고 점유와는 구분한다. 기대 결과에서 ID 순서·전체 count·
  페이지 메타데이터, ACTIVE, 부모·정원·기본가(override 미적용)를 확인한다.
- `Pacific/Pago_Pago`와 `Pacific/Kiritimati`의 현지 날짜를 **동일 시각**에서 계산한다. 서쪽 숙소의
  체크인 날짜가 최소 advance day가 되게 동일 정책을 저장한다. 같은 체크인을 동쪽에서 조회하면
  `409 BOOKING_POLICY_007`이어야 한다. 최대값 당일과 초과, 최소/최대 숙박일도 별도 확인한다.
  실행 중 현지 날짜가 바뀌면 해당 run은 실패한다. 테스트를 위해 Backend 시계를 바꾸지 않는다.
- 단일 날짜 요금은 `DAILY`의 정확한 override ID·금액 또는 `DEFAULT`의 null ID·기본가를 확인한다.
  여러 객실/날짜와 비활성 숙소의 일별 요금도 읽는다. 여정은 실제 가용 페이지의 첫 객실 ID로
  첫 두 날짜의 요금 GET을 순차 실행한다(1 iteration = 3 HTTP). 전체 체류의 합계나 예약을 하지 않는다.
- 잘못된 날짜/인원(`400`), 없는 숙소/객실(`404`), 정책 거절(`409`)은 순차 제어 사례로 별도
  기록·검증한다. 정상 부하 평균에서 제외하되 상태·코드·지연은 `stay-fixture.json`에 남긴다.

## 부하와 SQL 수집

| 구간 | 명목 제공률 | 분포 |
| --- | --- | --- |
| low | 1 iteration/s × 8s, 최대 1 VU | 조건 순회 |
| popular | 2 iteration/s × 6s, 최대 2 VU | 인기 숙소 3박 또는 동일 객실 2개 날짜 반복 |
| dispersed | 2 iteration/s × 6s, 최대 2 VU | 숙소·날짜·인원·페이지/객실·날짜 분산 |
| steady | 3 iteration/s × 8s, 최대 3 VU | 분산 조건 유지 |

순차 smoke/계약 확인은 측정 전이며 개방형 구간 사이에 2초 간격을 둔다. 독립 모드의 iteration당
HTTP는 1건, 여정은 3건이다. [k6 부하 모델](https://grafana.com/docs/k6/latest/using-k6/scenarios/concepts/open-vs-closed/)과
[HTTP 메트릭 정의](https://grafana.com/docs/k6/latest/using-k6/metrics/reference/)에 따라 RPS와
iteration을 구분한다. 부족/drop/정합성 오류는 실패이며 종료 경계의 추가 1회는 따로 기록한다.

- `stay-fixture.json`, `stay-outcomes.json`: 분포·지문·시간대 정책값과 페이지 건수, 제어 사례, DAILY/DEFAULT 수.
- `summary.json`, `raw.jsonl`: 단계·응답 종류별 완료 수/실제 RPS/p50/p95/p99, 오류·timeout/drop.
- `stay-sql.json`과 `observations.jsonl`: MySQL Performance Schema digest의 호출/누적 ps/검사 행,
  InnoDB 읽기 delta 및 별도로 샘플링한 Docker/DB/JVM/Hikari 사용량. seed·사전 검증 이후라 버퍼는
  warm 상태이며 완전히 안정된 JVM이나 실제 처리 한계를 보장하지 않는다.
- `stay-plans.json`: 부하 종료 이후에만 대표 HTTP 요청을 1회 재실행해 실제 바인딩 SQL 및
  해당 요청의 digest delta를 수집한다. [MySQL EXPLAIN ANALYZE](https://dev.mysql.com/doc/refman/8.4/en/explain.html)의
  조사 행/loops와 분리된 단일 실행 시간을 보며, 그 비용은 본 HTTP/SQL 측정에 포함되지 않는다.
- `stay-readonly.json`: 두 모드와 여정 모두 숙소·정책·객실·재고·요금 5개 테이블 CHECKSUM을
  측정 전/후 대조하고 #342의 예약·재고·가격 스냅샷·이벤트 검증도 통과해야 성공이다.

산출물은 Git 제외 `.local/load-test/<run-id>/results`에 남기며 요청/응답 본문, 토큰 또는 운영 데이터를 공유하지 않는다.

## 실측 환경 — 2026-11-25 (JST, UTC+09:00)

- `develop` `2911cea`에서 분기, 측정 코드 `cb28890794011f16aa9a0455afaed408b08e77b5`.
  Boot JAR SHA-256 `b1480bccd8eb738abf4f5c198285e6f548fc8ef0386da6c92e5db82f194f0fb1`.
  manifest의 하네스 SHA와 전체 이미지 ID·시각을 보관한다.
- Windows x64/CPU 24/15.7GiB, Docker Desktop Linux 29.7.2/CPU 24/7.6GiB, Compose 5.5.0,
  Node 24.14.0, k6 2.0.0. MySQL 8.4.11, Redis 7.4.10(영속화 없음), Kafka 4.3.1(단일 브로커,
  3 파티션), Temurin 21.0.13.1. 이미지 ID 앞자리(MySQL/Redis/Kafka/Java/fixture/k6):
  `b3b90af2a655` / `e9b2e45ecd47` / `77e3df905404` / `8ad118b146aa` / `7fddd9ddeae8` / `a33a0cfdc4d24`.
- Backend 2 CPU/1536MiB, JVM `-Xms256m -Xmx512m`, Hikari 최대 10. MySQL 2 CPU/1536MiB,
  Redis 0.5 CPU/320MiB, Kafka 1 CPU/1024MiB, k6 1 CPU/320MiB. 동일 호스트의 소규모 비교다.
- `--seed=345 --stay=2026-12-30 --cache=off`. 서쪽/동쪽 숙소의 당시 현지 날짜는 11월 24일/25일,
  저장된 advance 범위는 36–37일이었다. 서쪽에서 12월 30일·31일은 각각 최소/최대 당일,
  동쪽에서는 12월 30일이 35일 전이라 실패했다. 기본 시드의 숙소 시간대는 서울/뉴욕이다.

### 데이터 규모와 결과 건수

| 데이터 | small | expanded |
| --- | ---: | ---: |
| 전체 숙소 / 객실 / 재고 행 (기본 시드 포함) | 13 / 104 / 820 | 13 / 272 / 2,290 |
| 추가 인기 / 분산 / 경계 두 숙소 / 비활성 숙소 객실 수 | 40 / 16 / 16 / 8 | 160 / 64 / 16 / 8 |
| 추가 재고 OPEN·여유 / CLOSED / OPEN·판매 0 / 미생성 | 670 / 20 / 10 / 20 | 2,077 / 62 / 31 / 62 |
| 추가 daily override / 조회 가능한 날짜 슬롯(객실×9) | 100 / 720 | 310 / 2,232 |
| 인기 숙소 총 가용 1 / 3 / 7박 (`guestCount=4`) | 30 / 15 / 10 | 120 / 60 / 40 |
| 무정책 숙소 3박 가용 (`guestCount=2`) | 8 | 32 |
| 1박 깊은 offset / 페이지 반환 수 (`size=4`) | 24 / 4 | 116 / 4 |

가격 override 밀도는 두 규모 모두 약 13.9%다. 부하의 DAILY/DEFAULT 비율은 반반에 가까운
테스트 조건 믹스로, 테이블 밀도나 실제 사용자 분포가 아니다. 초과 인원 및 비활성 숙소는 빈 200이었다.
별도 제어 9건은 `400` (`ROOM_002`, `COMMON_001`, `COMMON_002`), `404` (`ACCOMMODATION_001`,
`ROOM_001`), `409` (`BOOKING_POLICY_005/006/007/008`)를 전후 모두 확인했다.

### 독립 HTTP 결과

| 실행 | run ID | 측정 시작 JST | HTTP n; p50 / p95 / p99(ms) | 전체 RPS | low / popular / dispersed / steady RPS | 완료 iterations |
| --- | --- | --- | --- | ---: | --- | --- |
| 가용 객실 / small | `82f0015e1823df15d6814fc6` | 17:38:17 | 60; 13.87 / 18.51 / 19.54 | 1.76 | 1.13 / 2.17 / 2.17 / 3.13 | 9 / 13 / 13 / 25 |
| 가용 객실 / expanded | `e36e9f29ac0bdab154f72892` | 17:42:08 | 59; 45.24 / 77.94 / 84.01 | 1.74 | 1.00 / 2.17 / 2.17 / 3.13 | 8 / 13 / 13 / 25 |
| 일별 요금 / small | `e92bf3c1e67aacb4cc2225f8` | 17:40:17 | 59; 4.89 / 6.79 / 7.65 | 1.75 | 1.13 / 2.17 / 2.17 / 3.00 | 9 / 13 / 13 / 24 |
| 일별 요금 / expanded | `ca343b7db61ebfd73f5b01bc` | 17:44:12 | 59; 4.82 / 5.63 / 8.65 | 1.74 | 1.13 / 2.17 / 2.00 / 3.13 | 9 / 13 / 12 / 25 |

명목 계획은 `8 / 12 / 12 / 24` iterations다. 단계 RPS 분모는 계획 시간, 전체 RPS는 첫~마지막
HTTP 완료 간격(단계 사이 간격 포함)이다. p99는 대부분 짧은 표본의 최대값이며 운영 SLO가 아니다.
가격은 small/expanded 각 59건(`DAILY` 31 + `DEFAULT` 28)이었고, 가격과 가용 응답은 모두 200이었다.

조건별 표는 `n; p50 / p95 / p99(ms)`다. raw 요약은 단계별 건수·RPS·결과 코드도 함께 보존한다.

| 조건 | small | expanded |
| --- | --- | --- |
| `availability.short_hot` | 6; 13.57 / 14.50 / 14.50 | 6; 45.78 / 51.50 / 51.50 |
| `availability.medium_hot` | 19; 14.20 / 18.51 / 18.51 | 19; 45.69 / 48.10 / 48.10 |
| `availability.long_hot` | 5; 14.98 / 16.43 / 16.43 | 5; 47.97 / 50.81 / 50.81 |
| `availability.wide_hot` | 4; 15.54 / 16.29 / 16.29 | 4; 49.21 / 51.62 / 51.62 |
| `availability.deep_hot` | 4; 18.85 / 19.54 / 19.54 | 4; 77.94 / 84.01 / 84.01 |
| `availability.spread` | 4; 13.88 / 14.70 / 14.70 | 4; 29.68 / 30.15 / 30.15 |
| `availability.guest_one` | 4; 12.77 / 13.49 / 13.49 | 4; 26.81 / 28.73 / 28.73 |
| `availability.empty_guests` | 4; 6.41 / 6.79 / 6.79 | 4; 6.02 / 6.62 / 6.62 |
| `availability.inactive` | 4; 6.23 / 6.70 / 6.70 | 3; 5.32 / 5.49 / 5.49 |
| `availability.zone_min` | 3; 8.57 / 8.99 / 8.99 | 3; 9.76 / 10.01 / 10.01 |
| `availability.zone_max` | 3; 9.50 / 9.97 / 9.97 | 3; 9.43 / 11.18 / 11.18 |
| `price.hot_daily` | 14; 5.14 / 7.06 / 7.06 | 15; 5.29 / 5.83 / 5.83 |
| `price.hot_default` | 12; 4.63 / 5.13 / 5.13 | 12; 4.51 / 8.65 / 8.65 |
| `price.spread_daily` | 6; 5.23 / 6.02 / 6.02 | 6; 4.60 / 5.22 / 5.22 |
| `price.spread_default` | 6; 4.31 / 5.03 / 5.03 | 6; 4.53 / 5.17 / 5.17 |
| `price.spread_late` | 6; 4.91 / 5.30 / 5.30 | 5; 5.02 / 5.44 / 5.44 |
| `price.other_default` | 5; 5.54 / 7.65 / 7.65 | 5; 4.55 / 5.08 / 5.08 |
| `price.spread_no_override` | 5; 4.84 / 5.14 / 5.14 | 5; 4.56 / 4.89 / 4.89 |
| `price.inactive_daily` | 5; 5.09 / 5.79 / 5.79 | 5; 4.47 / 4.95 / 4.95 |

### SQL과 자원

SQL 표의 각 셀은 `호출 / 누적 ms / 조사 행`이다. 정책 SELECT는 설정이 없는 숙소에서도
해당 행 유무를 확인한다. count는 페이지가 짧거나 비면 생략될 수 있어 본문 호출과 분리한다.

| 실행 | 가용 본문 | 가용 count | 숙소 PK | 정책 | 객실 PK | 날짜별 요금 |
| --- | --- | --- | --- | --- | --- | --- |
| 가용 객실 / small | 60 / 64.79 / 398,398 | 46 / 135.18 / 1,028,082 | 60 / 8.93 / 60 | 60 / 6.82 / 48 | — | — |
| 가용 객실 / expanded | 59 / 247.98 / 1,954,916 | 46 / 1381.92 / 11,474,088 | 59 / 8.95 / 59 | 59 / 6.16 / 48 | — | — |
| 일별 요금 / small | — | — | — | — | 59 / 9.00 / 59 | 59 / 8.01 / 31 |
| 일별 요금 / expanded | — | — | — | — | 59 / 8.58 / 59 | 59 / 7.26 / 31 |

| 실행 | CPU 샘플 최대 DB / Backend / k6 (%) | 메모리 샘플 최대 DB / Backend / k6 | InnoDB 논리 읽기 증가 |
| --- | --- | --- | ---: |
| 가용 객실 / small | 4.81 / 11.63 / 0.93 | 470.1MiB / 520.1MiB / 13.01MiB | 32,031 |
| 가용 객실 / expanded | 7.84 / 7.52 / 0.72 | 462.2MiB / 497.7MiB / 12.58MiB | 149,246 |
| 일별 요금 / small | 3.95 / 3.86 / 0.67 | 466.7MiB / 477.6MiB / 12.64MiB | 924 |
| 일별 요금 / expanded | 2.19 / 2.73 / 0.67 | 466.9MiB / 484.6MiB / 12.86MiB | 1,180 |

정상 독립 실행은 5~6회 관측했다. 두 expanded 실행에서 Docker 통계 1회씩 미수집이었다.
Hikari pending은 관측상 0, InnoDB 물리 읽기/버퍼 miss 증가도 0이었다. Docker Block I/O는
누적 값(시드 포함)으로 별도 남긴다. CPU/Pool 표는 짧은 샘플이며 순간 포화 부재를 보장하지 않는다.

### 대표 계획: 본문과 count

실제 7박 SQL에는 `accommodation_id=3001`, `capacity>=4`, 상태 두 곳의 `ACTIVE`, 재고 `OPEN` 및
`reserved_quantity<total_quantity`, `inventory_date >= '2026-12-30' AND inventory_date < '2027-01-06'`,
상관 재고 COUNT `=7`이 있었다. 요금 SQL은 객실 PK와 `(room_id, stay_date)` 두 조건 조회다.
가용 본문은 ID 순, 예약 정책은 앞선 별도 조회에서 평가한다.

| 동일 케이스 | small 재고 노드 행×loops (본문 / count) | expanded 재고 노드 행×loops (본문 / count) | small SQL ms (본문 / count) | expanded SQL ms (본문 / count) |
| --- | --- | --- | --- | --- |
| 1박 첫 페이지 | 820×4 / 820×30 | 2290×4 / 2290×120 | 0.68 / 3.46 | 1.54 / 31.91 |
| 3박 첫 페이지 | 820×7 / 820×30 | 2290×7 / 2290×120 | 1.07 / 3.12 | 2.18 / 32.05 |
| 7박 첫 페이지 | 820×12 / 820×30 | 2290×12 / 2290×120 | 1.38 / 3.04 | 3.56 / 33.17 |
| 1박 size=16 | 820×16 / 820×30 | 2290×16 / 2290×120 | 2.00 / 3.28 | 4.43 / 31.98 |
| 1박 깊은 페이지 | 820×28 / 820×30 | 2290×120 / 2290×120 | 2.96 / 3.04 | 31.87 / 31.78 |
| 3박 분산 숙소 | 820×7 / 820×14 | 2290×7 / 2290×56 | 0.92 / 1.58 | 2.08 / 14.77 |

본문·count 모두 객실 `idx_rooms_accommodation_status_id`로 숙소·상태를 찾았다. 이 시드에서는
`uk_room_inventories_room_date` 대신 재고 테이블 스캔을 골랐다. 검토용 단일 요청의 SQL 타이머는
진단 구간의 값이며 위 HTTP 지연에 더하는 값이 아니다. 짧은 첫 페이지의 count도 모든 후보를
다시 평가했고, 깊은 offset은 본문의 평가 횟수까지 키웠다. 7박은 1박보다 통과 후보가 적어 같은
4개 결과를 모으는 데 더 많은 후보를 검사했다. count의 평가 횟수는 인기 숙소에서 30/120으로 같았다.

요금의 대표 계획은 `DAILY`에서는 상수 조회 1행, `DEFAULT`에서는 일치 행 0이었다. 두 규모 모두
한 요청에 객실 1회와 날짜별 요금 1회로 유지됐다. 결과 없는 경로도 두 번째 SQL 자체를 생략하지 않았다.

### 별도 여정과 정합성

확대 여정은 `1d3f59ca7bd92b18b1812688`(`17:46:10~17:46:50 JST`)에서 58 iterations를
완료했다(`8 / 13 / 13 / 24`). 독립 부하와 섞지 않은 실제 174 HTTP는 가용 58 + 요금 116
(`DAILY` 58 + `DEFAULT` 58)이다. 전체 HTTP RPS는 5.17, 단계별은 `3.00 / 6.50 / 6.50 / 9.00`이었다.

| 여정 HTTP | n; p50 / p95 / p99(ms) | 본문 또는 가격 SQL |
| --- | --- | --- |
| 가용 객실 | 58; 44.38 / 49.64 / 68.46 | 본문 58회·127.45ms / count 58회·1,524.90ms |
| 일별 적용 요금 | 116; 3.93 / 5.18 / 7.18 | 객실 116회·15.00ms / 날짜별 요금 116회·13.62ms |

여정의 리소스 6회 관측 중 Docker 1회 미수집. DB/Backend/k6 CPU 최대 샘플은
13.39%/14.77%/1.16%, 메모리는 462.7/485.6/12.81MiB, Hikari pending 최대 0,
InnoDB 논리 읽기 149,759 / 물리 읽기 0 증가였다. 이 여정은 3개의 HTTP 요청 지표이며
전체 체류 요금·예약 성능이나 여정 전체 지연의 HTTP 백분위가 아니다.

독립 237건과 여정 174건을 합친 **411 HTTP**가 모두 200이었다. drop·timeout·전송 오류는
0건이고, 가용·가격 응답 조건과 모든 실행의 5개 테이블 체크섬 및 예약/재고/가격/이벤트 회계가
일치했다. 제어 사례는 위 411건에 포함되지 않는다. 모든 전용 스택을 정리했다.

### #348에 넘길 근거

1. **가용 count의 반복 재고 접근이 우선이다.** 확대 독립 가용 p95는 18.51 → 77.94ms.
   두 규모의 count 46회는 동일했지만 조사 행은 약 103만 → 1,147만으로 증가했다. 기존 객실
   인덱스와 실제 재고 스캔을 분리해, 동일 조건에서 재고 접근 방식이나 COUNT 범위를 하나씩 비교한다.
   `[check-in, check-out)` 및 전 날짜 OPEN·판매 가능 조건과 정확한 total 계약을 유지한다.
2. **offset/페이지 크기는 본문을 별도로 압박한다.** 1박의 4개 결과를 위해 expanded shallow는
   4개, 깊은 페이지는 120개 후보의 재고를 조회했다. 분산·인기, 1/3/7박과 count를 섞지 않고
   같은 시드·조건·페이지로 재측정한다. 이 이슈에서 API나 pagination 전략을 변경하지 않는다.
3. **일별 요금은 별도 기준선으로 유지한다.** 두 규모 및 `DAILY`/`DEFAULT` 모두 2 SELECT/요청.
   현재 결과만으로 새 가격 API·캐시·색인을 권고하지 않는다. [후속 #348](https://github.com/K4RF/reservation-platform/issues/348)에서
   단일 후보 변경, HTTP/SQL, 응답 계약과 체크섬의 보존을 함께 비교한다.
