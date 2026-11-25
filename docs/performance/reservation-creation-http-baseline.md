# 예약 생성·날짜별 재고 정합성 HTTP Baseline (#346)

[#342 격리 러너](../../load-test/README.md)로 현재 [hybrid 전략](../adr/006-reservation-concurrency-strategy.md)을
제품 Boot JAR에서 검증한다. Room Redisson Lock → 비트랜잭션 Retry → 새 생성 트랜잭션의 순서는
바꾸지 않았다. 기본 대기 3초·고정 lease 30초·낙관적 충돌만 최초 포함 최대 3시도다.
새 전략, lease 변경, 자동 HTTP 재시도, 일정 변경·취소, 운영 부하를 구현하거나 측정하지 않는다.

## 재현과 안전 경계

Java 21과 Docker Desktop Linux 엔진을 준비한 뒤 저장소 루트에서 하나씩 실행한다.

```powershell
Push-Location backend
.\gradlew.bat build
Pop-Location
node --test load-test/*.test.mjs
$stay = (Get-Date).AddDays(35).ToString('yyyy-MM-dd')
node load-test/run.mjs prepare --confirm=isolated --seed=346 "--stay=$stay" --profile=create-exhaustion --cache=off --room=hot
node load-test/run.mjs run <run-id> --confirm=<run-id>
node load-test/run.mjs cleanup <run-id> --confirm=<run-id>
```

`create-hot`, `create-redis-down`, `create-peer`도 `--room=hot`; `create-distributed`만
`--room=distributed`다. 각 실행은 새 manifest, 전용 DB/Redis/Kafka/볼륨, 내부 네트워크만 사용한다.
기존 개발·운영 주소나 다른 키/컨테이너를 선택할 수 없다. 실패 시 스택과 자료를 그대로 둔다.
소유권을 확인한 뒤 명시적 stop/cleanup을 쓰며 실패한 POST를 해당 run에서 다시 보내지 않는다.

- #342 기본 8숙소·24객실·120재고·4확정 예약에 USER 12명(ADMIN 별도)을 준비한다. 기초 순차
  생성·읽기/소유권 smoke, 초기 Outbox drain, synthetic seed 증량은 측정 전이다. 부하 VU는 서로 다른
  소유자만 사용한다. 해당 모드의 대상 객실만 날짜별 판매량을 한 번 초기화하며 부하 중 변경하지 않는다.
- 넉넉한 모드는 대상 객실의 5개 날짜 각각 `total=96/reserved=0`, 기본 가격과 첫날 override를
  사용한다. hot은 모든 구간에 한 방, 분산은 VU별 다른 방(최대 12실)을 쓴다.
- 소진은 2박 첫날 4/둘째 날 1(`reserved=0`)에 4 VU가 1회씩 시작한다. 정상 기대로는 1건이
  두 날을 모두 점유하고 3건은 `409 INVENTORY_005`; 첫날을 추가 점유하거나 night/event를 남기면 실패다.
- Redis 장애는 정상 측정과 분리해 **해당 run Redis만** 요청 전에 중단한다. 한 번의 POST에서
  `503 INVENTORY_013`을 기대하되 DB를 따로 확인한다. `finally`로 같은 컨테이너를 시작하고
  health 검증한다. 커밋 후 unlock 오류 강제 주입이나 lease 만료는 이 프로필이 아니다.
- 선택적 `create-peer`는 Docker 엔진 6 CPU/7GiB 최소 조건을 확인한다. 같은 Boot JAR와 이미지로
  primary 기동/스키마 완료 후 peer를 시작하며, 두 내부 호스트에 4 VU를 나눈다. 단일 DB/Redis와
  Kafka consumer group을 공유하는 **동일 객실 4건**의 한정 검증이지 클러스터 용량 비교가 아니다.

## 부하와 검증

| 단계 | 계획 | 기간 |
| --- | --- | --- |
| low | 1 iter/s × 6초, 1 VU | 동일 1박 |
| shared | 2 iter/s × 5초, 2 VU | 동일 2박 |
| overlap | 3 VU 동시 1회씩, 5초 상한 | 하루가 겹치는 두 2박 구간 |
| disjoint | 3 VU 동시 1회씩, 5초 상한 | 겹치지 않는 1박/2박 구간 |
| steady | 3 iter/s × 8초, 3 VU | 해당 모드 2/3박 |

iteration당 HTTP 1건이며 정상 모드의 명목 수는 `6 / 10 / 3 / 3 / 24`다. 개방형 단계만 종료
경계 1회 초과를 허용하며, 도착 부족/drop은 실패다. 닫힌 burst의 RPS는 정상 지속률로 보지 않는다.
[k6 HTTP 지연·오류 지표](https://grafana.com/docs/k6/latest/using-k6/metrics/reference/)에는
예상 409/503도 원래 HTTP 오류로 남기고 정상 201/예상·기타 오류를 따로 분류한다.

### 원장과 DB 대조

- `creation-ledger.jsonl`의 전송/응답은 run 내부 순번·시각·상태/코드·확인된 예약 ID만
  남긴다. 순번은 합성 예약에 넣은 숫자 표식과 대조하며 k6 태그에 둘 수 없다. 토큰·투숙객 값·
  원시 본문은 결과에 저장하지 않는다.
- 서버 처리가 끝나길 제한 시간 동안 기다리고 Outbox·Consumer drain 후 **초기 예약 watermark** 이후
  모든 새 예약을 찾는다. 레코드를 작성하지 않았다고 가정해 재전송하지 않는다. 2xx와 DB 예약 ID 불일치,
  고아 기록·중복 순번, 예상 거절과 실제 커밋 불일치는 실패다. 커밋 행을 찾으면 실패 응답도
  커밋으로 기록하며, 서버 완료 확인도 없고 행도 없는 요청은 미해결로 남긴다.
- 각 확정 예약의 소유자/객실/정원·기간, `[check-in, check-out)`의 정확한 nights/적용 요금·첫날
  스냅샷·합계, 유일한 PUBLISHED `RESERVATION_CREATED` Outbox와 Consumer 처리 결과를 확인한다.
  초기 점유 + 새 확정 예약 점유와 현재 reserved/version을 날짜별 대조한다. 대상 밖의 기존 행도
  포함해 `0 ≤ reserved ≤ total`, 초기 total/상태 유지와 기존 #342 DB 불변식을 검증한다.

### 관측 해석

- `summary.json`/k6 원시 샘플: HTTP 건수·실제 RPS·p50/p95/p99·도메인 코드·drop/timeout.
  DB CONFIRMED/초는 대조된 신규 DB 행 수를 동일 관측 구간에 나눈 값(직접 커밋 타이머가 아님)이다.
- `creation-server.json`: 격리 Backend에서만 전용 TRACE를 켠다. lock 대기는 `tryLock` 호출
  시간, 보유는 성공 반환에서 소유권 확인·해제 시도 반환까지다. 트랜잭션 시간은 Spring proxy
  호출 전체(시작·business·commit/rollback)다. 이 수치에 logging 오버헤드가 포함될 수 있다.
  보유 시간 초과/해제 미완료는 이상으로 표시하되 lease 만료를 강제 재현한 증거는 아니다.
- `creation-reconciliation.json`, `verification.json`, `observations.jsonl`: 전송·DB 결과/날짜별
  불변식, Outbox·Consumer 및 DB row-lock 대기, Docker CPU/메모리/Pool. 엔진 누적 DB 락 수는
  동일 구간의 인프라 관측으로, 특정 HTTP 요청이나 재시도의 원인으로 추정하지 않는다.

산출물은 Git 제외 `.local/load-test/<run-id>/results`에 둔다. 운영 SLO나 포화 TPS가 아니다.

## 실측 환경 — 2026-11-25 (JST, UTC+09:00)

- 원격 `develop` `cfbb0e5` 기반, 측정 코드 `995273d33ae1b01c9dbf39123e65ff7ccdbf118c`(준비 시 변경 없음).
  Boot JAR SHA-256 `9d7846fc16c945df4c19095527c56455da79f9c6e29fa24f693c39c4d4b2542d`; 전체 하네스·이미지 ID와 UTC 시작/종료는 manifest에 보관한다.
- Windows x64 CPU 24 / 15.7GiB, Docker Desktop Linux 29.7.2 CPU 24 / 7.6GiB, Compose 5.5.0.
  Node 24.14.0, Temurin 21.0.13.1, k6 2.0.0, MySQL 8.4.11, Redis 7.4.10(영속화 없음),
  Redisson 4.7.0, Kafka 4.3.1(단일 브로커, 3 파티션). 이미지 ID 앞자리 순서:
  MySQL `b3b90af2a655` / Redis `e9b2e45ecd47` / Kafka `77e3df905404` / Temurin `8ad118b146aa` /
  fixture `7fddd9ddeae8` / k6 `a33a0cfdc4d24`.
- MySQL·Backend 각 2 CPU/1536MiB, Backend heap 256–512MiB/Hikari 최대 10; Redis 0.5 CPU/320MiB,
  Kafka 1 CPU/1024MiB, k6 1 CPU/320MiB. peer도 같은 Backend 예산을 쓴다.
- `--seed=346 --stay=2026-12-30 --cache=off`; 숙소 시간대 서울/뉴욕. Outbox Publisher와 Kafka
  Consumer는 활성 상태이며, 고정 wait/lease와 retry 값을 실험 중에 바꾸지 않았다.

### 정상 hot / 분산

| 모드 | run ID / 시작~끝 JST | HTTP n; p50 / p95 / p99 (ms) | HTTP RPS | 신규 DB 확정/초 |
| --- | --- | --- | ---: | ---: |
| hot | `a073739aff0630830a16ef01` / 19:21:37~19:22:17 | 48; 23.33 / 62.64 / 94.02 | 1.30 | 1.30 |
| distributed | `1565423e9739a371ab5ef894` / 19:23:24~19:24:06 | 48; 24.00 / 47.29 / 49.07 | 1.31 | 1.31 |

두 모드 모두 48건의 201과 DB 확정 48건이 일치했다. 전체 HTTP RPS는 첫~마지막 HTTP 완료 간격,
DB 확정/초는 원장 첫 전송~마지막 응답 간격으로 나눈 값이라 단계 사이 공백을 포함한다.
아래 표는 `n; p50 / p95 / p99(ms)`이며 닫힌 두 구간의 표본은 각각 3건이다.

| 단계 | hot | 분산 | hot / 분산 열린 구간 실제 RPS |
| --- | --- | --- | --- |
| low | 6; 22.03 / 28.52 / 28.52 | 7; 24.39 / 32.98 / 32.98 | 1.00 / 1.17 |
| shared | 11; 22.48 / 28.32 / 28.32 | 11; 24.66 / 34.09 / 34.09 | 2.20 / 2.20 |
| overlap | 3; 74.70 / 94.02 / 94.02 | 3; 31.05 / 31.14 / 31.14 | 닫힌 burst |
| disjoint | 3; 46.70 / 62.64 / 62.64 | 3; 48.48 / 49.07 / 49.07 | 닫힌 burst |
| steady | 25; 22.44 / 28.33 / 30.89 | 24; 22.32 / 33.69 / 45.35 | 3.13 / 3.00 |

같은 방의 날짜가 달라도 Lock 키에는 날짜가 없다. 실제로 겹침·분리 구간 둘 다 같은 객실에
동시에 도착시키고 DB 결과를 확인했다. 소표본과 단일 호스트의 상호 간섭 때문에 두 구간
사이 지연만으로 날짜 효과나 처리 용량의 일반 법칙을 만들지 않는다.

### 소진과 두 Backend

- 소진 `330536af402be89fdb80fcf0`(19:20:28 JST): 201 1건(24.50ms),
  `409 INVENTORY_005` 3건(p95 56.84ms), DB 확정 1건. HTTP 오류율은 75%이며 예상 거절이다.
  12월 30일은 `4/1/3`, 31일은 `1/1/0`(total/reserved/available). 다음 3일은 `1/0/1`로
  바뀌지 않았고, 거절 세 건의 예약/night/Outbox는 없었다.
- 두 Backend `a32576ae54269e18eb899f6e`(19:25:31 JST): 201 4건, 두 Backend에서 각각 2건 처리를
  확인했다. HTTP p50/p95/p99 56.00/356.22/356.22ms, 새로운 확정 예약 4건. 보유한
  Redis Lock은 모두 해제됐다. 테스트는 복제 두 개가 같은 방과 기간을 처리할 수 있는지 확인한
  것이지, 단일 인스턴스 대비 속도/처리량 개선을 측정한 실험이 아니다.

### 서버 측 지연과 자원

측정값은 `n; p50 / p95 / p99 / 최대 (ms)`다. p95/p99는 짧은 표본에서 최대값에 가까울 수 있다.
기다림과 트랜잭션을 독립적으로 관측했으므로 HTTP 시간과 단순 합산하지 않는다.

| 모드 | Lock 대기 | Lock 보유 | 생성 트랜잭션 시도 |
| --- | --- | --- | --- |
| hot | 48; 0.76 / 42.56 / 74.86 / 74.86 | 48; 18.98 / 24.09 / 44.47 / 44.47 | 48; 17.31 / 22.64 / 43.07 / 43.07 |
| distributed | 48; 0.82 / 1.01 / 1.12 / 1.12 | 48; 19.57 / 43.53 / 45.53 / 45.53 | 48; 18.07 / 41.69 / 44.21 / 44.21 |
| exhaustion | 4; 23.73 / 45.52 / 45.52 / 45.52 | 4; 8.20 / 20.26 / 20.26 / 20.26 | 4; 6.44 / 18.77 / 18.77 / 18.77 |
| peer | 4; 15.37 / 241.68 / 241.68 / 241.68 | 4; 26.47 / 219.93 / 219.93 / 219.93 | 4; 24.26 / 211.60 / 211.60 / 211.60 |

hot/분산 6회씩 관측에서 Hikari pending은 0이었다. MySQL row-lock 누적 count/시간(ms) delta는
hot 3/18, 분산 2/31; 다른 트랜잭션도 포함되므로 예약별 대기나 JPA 충돌로 동일시하지 않는다.

| 모드 | DB / Backend / k6 최대 CPU 샘플 (%) | DB / Backend / k6 최대 메모리 샘플 | Outbox drain (ms) |
| --- | --- | --- | ---: |
| hot | 5.23 / 17.54 / 0.81 | 459.8MiB / 486.2MiB / 13.2MiB | 2332 |
| distributed | 4.94 / 11.28 / 0.79 | 460.2MiB / 494.4MiB / 13.07MiB | 2996 |

소진·peer는 짧아서 부하 중 Docker 스냅샷이 없었다. 준비/사후 값과 서버 타이머를
기록했지만 그 값을 부하 중 peak로 사용하지 않았다.

### 초기 러너 보정

초기 검증에서 k6 성공 응답 검증기 import가 빠져 201을 원장에 기록하지 못했다. DB 대조는
확정 행을 찾았지만 해당 실행은 성능 표본에서 제외했다. 검증기 연결 및 누락을 실패로 처리하도록
보강한 후에만 새 스택에서 다시 검증했고 기존 POST는 재전송하지 않았다.

### Redis 중단, DB 대조와 남은 한계

별도 `aa25c773fbb372449beb47f1`(19:26:45~19:26:56 JST)에서 유일한 POST는 **4,851.02ms**에
`503 INVENTORY_013`을 반환했다. `tryLock` 4,837.92ms, 획득·보유·생성 트랜잭션 0건이었고
신규 예약·inventory/Version 변경·night/Outbox는 없었다. HTTP 오류율 100%(1/1)인 의도된
장애 검증이다. 정상 도착률이나 비정상 시 HTTP 3초 상한을 보여 주는 값이 아니다. Redis 복구의
health와 Outbox/Consumer lag 0을 확인했고 요청을 또 보내지는 않았다.

최종 **105개 시도** 중 201과 신규 확정은 모두 101건, `INVENTORY_005` 3건, `INVENTORY_013` 1건이다.
drop·transport·timeout 및 미확정/미해결은 0이었다. 신규 확정의 박별 값과 합계·Created Outbox,
모든 날짜의 reserved/Version 및 초기 데이터까지 포함한 COUNT 정합성이 일치했다. lease 초과,
해제 불완료, `INVENTORY_011/012`, 낙관적 충돌/추가 시도는 관측되지 않았다. 이를 강제로 재현하거나
실제 최대치가 없음을 입증한 결과는 아니다. 소유권 확인 후 전용 스택만 정리했고, 실행 전후 그 밖의
개발 컨테이너/볼륨 식별자가 같은 것을 확인했다.

### #348에 넘길 근거

1. 48건씩의 hot/분산에서 Lock 대기 p95 42.56/1.01ms, HTTP p95 62.64/47.29ms였다. 같은 방의
   비겹침 요청까지 같은 Room Lock을 넘는 점을 별도 조건으로 유지하고, 고정된 시드와 반복된
   동시 시작에서 대기·보유·트랜잭션·Outbox를 따로 본다. 현 자료로 전략 변경을 권고하지 않는다.
2. Redis 사전 중단에서 트랜잭션 없이 실패했다. 커밋 이후 해제 실패의 HTTP/DB 해석은 별개다.
   실제로 그 경로를 실험할 때도 같은 원장 대조를 써서 실패 HTTP를 곧바로 미생성으로 취급하지 않는다.
3. 2 Backend는 4회 한정 검증만 했다. [후속 #348](https://github.com/K4RF/reservation-platform/issues/348)에서
   비교가 필요하면 Backend 수와 도착률을 동시에 바꾸지 않고, 검증을 먼저 통과한 뒤 부하 상한을 조절한다.
