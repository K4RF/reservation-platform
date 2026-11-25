# 병목 재검증과 Outbox 폴링 비교 (#348)

선행 HTTP 기준선의 지연과 실제 비용을 분리했다. 이번 비교에서 바꾼 변수는 격리
Backend의 **Outbox 폴링 간격(1초 ↔ 250ms)** 하나다. 새 환경변수나 스키마 변경은
개발·운영에 요구하지 않는다. 결과는 [#349](https://github.com/K4RF/reservation-platform/issues/349)에 인계한다.

## 후보와 판단 근거

| 후보 / 재현 프로필 | 선행 관측과 영향 | 가설과 이번 판단 |
| --- | --- | --- |
| [#343 날짜 조건 숙소 검색](search-http-load-baseline.md) · `catalog-search / expanded` | 2박 가용 p95 975.18 ms(n=6), 대표 본문·count에서 재고 4,600행 × 477회. 확대 SQL count 누적 4.63초. | 동기 응답의 우선 후속 후보. 작은/큰 데이터 비교는 전후 최적화 비교가 아니다. 기존 room/date UNIQUE가 있는데도 스캔을 선택한 원인을 통계·실행계획으로 분리하고, 2박/정확 total/정책 조건을 지키는 단일 계획 후보를 재검증한다. 인덱스를 추측으로 추가하지 않는다. |
| [#343 자동완성](search-http-load-baseline.md) · `catalog-suggest` | 확대 CTE 누적 143.46 ms, 자동완성 정렬 행이 늘었다. 반환 상한 10은 정렬 입력 상한이 아니다. | 현재 합성 분포에서는 날짜 검색보다 후순위. prefix/contains와 중복 제거를 분리하고 표현·랭킹 계약은 유지한다. |
| [#344 상세 Redis](detail-cache-http-baseline.md) · `detail-reads / off,cold,warm` | warm에서 DB 상세 PK 조회 제거. 같은 캐시의 서로 다른 키 miss도 락 확인, 장애 fallback은 약 1초. | 정상 miss 경합과 Redis 장애는 다른 원인이다. 복제 수·키 분산·온도별 반복이 필요해 TTL이나 캐시 락을 변경하지 않았다. |
| [#345 가용·요금](stay-availability-price-http-baseline.md) · `stay-availability / expanded`, `stay-price` | 확대 가용 p95 77.94 ms. count 46회에서 약 1,147만 행을 조사했고 기존 UNIQUE가 선택되지 않았다. 일별 요금은 2 SELECT/요청으로 안정적이었다. | 가용 건수/count에서 반복 스캔이 보인다. 물리 읽기/Pool 대기 증가가 없었다는 선행 샘플을 쿼리 비용과 구분한다. 깊은 offset·정확 count와 날짜별 요금 경로를 함께 바꾸지 않는다. |
| [#346 생성](reservation-creation-http-baseline.md) · `create-hot` / `create-distributed` | Lock 대기 p95 42.56 vs 1.01 ms(각 n=48); 보유 p95 24.09 vs 43.53 ms. | 같은 객실에서 비겹침 요청도 직렬화된다. DB 트랜잭션·낙관적 충돌·Redis 장애를 분리하며 생성 안전성과 락 범위는 유지한다. |
| [#347 정상 이벤트](reservation-lifecycle-kafka-http-baseline.md) · `lifecycle-write` | Event→발행 p95 1050.31 ms, 호출→ack p95 59.62 ms, 최종 lag 0. | 1초 fixed delay로 생기는 대기인지 검증한다. 발행 대기와 배치 처리, SQL 조회 비용을 같이 보고 1초/250ms만 바꾼다. HTTP 처리량 개선을 전제하지 않는다. |
| [#347 장애 복구](reservation-lifecycle-kafka-http-baseline.md#kafka-중단복구) · `lifecycle-broker-down` | 재시작 후 이벤트는 모두 처리됐지만 동일 예약이 변경→취소→생성 순으로 나타났다. | 같은 key의 broker 순서와 Outbox 재시도 순서 보장은 별개다. 주기 변경으로 고쳐질 문제가 아니다. 재시도/순서 설계와 Consumer 의존성은 별도 과제로 남긴다. |

폴링은 관측된 지연에 대응하는 설정 하나를 바꿔 바로 대조할 수 있어 먼저 실험했다.
호스트·generator 간섭, GC, DB/Pool 대기, Kafka ack나 SQL 스캔을 하나의 원인으로
간주하지 않는다. 기존 정확한 count와 정책을 바꾸는 SQL 후보를 이 실험에 섞지 않았다.

## 재현과 판정

개발 DB와 분리되는 [격리 실행기](../../load-test/README.md)만 사용한다. 같은 Boot JAR를
한 번 빌드하고, 다른 빌드나 부하를 동시에 실행하지 않는다. 예시 체류일이 경과하면
허용된 미래 날짜 **하나**를 골라 모든 비교에 동일하게 사용한다.

```powershell
Push-Location backend
.\gradlew.bat bootJar
Pop-Location
node --test load-test/*.test.mjs
node load-test/run.mjs prepare --confirm=isolated --seed=347 --stay=2026-12-30 --profile=lifecycle-write --cache=off --outbox-poll=1s
node load-test/run.mjs run <run-id> --confirm=<run-id>
node load-test/run.mjs cleanup <run-id> --confirm=<run-id>
```

정상 쓰기는 1s → 250ms → 250ms → 1s로 실행 순서를 교차한다. 각 실행에 새 ID를
쓴다. 읽기 회귀는 `lifecycle-history`로 바꾸고 두 설정에서 따로 실행한다. 그 밖의
선행 프로필이나 장애 실험에는 이 옵션을 쓸 수 없다. 준비·초기 이벤트 drain 후 6초
idle 창을 측정하고, 실제 부하 창에서는 같은 기존 HTTP 단계와 정합성 검증을 사용한다.
이전 실행의 POST/PATCH를 재전송하지 않는다.

- **효과:** Event 기록→발행 및 소비 timestamp(p50/p95), ACK/오류, 관측 lag·최종 drain.
  기록→발행 시간에는 폴링 대기·배치 실행이 포함된다. `processed_at`은 Consumer
  트랜잭션 커밋 완료 시각이 아니다.
- **대가:** `outbox-poll.json`의 idle/active locking SELECT 수·초당 호출·누적 SQL 시간·
  조사/반환 행. idle 창은 초기 원장 drain 뒤로 잡으며 반환 행은 0이어야 한다. active 창은
  k6 시작 전부터 k6 종료 직후까지라 seed·후속 drain·의도된 Kafka 중복 재전달을 포함하지 않는다.
  SQL 타이머는 전체 DB 트랜잭션/CPU가 아니다. [MySQL digest 집계](https://dev.mysql.com/doc/refman/8.4/en/performance-schema-statement-summary-tables.html)에서 실제
  경과 시간을 사용하며 쿼리 텍스트·바인딩을 이 실험 결과에 저장하지 않는다.
- **회귀:** HTTP 상태/도메인 코드와 tail, dropped/timeout/transport, 예약 상태·날짜별
  재고 버전·확정 가격·수수료·이벤트 원장·partition/order. 원장/재고/가격 불일치가
  하나라도 있으면 제외하고 성능 개선으로 판정하지 않는다.

Outbox scheduler는 [fixed delay](https://docs.spring.io/spring-framework/reference/integration/scheduling.html#scheduling-annotation-support-scheduled)로,
이전 호출이 끝난 뒤 설정만큼 기다린다. 따라서 250ms는 고정 4 batches/s나 처리량
보장이 아니다. k6는 도착률과 실제 완료를 구분하는 [개방형 모델](https://grafana.com/docs/k6/latest/using-k6/scenarios/concepts/open-vs-closed/)을 사용한다.
작은 정상 기준선에 대한 비교로, 실제 포화 구간 또는 운영 SLO의 측정은 아니다.

## 2026-11-25 실측 환경

- 제품 기준 `develop` `63ab97f3db53fd43ac258ca5234bdc08550dedc3`; 실험 러너
  `fc76c366232cb4636b033de7d79084611b76b370`. 초기에는 커밋 전이었으나 러너 바이트
  지문은 동일하다. Runner SHA-256 `99b934b8eb1a86c89d7f47286e705d468ce90a1719744bf9be15d1213c1e7adf`,
  Boot JAR SHA-256 `2c797c607e7254d804a3afe370d99948df7a27c5adbbd43cf99c0cf85401776a`.
- seed 347, 체류 시작 2026-12-30, 상세 cache off, distributed, 단계별 제공률
  1×6초 / 2×6초 / 3×8초(사이 2초 공백), 명목 42 iterations. VU는 쓰기 1/2/3,
  읽기 2/4/6으로 각 비교 안에서 고정. 쓰기 1 iteration은 3 HTTP 및 3 이벤트, 읽기는 1 GET이다.
  공통 seed 지문 `df932530c3a1367c2b2967b0965cb20c8382e693de29bbe35ab645ef75983d29`.
- Windows x64 / Docker Linux 29.7.2(24 logical CPU, 7.59 GiB) / Compose 5.5.0 /
  Node 24.14.0 / k6 2.0.0. 이미지 ID 앞자리 MySQL 8.4 / Redis 7.4 / Kafka 4.3.1 /
  Java 21 / fixture / k6: `b3b90af2a655 / e9b2e45ecd47 / 77e3df905404 /
  8ad118b146aa / 7fddd9ddeae8 / a33a0cfdc4d24`.
- 자원은 Backend 2 CPU/1.5 GiB(JVM 256–512 MiB·Hikari 10), MySQL 2 CPU/1.5 GiB,
  Redis 0.5 CPU/320 MiB, Kafka 1 CPU/1 GiB, k6 1 CPU/320 MiB. Outbox batch 50·ack wait 5초,
  Kafka 단일 broker·3 partitions·consumer concurrency 3. 같은 호스트를 공유한다.
  각 manifest에 실제 시각, 설정, 코드·이미지 해시를 보존하고 시간 표기에는 UTC를 사용한다.

## 정상 쓰기 결과

| 순서 / 간격 | Run ID / k6 시작(UTC) | 완료 low/ramp/steady | HTTP 및 Event n | 실제 HTTP RPS |
| --- | --- | --- | ---: | ---: |
| A1 / 1s | `6e88e5f32ea243f769b7d465` / 12:53:31 | 6/13/24 | 129 | 5.44 |
| B1 / 250ms | `d0d9f17c7f2801ed42bc3c54` / 12:55:59 | 7/13/24 | 132 | 5.57 |
| B2 / 250ms | `28b9c0af44b0905cf8de1f98` / 12:58:21 | 7/13/25 | 135 | 5.62 |
| A2 / 1s | `d557212021ce12ae84508cb2` / 13:00:47 | 7/13/25 | 135 | 5.62 |

HTTP RPS는 첫~마지막 완료 간격(단계 사이 공백 포함)이다. 각 cycle의 201 1건·200 2건을
예약·Outbox·소비 원장에 대조했다. 단계 종료 경계의 추가 iteration은 실제 완료 수에
포함했다. 제공률은 같지만 실제 n은 같지 않아 완료 수 차이를 처리량 개선율로 사용하지 않는다.

| 순서 | 기록→발행 p50/p95 (ms) | 기록→소비 p50/p95 (ms) | Producer 호출→ACK p95 (ms) | 비어 있지 않은 batch n / p95 (ms) | 관측 최대 pending / lag 합 / drain(ms) |
| --- | ---: | ---: | ---: | ---: | ---: |
| A1 | 682.16 / 999.37 | 688.92 / 1022.14 | 46.39 | 20 / 163.16 | 6 / 3 / 2488 |
| B1 | 137.18 / 267.96 | 138.83 / 275.05 | 35.32 | 51 / 72.74 | 2 / 1 / 3084 |
| B2 | 180.09 / 277.35 | 181.15 / 279.99 | 41.22 | 51 / 93.49 | 0 / 0 / 2374 |
| A2 | 541.05 / 1020.62 | 542.28 / 1021.92 | 60.67 | 22 / 235.85 | 3 / 6 / 3901 |

| 순서 | idle poll n / 초당 / 누적 SQL ms | active poll n / 초당 / 누적 SQL ms | active 반환/조사 행 |
| --- | ---: | ---: | ---: |
| A1 | 6 / 0.97 / 1.21 | 28 / 0.95 / 6.24 | 129/129 |
| B1 | 24 / 3.89 / 4.59 | 108 / 3.70 / 30.92 | 132/132 |
| B2 | 24 / 3.90 / 4.57 | 104 / 3.66 / 37.13 | 135/135 |
| A2 | 6 / 0.97 / 1.05 | 27 / 0.92 / 5.94 | 135/135 |

| 순서 (steady n/Endpoint) | 생성 p50/p95/p99 (ms) | 변경 p50/p95/p99 (ms) | 취소 p50/p95/p99 (ms) |
| --- | ---: | ---: | ---: |
| A1 (24) | 22.11 / 137.82 / 226.05 | 18.14 / 20.59 / 25.11 | 13.81 / 17.21 / 23.66 |
| B1 (24) | 19.38 / 24.09 / 28.77 | 15.41 / 22.20 / 28.32 | 12.84 / 15.75 / 67.01 |
| B2 (25) | 20.36 / 26.66 / 32.80 | 15.22 / 19.17 / 19.55 | 12.98 / 30.99 / 33.61 |
| A2 (25) | 21.92 / 125.19 / 201.15 | 15.40 / 22.89 / 100.62 | 13.37 / 16.91 / 18.13 |

- 4회 모두 HTTP 오류·drop·timeout·transport 및 Producer 실패 0, 정상 source 순서 일치,
  의도한 중복 재전달에서 원장 불변, 예상 중복을 제외한 발행 중복·DLT·최종 lag 0이었다.
  예약·가격·재고·회계 불일치도 0이었다.
- 실제 완료가 같은 A2/B2(45 cycle)에서 기록→발행 p95는 **1020.62 → 277.35 ms**였다.
  두 1초 실행의 p95 범위는 999.37–1020.62 ms, 두 250ms 실행은 267.96–277.35 ms다.
  ACK 대기 p95(35–61 ms)만으로 이 차이를 설명하기 어렵다. 폴링 간격 변화와 그에 따른
  배치 분할(비어 있지 않은 batch 20–22→51개)의 효과를 확인했다. 순수 큐 대기와
  배치 내부 이벤트별 처리 시간은 분리 계측하지 않았다.
- 유휴 SQL은 약 0.97→3.90회/s, 쓰기 중 약 0.92–0.95→3.66–3.70회/s였다.
  쓰기 창에서 같은 SQL이 사용한 누적 시간도 약 5.94–6.24→30.92–37.13 ms로 늘었다.
  조회한 행 수는 Event n과 같아 더 빠른 폴링이 행당 처리 비용을 줄였다고 볼 수는 없다.
- 네 실행의 HTTP RPS는 5.44–5.62였다. 생성 tail이 250ms에서 낮았지만 취소 p95/p99는
  일관되게 낮지 않았다. 작은 표본(p99가 사실상 최대값), 짧은 구간, 첫/마지막 시각과
  k6 경계 추가의 영향을 고려해 HTTP 성능 개선을 판정하지 않는다. drain은 DB 조회와
  Kafka group 확인 비용을 포함한다. 잠깐의 lag 표본으로 Consumer 용량을 단정하지 않는다.

쓰기 반복의 부하 중 Docker 표본 최대치(CPU % / 메모리 MiB)는 다음과 같다.
각 조건 8회 중 Docker 미수집은 1초 1회·250ms 2회였다. 두 조건의 Hikari pending은
모든 JVM 표본에서 0이었다. 수집 한 번에 최대 약 7초가 걸렸으며 Kafka 컨테이너 통계에는
동일 컨테이너에서 실행한 관측 CLI 비용도 섞일 수 있다.

| 간격 | k6 | Backend | MySQL | Redis | Kafka |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1s | 1.86 / 13.31 | 58.72 / 501.0 | 8.23 / 460.1 | 2.26 / 4.32 | 86.97 / 432.9 |
| 250ms | 1.63 / 13.31 | 20.68 / 497.5 | 8.26 / 459.7 | 2.43 / 4.48 | 45.75 / 342.0 |

drop이나 지속적인 Pool 대기 표본이 없었다. 이 관찰만으로 생성기·Pool 순간 포화를
배제하거나 컨테이너 CPU 차이를 튜닝 효과로 판정할 수는 없다.

## 본인 예약 이력 읽기 대조

같은 본인 예약 31건에서 offset 첫/깊은 페이지, cursor 첫/깊은 페이지와 상세를
측정했다. 양쪽 페이지 조건은 size=5, ID DESC, 같은 상태·체크인 필터다. 두 설정
사이에 별도 백엔드 설정을 바꾸지 않았다.

| 간격 | Run ID / k6 시작(UTC) | 완료 low/ramp/steady · HTTP RPS | 읽기 창의 poll n / 초당 / 누적 SQL ms |
| --- | --- | --- | ---: |
| 1s | `f58e0ff5c4f67767d10243a9` / 13:03:15 | 7/12/25 · 1.83 | 29 / 0.99 / 5.78 |
| 250ms | `750c8af2ca124cc8243bb56c` / 13:05:18 | 7/13/25 · 1.88 | 119 / 3.97 / 26.58 |

steady는 각 요청 5개 표본으로 p95/p99가 이 표의 최대 표본과 같다.

| 간격 | Offset 첫/깊은 p50/p95/p99 (ms) | Cursor 첫/깊은 p50/p95/p99 (ms) | 상세 p50/p95/p99 (ms) |
| --- | --- | --- | --- |
| 1s | 11.69/12.02/12.02 · 11.12/14.49/14.49 | 8.73/10.64/10.64 · 8.99/9.97/9.97 | 4.56/4.95/4.95 |
| 250ms | 14.70/28.54/28.54 · 13.68/14.76/14.76 | 10.23/11.51/11.51 · 10.24/178.27/178.27 | 5.45/7.08/7.08 |

44/45건은 모두 200이고 drop·timeout·transport 0이었다. 예약/재고·Outbox/원장 및
source/DLT offset 변화는 없었다. 두 읽기 창에서 폴링으로 반환된 Event 행은 0이었다.
250ms의 깊은 cursor에서 178.27 ms 표본이 나왔으나 한 번씩만 비교했고 Pool 대기나
개별 DB 트랜잭션과 직접 연결하지 않았다. 읽기 성능 향상도, 250ms 때문에 tail이
악화됐다는 인과도 입증하지 못했다.

## 채택 판단

**제품 기본값은 1초 유지**로 결정했다. 이 실험에서 250ms의 정상 이벤트 지연 감소는
재현됐지만, 이벤트가 없을 때도 잠금 SELECT가 약 네 배로 늘었다. 적용 대상은 비동기
Audit Stub이고 사용자 HTTP 개선도 입증되지 않았다. 다중 Backend, 장시간 유휴,
혼합 부하나 장기 적체에서의 대가는 아직 모른다. 따라서 250ms는 동일 조건에서
다시 선택할 수 있는 격리 실험 옵션으로만 남긴다. 제품 코드/스키마/외부 계약 및
실행 설정 변경이 없어 DB upgrade나 배포 설정 변경은 필요하지 않다.

검증: Gradle `bootJar`, Node runner 테스트 32개, 격리 쓰기 4회(531 HTTP)
와 읽기 2회(89 HTTP). Backend 소스/빌드 설정 변경이 없어 이 이슈에서 전체
Gradle 테스트는 다시 실행하지 않았다. 여섯 스택은 소유권 확인 후 각각 정리했으며
raw/요약 결과는 Git에 넣지 않고 `.local/load-test/<run-id>/results/`에 보존했다.

## #349에 넘길 검증 경계

기준선 재검증과 혼합/제한 안정성 테스트는 제품 기본 설정(Outbox 1초)으로 시작한다.
250ms는 검증할 최적화 후보로만 분리하고, 사용 시 읽기·쓰기 비율, 전체 행 수와
백엔드 복제 수를 함께 바꾸지 않는다. DB 조회 비용은 backlog와 별도로 보고한다.
검색·가용 count는 같은 데이터 분포에서 실제 쿼리와 대안의 조사 행·동일 결과를 먼저
확인한다. 생성 잠금이나 fallback 정책을 바꿔 수치만 맞추지 않는다.

[v0.6.0](https://github.com/K4RF/reservation-platform/milestone/10)에서는 폴링 횟수,
batch 크기, 오래된 pending, Consumer lag 및 Pool 대기를 장기 관측할 근거를 만든다.
재시도 중 같은 예약의 순서와 Broker 복구는 [v0.7.0](https://github.com/K4RF/reservation-platform/milestone/23)에서
다룰 별도 안정성 후보다. 외부 후처리/SLO, 신규 schema·index upgrade는 이번 범위에 없다.
