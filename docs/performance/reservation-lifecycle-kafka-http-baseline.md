# 예약 생명주기 및 Kafka 부하 기준선 (#347)

[단일 예약 생성 기준선(#346)](reservation-creation-http-baseline.md)에 이어, 생성·변경·취소
정합성과 Kafka 적체·회복을 확인한다. 정상 쓰기, 본인 이력 읽기, 동일 예약 경합,
broker 중단은 서로 다른 격리 프로젝트에서 실행한다. 작은 데이터셋의 비교 기준이며
최대 용량, 운영 SLO 또는 외부 후처리 완료를 의미하지 않는다.

## 실행

저장소 루트에서 [격리 runner 안내](../../load-test/README.md)에 따라 실행한다.
이미 경과한 예시 날짜 대신 runner가 허용하는 동일한 미래 체류 시작일을 네 시나리오에 사용한다.

```powershell
Push-Location backend
.\gradlew.bat build
Pop-Location
node --test load-test/*.test.mjs
node load-test/run.mjs prepare --confirm=isolated --seed=347 --stay=2026-12-30 --profile=lifecycle-write --cache=off
node load-test/run.mjs run <runId> --confirm=<runId>
node load-test/run.mjs cleanup <runId> --confirm=<runId>
```

나머지는 `--profile=lifecycle-history`, `lifecycle-race`, `lifecycle-broker-down`으로
각각 준비한다. 실행 실패 시 HTTP 쓰기를 다시 보내지 않는다. 해당 실행의 DB/원장과
로그를 먼저 확인한다. 동일 조건 재시도는 새 격리 프로젝트만 사용한다.
Kafka 중복 검증은 정상 drain 후 이미 발행한 동일 key/headers/payload를 한 번
재전달하는 별도 검증으로, 예약 API 요청 재전송과 다르다.

| Profile | 측정 구간 | 검증 |
| --- | --- | --- |
| `lifecycle-write` | 1×6초 → 2×6초 → 3×8초 open arrivals/s, 두 2초 간격 | VU별 별도 회원·객실. POST → 일정 PATCH → 취소 PATCH. 작업당 재고 및 Outbox 확인 |
| `lifecycle-history` | 같은 arrivals/s, 최대 VU 2/4/6, 다섯 GET을 순환 | 동일 사용자·CONFIRMED·check-in 범위·ID DESC·size 5. offset/cursor 첫 페이지와 0-based page 4, 상세. Deep cursor는 준비 구간에서 네 페이지를 순회해 확보 |
| `lifecycle-race` | 2 VU씩 두 번, 각 VU 한 요청 | 한 예약에서 변경 vs 취소, 또 다른 예약에서 취소 vs 취소. 상태 거절과 optimistic conflict를 HTTP 오류 통계에도 유지 |
| `lifecycle-broker-down` | 중단 구간에 1 VU, 한 생명주기 | 소유 확인된 broker만 중단·재시작. 격리 fault 전용 Producer metadata 대기 상한 5초. PENDING·attempt/error 후 원장·offset 대조 |

## 대조 기준

- 초기 8개 숙소·24개 객실·날짜별 재고 120행과 네 건의 예약을 준비한다. 정상 쓰기는
  기본가와 일별 override를 섞어 `[d0,d2)` → `[d1,d3)`로 이동한다. 재고 버전은
  변경 시 d0/d2만 증가하고 공유 날짜 d1은 유지한다. 현재 정책과 별도로 예약에
  저장된 정책 snapshot을 검증한다. 새 예약의 예상 취소료는 변경 총액의 30%이고,
  경합 fixture의 기존 정책은 동일 체류일에서 무료다.
- 취소된 예약에 대한 변경/재취소, 타 회원 상세 접근, 정책상 최대 숙박일 위반,
  추가 날짜 재고 부족은 시나리오 외 control이다. 거절 후 DB/재고/Outbox가 변하지
  않아야 한다. HTTP 응답이 없거나 유효하지 않으면 미확정으로 분리하고 해당 run을 실패시킨다.
- Kafka 3개 파티션의 최초 offset과 종료 offset으로 측정 대상 레코드만 읽는다.
  예약 ID key, 파티션, offset, Event ID 및 유형을 Outbox와 대조한다. 같은 예약의
  생성→변경→취소 최초 전달 순서를 검증하며, 파티션 사이의 전역 순서는 주장하지 않는다.
  정상 run은 의도적 재전달 전까지 중복 0건이 필요하다. 장애 복구 중 생긴 중복은
  허용하되 원장 매칭과 최초 전달 순서를 확인한다. 순서 불일치는 실패로 분류하고
  key·partition·offset·유형만 보존한다. 정상·broker 재시작 시나리오의 DLT
  offset은 변하지 않아야 한다.
- Publisher 측정은 Producer 호출 진입부터 ack 또는 실패까지의 벽시계 시간과
  **비어 있지 않은** batch의 DB 조회 진입부터 transaction 완료 callback까지를 분리한다.
  전자는 Kafka 클라이언트가 Future를 반환하기 전 동기 대기까지 포함한다.
  DB timestamp 차이는 별도 집계한다.
  `processed_at`은 handler의 transaction **커밋 전** 입력된다. 소비자가
  `published_at` 설정보다 먼저 실행될 수 있으므로 두 timestamp의 차이는 음수일 수 있다.
  커밋 완료는 timestamp가 아니라 이후 조회에서 보인 원장과 소비자 offset으로 입증한다.
- `.local/load-test/<runId>/results/`에 단계별 HTTP 요청/latency·시스템 샘플, reconcile,
  Outbox timing, broker offset, drain 결과가 남는다. 원시 Kafka payload와
  인증 토큰은 결과에 저장하지 않는다. 운영 핸들러는 현재 Audit Log stub이며,
  결제/알림, exactly-once 전달, 자동 DLT replay, cleanup은 검증 범위가 아니다.

측정 해석: [Grafana k6 metrics](https://grafana.com/docs/k6/latest/using-k6/metrics/reference/),
[open/closed 모델](https://grafana.com/docs/k6/latest/using-k6/scenarios/concepts/open-vs-closed/),
[Apache Kafka console consumer offset/partition formatter](https://cwiki.apache.org/confluence/pages/viewpage.action?pageId=158873276).

## 실측 기준선 (2026-11-25)

공통 조건: develop 기준 `0361690` 위 #347 변경, Windows x64 / Docker Linux 29.7.2,
seed 347, 체류 시작일 2026-12-30, UTC 시각 기준, cache off. k6 2.0.0,
Java 21, MySQL 8.4, Redis 7.4, Kafka 4.3.1. Docker 엔진에 24 logical CPU·
7.59 GiB가 할당되어 있었다. backend 2 CPU/1.5 GiB, JVM 256–512 MiB,
Hikari 최대 10, k6 1 CPU/320 MiB, Kafka broker 1 CPU/1 GiB(JVM 384 MiB).
Consumer concurrency 3, Outbox poll 1초·batch 50·ack wait 5초, 기본 retry
2회(고정 1초 간격)를 유지했다. 테스트 fixture 로그인·smoke·Kafka 초기 drain은
측정 구간에서 제외했다. 전용 컨테이너는 데이터와 네트워크를 격리하지만 호스트
CPU/I/O를 독점하지는 않는다. cache off는 상세 응답 캐시만 끈 것이며 예약 생성의
Redis lock은 유지했다.

측정용 Boot JAR SHA-256:
`2c797c607e7254d804a3afe370d99948df7a27c5adbbd43cf99c0cf85401776a`.
정상 쓰기 Runner SHA-256:
`b302216292a849b0c222b0597852d904a14b2dbaa129dc3d3bdd4e4746c08a67`.
이후 이력 VU 여유 및 경합·중단 관측만 보강한 Runner SHA-256:
`45ae7de05d623fb3653e5737f878056d408410543a6cf5b985e4c3ecf1b9d0b6`.
최종 이력·제한된 장애 실험 Runner SHA-256:
`597cc138788aa15c9c20d0b9ac1b5b74a0f93b89d3ea2850e0db9a0f075ffef2`.
각 manifest에 전체 이미지 ID, 실행 시작·종료 시각, seed와 코드 SHA를 남겼다.

### 정상 쓰기

run `a609cb1efa8ebcbb05650783`, 측정 시작 11:04:53 UTC. 총 44 cycle, **132 HTTP**
(201 44건, 200 88건), 첫/마지막 HTTP 간 23.670초에 5.58 RPS. dropped/timeout/
transport/unconfirmed 모두 0. low·ramp의 각 1개 추가 iteration은 k6 open window 끝
경계에서 발생할 수 있어 계획값과 별도로 표기한다.

| 단계 | 계획/완료 cycle | HTTP | HTTP RPS / cycle·s⁻¹ |
| --- | ---: | ---: | ---: |
| low (6s) | 6/7 | 21 | 3.50 / 1.17 |
| ramp (6s) | 12/13 | 39 | 6.50 / 2.17 |
| steady (8s) | 24/24 | 72 | 9.00 / 3.00 |

아래는 steady 단계 기준 값으로, p99는 작은 표본의 최댓값에 가깝다. 초당 DB 커밋
작업 수는 각 200/201을 실제 Outbox와 대조한 수를 단계 시간으로 나눈 9.00건/s이며,
DB 커밋 순간을 직접 샘플링한 TPS는 아니다.

| 요청 | n | p50 / p95 / p99 (ms) |
| --- | ---: | --- |
| 생성 | 24 | 19.40 / 127.81 / 172.24 |
| 변경 | 24 | 16.17 / 20.38 / 21.23 |
| 취소 | 24 | 13.26 / 18.99 / 101.44 |

- 비교한 날짜별 재고·버전·숙박 스냅샷·취소 금액 불일치 0. 타 회원 상세는
  403 `RESERVATION_004`; 재취소·취소 후 변경·숙박일 초과·재고 부족은 각각 409
  `RESERVATION_005`, `RESERVATION_006`, `BOOKING_POLICY_006`, `INVENTORY_005`.
  측정 RPS에서 제외했고 persistent state는 모두 불변이었다.
- Outbox/commit된 소비 원장: 각각 132건 증가, 발행 시도 모두 1회. 파티션별
  종료 offset은 `[1,1,2] → [64,49,23]` (63/48/21건). 동일 key의 세 이벤트
  순서 일치, DLT 0. 샘플에서 PENDING 최대 6건, 파티션 lag 합 최대 5건,
  최종 lag/PENDING 0으로 회복하는 데 측정 후 약 2.44초가 걸렸다.
  runner 시작부터 drain 관측까지 **4.10 events/s**(132 / 32.17초)로, k6 기동과
  drain probe 비용이 포함된 관측 완료율이며 Consumer 용량은 아니다.
- 동일 레코드를 파티션 0에서 offset 1 → 64로 한 번 더 전달했다. 원장 행 수와
  처리 timestamp 변경 없음, 최종 offset 65/lag 0, DLT 0. 부하 결과에는 제외했다.
- ack 132건 p50/p95 **7.00/59.62 ms**, nonempty commit batch 20개
  **63.34/302.33 ms**, Event 기록→발행 timestamp **586.19/1050.31 ms**,
  Event 기록→소비 timestamp **593.97/1053.15 ms**. 측정 중 확인한 CPU·메모리 표본
  최댓값: k6 1.86%/12.43 MiB, backend 26.79%/491.4 MiB, MySQL
  7.82%/460.4 MiB, Kafka 88.49%/404.8 MiB. 수집 자체에 수 초가 걸리고
  한 Docker 표본은 누락됐으므로 peak나 포화 증거로 해석하지 않는다.

### 본인 예약 이력 및 상세

run `068b16443055ec2025ad157f`, 11:20:19 UTC. 필터에 맞는 본인 예약 31건,
size 5, ID DESC. 완료 7/13/25건(단계별 1.17/2.17/3.13 RPS), **45 HTTP 200**,
첫/마지막 HTTP 간 23.939초에 1.88 RPS. dropped/timeout/transport 0.
읽기 전후 예약·재고 상태, Outbox/원장, source/DLT offset은 동일했다.

| 요청 | 전체 n | steady n | steady p50 / p95 / p99 (ms) |
| --- | ---: | ---: | --- |
| Offset 첫 페이지 | 10 | 5 | 15.61 / 18.37 / 18.37 |
| Offset page 4 | 10 | 5 | 14.65 / 15.47 / 15.47 |
| Cursor 첫 페이지 | 9 | 5 | 11.21 / 17.03 / 17.03 |
| Cursor page 4 상당 | 8 | 5 | 11.21 / 14.36 / 14.36 |
| 예약 상세 | 8 | 5 | 6.86 / 8.51 / 8.51 |

별도의 백엔드 빌드와 겹쳤던 앞선 두 run은 HTTP 응답은 맞았으나 k6 drop
1건과 2건으로 제외했다. 두 번째에서는 steady의 응답 일부가 1.87–3.19초까지
지연됐다. 원인을 확정하지 않았고, VU 여유를 둔 동일 arrival rate에서 다른 빌드
없이 수행한 run을 기준으로 남겼다. deep cursor를 구하는 네 번의 요청은 준비
구간으로, 표의 수치에 포함되지 않는다.

### 동일 예약 경합

run `73848e15457d19455df85d75`, 11:14:41 UTC. 4 HTTP 중 두 건은 200, 두 건은
409 `INVENTORY_011`이었다(HTTP 오류율 50%, 예상 거절 2건, 비예상 오류 0).

| 경합 | 겹친 HTTP 구간 | 결과 |
| --- | ---: | --- |
| 변경 vs 취소 | 57 ms | 취소 43.12 ms 성공, 변경 72.79 ms 충돌 |
| 취소 vs 취소 | 75 ms | 한 건 75.93 ms 성공, 다른 한 건 125.97 ms 충돌 |

각 예약에 취소 이벤트 한 건만 남았다. 재고 이중 반환·변경 가격 반영·중복 취소
이벤트 0건, 초기 정책 snapshot을 유지해 두 건 모두 수수료 0이었다. Source
offset은 `[1,1,2] → [2,1,3]`, drain 2.91초, 최종 lag 및 DLT 0.
두 번의 제한된 경합 결과이며 항상 취소가 먼저 성공한다는 의미는 아니다.

### Kafka 중단·복구

기본 설정으로 시작한 예비 run `181ddcbb0e041cf44709ce9b`에서 HTTP 3건 성공 및
최대 약 27.88초 된 PENDING 3행을 확인했다. 정상 복구 뒤 세 이벤트가 처리됐지만
28초 관측 창에서 **커밋된 발행 오류**는 보이지 않아 실패로 분류했다. 첫 Producer
호출은 약 38.89초 걸리고 성공했다. 5초 ack 대기는 Future가 반환된 뒤 시작하며,
앞 단계의 metadata/buffer 대기는 Kafka
[`max.block.ms`](https://kafka.apache.org/43/configuration/producer-configs/#producerconfigs_max.block.ms)
(기본 60초)의 별도 영향을 받는다. 따라서 같은 기준으로 발행 실패의 DB 기록까지
관측하기 위해 **격리 fault profile에서만** 이 값을 5초로 제한했다. 정상 부하·개발·
운영 설정과 Outbox poll/ack timeout은 변경하지 않았다.

제한된 run `94843a6d4fb5912e2f191a0a`, 11:22:25 UTC.
**적체 해소·정합성은 통과했고, 동일 예약 순서 검증은 실패했다.**

- Broker 중단 중 201/200/200 성공(생성 46.29 ms, 변경 42.22 ms, 취소 22.69 ms).
  DB에는 PENDING 3행이 보였고, 각 행에 실패 attempt 1회, 소비 원장 없음,
  최고 age 16.07초였다.
- 중단 확인부터 재시작 요청까지 17.73초, 재시작 요청부터 health 정상까지
  8.48초, 이후 전체 drain 확인 3.68초. 종료 시 이벤트별 누적 시도는 3/2/2회,
  실패 Producer 호출 4회(p50/p95 5002.53/5010.31 ms), 성공 3회
  (9.36/932.38 ms). 완료 batch 3개의 p50/p95는 5955.08/15036.90 ms였다.
- Event 기록→발행 timestamp p50/p95 22.20/23.27초, 기록→소비 timestamp
  22.27/23.32초. 생성·변경·취소 세 이벤트 모두 발행 및 원장에 남았고,
  예약 재고·숙박일별 금액·수수료 검증을 통과했다. Source 종료 offset
  `[1,1,2] → [4,1,2]`, 최종 lag/PENDING 0, DLT 0.
- Outbox ID 순서는 생성(5) → 변경(6) → 취소(7)였으나, 같은 예약 key `5`의
  파티션 0에서 실제 수신 순서는 **변경(offset 1) → 취소(2) → 생성(3)**이었다.
  현재 Publisher는 앞선 발행이 실패해도 같은 batch의 나머지를 계속 시도한다.
  브로커가 그 사이 복구되면 후속 이벤트가 먼저 발행될 수 있다. 같은 key는
  **브로커에 기록된** 순서를 보존하지만, 실패한 Outbox 재시도까지 포함한
  DB 커밋 순서를 보장하지 않는다. 순서 실패를 정상으로 처리하거나 예약 쓰기를
  다시 보내지 않았으며, 발행 정책은 이번 이슈에서 변경하지 않았다.

### Embedded Kafka 실패 검증

`backend/gradlew.bat build`에서 테스트 382개, Node runner 테스트 30개가 통과했다.
`ReservationEventRetryDltIntegrationTest`는 정상 부하나 broker 장애 수치에 합산하지
않았다. 구성된 retry는 두 번, 테스트 전용 고정 backoff는 10 ms다. 일시적 실패는
재시도 후 ledger 1행, 소진은 총 3회 처리 시도와 DLT 1건, 비재시도 계약 오류는
1회 처리 시도 후 DLT 1건을 확인했다. 추가 테스트는 DLT 송신 Future가 실패한
동안 같은 Source partition의 committed offset이 실패 레코드를 지나지 않고 후속
레코드도 처리되지 않음을 확인했다. 실패 주입을 해제하면 후속 레코드가 처리되고
실패 레코드는 처리 원장에 나타나지 않는다. 기본 1초 backoff의 실시간 측정은 아니다.

## 후속 검증

[#348 병목 분석](https://github.com/K4RF/reservation-platform/issues/348)의 우선
검토 후보는 정상 run에서 1초 내외로 모인 Outbox 발행 지연이다. Ack 대기와
batch 비용을 분리한 채 poll 주기·배치 크기 변경 전후에 동일한 부하를 재측정한다.
Broker 장애에서는 Future 반환 전 Producer 대기와 그동안의 batch 잠금 비용도
따로 비교한다. 같은 예약의 발행 순서 보장은 이 성능 측정과 별도의 후속 설계
과제로 다룬다. 순서에 의존하는 실제 후처리를 붙이기 전에 실패·복구 시나리오를
다시 검증해야 한다.
steady 생성 tail은 일부 지연 표본의 영향이 크므로, MySQL/Redis/앱 단계별로
분리 측정하기 전에는 병목 위치를 단정하지 않는다. 더 긴 이력과 같은 조건의
반복 표본 없이 offset/cursor 우열도 단정하지 않는다.
