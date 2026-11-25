# 숙소·객실 상세 HTTP Redis Cache Baseline (#344)

[#342 격리 러너](../../load-test/README.md)로 제품 Boot JAR의 **공개 상세 JSON**을 비교한다.
제품 코드, Cache 정책, 인덱스, CI 설정은 변경하지 않았다. 이미지 바이너리, Vite/브라우저, 운영 DB,
다중 Backend 복제, 최대 용량 및 운영 SLO 실험이 아니다. [기존 서비스 호출 비교](query-cache-optimization-comparison.md)와 구분한다.

## 재현

Java 21/Gradle Wrapper로 Boot JAR를 준비하고 Docker Linux 엔진을 실행한다. 저장소 루트에서
아래 순서로 실행한다. 이전 스택 정리 후 다음 준비를 실행하며, `prepare`가 출력한 자기 ID만 사용한다.

```powershell
Push-Location backend
.\gradlew.bat bootJar
Pop-Location
node --test load-test/*.test.mjs
$stay = (Get-Date).AddDays(35).ToString('yyyy-MM-dd')
node load-test/run.mjs prepare --confirm=isolated --seed=344 "--stay=$stay" --profile=detail-reads --cache=cold
node load-test/run.mjs run <run-id> --confirm=<run-id>
node load-test/run.mjs cleanup <run-id> --confirm=<run-id>
```

- 같은 `detail-reads`를 `--cache=off` 및 `--cache=warm`으로 새로 준비한다. 대상 8개 키를 HTTP로
  사전 검증해 JVM/SQL을 데운 뒤, off는 키 없음, warm은 유효 PTTL, cold는 대상 키만 한 번
  제거하고 부재를 검증한다. cold는 JVM/DB가 cold인 실험이 아니다. `room=distributed`는 이 프로필의
  고정 CLI 가드다. 실제 상세 hot/distributed 분포는 모든 모드에서 아래 단계로 동일하게 적용한다.
- `detail-outage --cache=warm`: 사전 조회 후 manifest가 검증한 **해당 Redis 컨테이너 ID만** 중단한다.
  상세 GET만 허용한다. 측정 후 같은 컨테이너를 시작하고 health를 확인한 뒤, 테스트 키 부재 →
  상세 두 건 DB 로드/재캐싱 → 다음 상세 두 건 SQL 로드 0을 확인한다. Backend 재기동은 없다.
- `detail-lifecycle --cache=warm`: 부하 없이 실제 설정 TTL을 **이 실행에서만 15초**로 단축한다.
  두 키를 읽어도 TTL이 늘지 않음을 확인하고 자연 만료를 기다린다. 이후 SQL 로드와 새 TTL을 검증한다.
  이어 ADMIN이 숙소 설명·객실 전망을 각각 한 번 PUT하고, HTTP 성공 직후 상세 재조회 전에
  기존 키 부재를 확인한다. 다음 GET은 수정된 값을 DB에서, 이어지는 GET은 Cache에서 확인한다.
  모호한 PUT은 실패로 남기고 재전송하지 않는다. HTTP로는 커밋 전 중간 상태를 관찰하지 않으므로
  commit/rollback 내부 순서는 기존 `RedisCacheInvalidationIntegrationTest` 계약과 구분한다.

공유 Redis나 개발·운영 포트에 연결하지 않는다. `FLUSHALL`/`FLUSHDB`를 사용하지 않는다.
실패 시 #342와 같은 명시적 stop/cleanup을 사용한다. 장애 복구는 `finally`에서 시도하며
전체 프로세스 강제 종료 시 자동 복구를 보장하지 않는다. 소유권이 달라지면 조작하지 않는다.

## 동일 부하와 독립 기능 검증

기본 시드 8숙소·24객실·120재고·Media 8장·메타데이터 8객실·4예약을 사용한다. 상세 대상은
숙소 4개(Media 있음/없음 각 2개)와 객실 4개(Media+메타데이터 1, 메타데이터만 1, 둘 다 없음 2)다.
모든 요청에서 ID·부모·운영 상태 및 유형별 정보(숙소 설명/도시/시간대 또는 정원/기본가), 이미지
대표 ID/URL, 객실 메타데이터 값과 생략 여부를 검증한다. 목록 대조군은 첫 5개 ID/순서/전체 건수를 확인한다.

| 구간 | 실행 | 분포 |
| --- | --- | --- |
| first | 1 VU, 8회, 8초 상한 | 상세 키 8개를 한 번씩, 목록 없음. cold의 최초 sweep |
| hot | 2 iter/s × 6초, 최대 2 VU | 숙소 키 1개와 객실 키 1개를 교대로, 주기적으로 목록 포함 |
| distributed | 2 iter/s × 6초, 최대 2 VU | 상세 8개를 순회하며 목록 포함. 일정 간격에서 비교 |
| steady | 3 iter/s × 8초, 최대 3 VU | distributed 분포 유지 |
| outage (별도) | 1 iter/s × 12초, 최대 2 VU | 숙소/객실 상세 번갈아 조회, 목록·인증·예약 없음 |

일반 부하에서 iteration당 HTTP 1회다. 명목 계획 대비 시작 부족과 drop은 실패이고, 개방형
구간만 k6 종료 경계 1회를 허용한다. first 고정 반복과 도착률 단계의 RPS를 같은 뜻으로 보지 않는다.
실제 RPS는 구간 내 HTTP 완료 수에 근거하며, 통합 `rpsOverRun`은 단계 사이 간격을 포함한다.
정상 cold 측정이 끝난 뒤는 각 Cache에서 **같은 키 4개 요청**과 **서로 다른 키 4개 요청**을
별개로 실행한다. 각 burst는 관련 키만 비운 뒤 한 fixture 프로세스에서 요청을 함께 시작한다.
이 기능 프로브의 지연(연결 포함)은 k6 HTTP 지연과 분리한다.

## 측정 경계

- `summary.json`과 `raw.jsonl`: 단계·payload별 요청 수/p50/p95/p99·실제 RPS·상태/도메인 분포·
  drop/timeout. [k6 HTTP duration](https://grafana.com/docs/k6/latest/using-k6/metrics/reference/)에는
  최초 연결 시간이 제외된다. `detail-fixture.json`은 사전 응답의 UTF-8 JSON bytes(본문만)와 TTL만 남긴다.
- `detail-metrics.json`: MySQL Performance Schema에서 PK 원본 SELECT(숙소/객실), 목록 본문·count·
  시간대, 보강 SQL의 호출/시간/검사 행을 분리한다. **DB 우회율** = `(성공 상세 GET − 해당 엔티티
  PK SELECT) / 성공 상세 GET`. HTTP/SQL/초기·종료 PTTL 대조가 맞는 이 격리 구간에만 적용한다.
  Redis 전체 `keyspace_hits`를 상세 hit로 세지 않는다. `INFO commandstats`의 평균 `usec/call`은
  Redis 서버 명령 실행 시간이며 클라이언트 왕복·연결·lock 대기 시간을 포함하지 않는다.
- `detail-bursts.json`은 burst별 실제 DB load, `EXISTS`/`SET` 등 Redis 명령, 4개 지연과 PTTL을
  기록한다. 개별 요청의 lock 대기 시간은 직접 계측하지 않는다. Spring Data Redis의 [공식
  Cache 문서](https://docs.spring.io/spring-data/redis/reference/redis/redis-cache.html)에 따르면
  locking Writer의 Lock은 Cache 이름 단위다(키 단위나 숙소·객실 공통 Lock이 아님).
- `detail-lifecycle.json`·`detail-recovery.json`: 기능 프로브의 SQL과 PTTL. `observations.jsonl`은
  같은 호스트의 Docker CPU/메모리/Block I/O, Hikari/JVM 및 Redis 관측을 분리한다.
  중단 구간의 Redis 측정은 불가능하므로 미수집으로 표시하고, 다른 구간의 수치를 대입하지 않는다.

산출물은 Git에서 제외한 `.local/load-test/<run-id>/results`에 둔다. 응답 본문이나 토큰은 보고서에 넣지 않는다.

## 실측 환경 — 2026-11-25 (JST, UTC+09:00)

- `develop` `dcbb599` 기반 러너 소스 `d10f2c1fa12c93d2353a42771731d31a6004de87`.
  Boot JAR SHA-256 `b1480bccd8eb738abf4f5c198285e6f548fc8ef0386da6c92e5db82f194f0fb1`.
  각 manifest에 전체 Git/JAR/하네스 SHA, 시작·종료 UTC, 이미지 ID가 기록된다.
- Windows x64, 논리 CPU 24/15.7GiB RAM, Docker Desktop Linux 엔진 29.7.2(CPU 24/7.6GiB),
  Compose 5.5.0, Node 24.14.0, k6 2.0.0. MySQL 8.4.11, Redis 7.4.10(영속화 없음),
  Kafka 4.3.1(단일 브로커·3 partition), Temurin 21.0.13.1, Spring Data Redis 4.0.6/Lettuce 6.8.2.
  이미지 ID 앞자리(MySQL/Redis/Kafka/Java/fixture/k6):
  `b3b90af2a655` / `e9b2e45ecd47` / `77e3df905404` / `8ad118b146aa` / `7fddd9ddeae8` / `a33a0cfdc4d24`.
- Backend 2 CPU/1536MiB, JVM `-Xms256m -Xmx512m`, Hikari 최대 10. DB 2 CPU/1536MiB,
  Redis 0.5 CPU/320MiB, Kafka 1 CPU/1024MiB, k6 1 CPU/320MiB로 제한했다.
- `--seed=344 --stay=2026-12-30`; 숙소 시간대는 `Asia/Seoul`/`America/New_York`.
  정상 TTL 600초, lock 재확인 50ms·lock TTL 5초, Redis 연결/명령 timeout 2초/1초다.
  상세 키는 `reservation:cache:v2:accommodation-detail::`과 `reservation:cache:v3:room-detail::`다.

### 기초 payload

| HTTP 결과 | UTF-8 JSON 본문 bytes |
| --- | ---: |
| 숙소 상세, Media 없음 / 있음 | 331~338 / 656~665 |
| 객실 상세, 둘 다 없음 / metadata만 / Media와 metadata | 163 / 284 / 590 |
| 숙소 목록 대조 (5개) | 2,741 |

### 정상 HTTP 결과

각 셀은 `n; p50 / p95 / p99 (ms)`다. p99는 작은 표본에서 최대값에 가깝다.

| 모드 | 숙소 상세 | 객실 상세 | 숙소 목록 대조 | 상세 PK SQL (숙소 / 객실) |
| --- | --- | --- | --- | --- |
| off | 26; 6.15 / 8.58 / 8.81 | 24; 6.62 / 8.05 / 8.41 | 9; 13.47 / 22.21 / 22.21 | 26 / 24 |
| cold | 26; 3.86 / 13.98 / 18.64 | 24; 3.65 / 12.25 / 13.14 | 9; 18.98 / 34.12 / 34.12 | 4 / 4 |
| warm | 26; 3.24 / 4.15 / 4.69 | 24; 3.09 / 3.95 / 4.19 | 8; 12.26 / 17.32 / 17.32 | 0 / 0 |

| 모드 | 완료 (first / hot / distributed / steady) | hot / distributed / steady 실제 RPS | 전체 RPS | 숙소 / 객실 DB 우회율 |
| --- | --- | --- | ---: | --- |
| off | 8 / 13 / 13 / 25 | 2.17 / 2.17 / 3.13 | 1.79 | 0% / 0% |
| cold | 8 / 13 / 13 / 25 | 2.17 / 2.17 / 3.13 | 1.79 | 84.6% / 83.3% |
| warm | 8 / 13 / 13 / 24 | 2.17 / 2.17 / 3.00 | 1.78 | 100% / 100% |

계획은 실행마다 `8 / 12 / 12 / 24`였다. 정상 3회 176건이 모두 200이며 도착 누락·timeout·
전송/정합성 오류는 0이다. cold는 8개 키의 첫 순회에서 모두 적재됐고 그 뒤 42개 상세 요청이
DB를 우회했다. cold 첫 구간 p95는 18.64ms(8건), off/warm 첫 구간은 8.81/3.76ms였다.
목록 대조군 SQL은 9/9/8 요청마다 본문·시간대·count 각각 1회씩이었다. 상세 warm의 DB 절감이
목록까지 적용되지는 않는다.

| 모드 | 샘플 최대 CPU: DB / Redis / Backend / k6 | 샘플 최대 메모리: DB / Redis / Backend / k6 (MiB) | Redis GET / EXISTS 횟수; GET µs/호출 |
| --- | --- | --- | --- |
| off | 4.39% / 2.21% / 4.79% / 0.91% | 460.7 / 4.78 / 483.1 / 11.93 | 0 / 0; — |
| cold | 3.80% / 0.26% / 5.05% / 0.80% | 461.0 / 4.34 / 491.5 / 11.36 | 58 / 58; 3.55 |
| warm | 3.71% / 2.52% / 5.35% / 0.72% | 467.1 / 4.43 / 521.8 / 11.80 | 50 / 50; 3.14 |

정상 실행마다 자원을 5회 샘플링했고 Hikari pending은 관측상 0이었다. 순간 포화나 운영 용량에
관한 결론은 아니다. Redis `used_memory`는 약 1.48~2.03MB였으며, 전체 인스턴스 값이다.

### 동시 miss burst — 각 4 GET

| 캐시 / 키 분포 | PK 로드 | Redis EXISTS / SET | HTTP 최솟값–최댓값 (ms) |
| --- | ---: | --- | ---: |
| 숙소 / 동일 | 1 | 20 / 11 | 24.80–166.02 |
| 숙소 / 서로 다름 | 4 | 20 / 14 | 90.32–198.75 |
| 객실 / 동일 | 1 | 17 / 10 | 23.86–114.10 |
| 객실 / 서로 다름 | 4 | 18 / 12 | 59.27–169.37 |

동일 키는 두 캐시 모두 4개 요청의 원본 조회가 1회로 합쳐졌다. 서로 다른 키는 각 값을 적재해야
했고, 락 확인과 SET도 관측됐다. Spring Data Redis 4.0.6
[구현](https://github.com/spring-projects/spring-data-redis/blob/4.0.6/src/main/java/org/springframework/data/redis/cache/DefaultRedisCacheWriter.java#L529)은
`<cache name>~lock`을 사용한다. 따라서 서로 다른 키라도 **같은 캐시 이름**의 lock을 공유한다.
이 소표본의 HTTP 지연에는 Redis 검사·JVM/HTTP·DB 로드가 함께 포함돼 있으며, 요청별 락 대기
시간이나 다중 인스턴스에서의 중복 로드 상한을 추정하지 않는다.

### Redis 중단과 복구

Redis 중단 상태에서 숙소 7건·객실 6건 모두 200/정상 JSON이었고, PK SELECT도 7/6회였다.
계획 12회, 실제 13회(1.08 RPS), drop·timeout·전송 오류 0건이었다. **p95는 1,011.42ms**
(전체 13건)로, 정상/캐시 off보다 느렸다. 기본 Redis 명령 제한 1초와 같은 수준이나,
이 측정으로 연결/명령/재시도 시간을 개별적으로 분해하지는 않았다.

| 대상 | n; p50 / p95 / p99 (ms) | PK 로드 |
| --- | --- | ---: |
| 숙소 | 7; 1,008.64 / 1,011.12 / 1,011.12 | 7 |
| 객실 | 6; 1,008.39 / 1,011.42 / 1,011.42 | 6 |

측정 중 Redis 관측은 불가했다. 2회 샘플 중 Docker 통계 1회도 미수집이었다. 수집된 관측에서
MySQL/Backend/k6 CPU는 4.01%/2.54%/0.64%, Hikari pending은 0이었다. 비교용으로 쓰기에는
표본이 작다. 스택의 Redis를 시작한 뒤 확인한 두 키는 모두 부재(`PTTL=-2`)였고, 첫 GET 쌍은
숙소/객실 PK SELECT 1/1회와 PTTL 약 600초, 다음 GET 쌍은 SELECT 0/0회였다.

이 중단은 영속화 없는 Redis의 프로세스 종료다. 기존 캐시가 남는 네트워크 단절, 장애 중 catalog
쓰기 및 실패한 eviction은 이 HTTP 실험에서 재현하지 않았다. 그런 경로에서 남아 있는 이전 값은
TTL까지 보일 수 있다. 상세의 DB fallback은 예약 Lock이나 Refresh Token fallback을 뜻하지 않는다.

### 자연 만료와 커밋 후 무효화

- lifecycle의 15초 TTL에서 사전 관측 PTTL은 숙소/객실 7,764/7,841ms였다. warm GET 뒤
  6,663/6,740ms로 줄었고 원본 SQL은 0/0회였다. 관측 시작 약 8.13초 뒤 자연 만료로
  두 키 모두 `-2`가 됐다. 다음 GET은 PK SELECT 1/1회와 새 PTTL 14,534/14,534ms를 확인했다.
- 숙소 설명과 객실 전망의 명시적 PUT 성공 직후 두 키가 `-2`였다. 다음 GET은 갱신값을
  반환하며 PK SELECT 1/1회 및 PTTL 14,497/14,497ms를 보였다. 이어지는 GET도 같은 갱신값이고
  PK SELECT는 0/0회였다. 예약, 재고, 가격 스냅샷, 이벤트 집계의 변화는 없었다.

실행 ID: warm `48f671ec6c010195252b8871`, off `fb4fd7d9aee5392adf960322`,
cold `ba19c62f34ad5daeadff2193`, outage `6b2d00dba65633b4279da5d5`,
lifecycle `b9e5dbad20084167e3bdc817`. 정규 176건과 중단 13건은 k6 결과이며, burst 16건과
만료·갱신·복구 요청은 이 189건에 포함되지 않는다. 중단/기능 실행은 문서 작업 중 준비됐으나
위와 동일한 러너 코드 및 JAR SHA를 사용했다. 최초 cold 준비 시 Boot JAR 클래스 로딩 지연으로
readiness 제한을 넘겼다. 해당 스택만 정리했고 측정값은 포함하지 않았다.

### #348에 넘길 근거

1. 이 시드에서 warm이 DB 상세 PK 조회를 모두 제거했지만, 목록과 초기 miss는 별개 비용이다.
   정상 상세 지표에 목록 지연을 섞지 않고, 미스율/캐시 이름별 경합을 같은 환경에서 반복 확인한다.
2. 같은 캐시에서 서로 다른 키를 재적재할 때도 락 확인이 발생하고 DB 로드는 줄지 않았다.
   실제로 병목인지 판단하려면 동일 키·서로 다른 키·숙소와 객실 교차, 반복 표본과 복제 수를
   분리한다. 현재 결과만으로 TTL 변경이나 락 전략 교체를 권고하지 않는다.
3. Redis 중단의 DB fallback은 성공했지만 13개 상세가 모두 DB로 가고 지연은 약 1초였다.
   [후속 #348](https://github.com/K4RF/reservation-platform/issues/348)에서 필요하면 Redis 지연과
   실패 종류를 분리하고, 같은 제공률·시드에서 설정 하나씩 비교한다. 운영 상한으로 간주하지 않는다.
