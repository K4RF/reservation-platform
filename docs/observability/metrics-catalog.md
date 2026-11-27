# 지표 카탈로그 (#358)

## 현재 수집

아래는 Micrometer 이름과 Prometheus의 대표 노출 이름이다. 해당 바인더 또는 트래픽이 있어야 시계열이
생성된다. 스크레이프 자체의 세 지표는 백엔드가 아니라 Prometheus가 생성한다.

| Micrometer / 출처 | Prometheus 예 | 유형 / 단위 | 제한된 차원 |
| --- | --- | --- | --- |
| `http.server.requests` | `http_server_requests_seconds_count`, `_sum`, `_max` | Timer: 건수·초 | method, status, outcome, exception의 타입 분류, route template `uri` 최대 64개. unmatched 요청은 분류값으로 유지한다. |
| `jvm.*` | `jvm_memory_used_bytes`, `jvm_threads_live_threads`, `jvm_gc_pause_seconds_count` | Gauge/Timer: bytes·threads·초 | 바인더가 정한 메모리 풀/영역·GC 분류 |
| `process.*`, `system.*`, `application.*` | `process_uptime_seconds`, `system_cpu_usage`, `application_ready_time_seconds` | Gauge/시작 시간: 초, 0–1 비율 | 바인더의 고정값 |
| `hikaricp.*`, `jdbc.connections.*` | `hikaricp_connections_active`, `hikaricp_connections_pending`, `jdbc_connections_max` | Gauge: connection/대기 수. Timer는 초 | 설정된 pool 또는 datasource 이름 |
| Prometheus scrape | `up`, `scrape_duration_seconds`, `scrape_samples_scraped` | Gauge: 0/1·초·sample 수 | `job=reservation`, `instance=backend:9091` |

HTTP mean은 같은 범위의 `rate(_sum[...]) / rate(_count[...])`에서 계산한다. `_max`는 시계열의
percentile이 아니다. DB와 JVM의 기본 meters를 추가 업무 기능/쿼리 성능 검증으로 취급하지 않는다.

## 다음 지표의 계약 (제안, 미구현)

- 코드에는 소문자 점 구분 이름(예: `reservation.<domain>.<operation>`)을 쓰고 catalog에 실제
  노출 이름, source, unit, 집계 시점, label 집합, off/failure 의미를 함께 기록한다.
  Counter는 누적값과 구간 `rate`/ `increase`를 구분한다(Grafana/PromQL에서 reset 고려).
  Gauge는 현재 값, Timer는 초 단위 count/sum/bucket이다. 비율은 0–1, 크기는 bytes를 기본으로 한다.
- label은 검토한 route template, error code, cache name, operation, outcome처럼 유한한 값만
  허용한다. 최대 64개 route template, custom meter당 label 차원 최대 4개/개별 enum 최대 16개,
  조합 상한 64개를 시작 예산으로 제안한다. ID, Correlation ID, raw URL, 검색어, Redis key,
  SQL/바인딩, 예외 메시지, token·개인정보는 금지한다. 예산 초과를 고-cardinality 값으로 대체하지 않는다.
- histogram 기본값은 꺼져 있다. 이후 latency 분포가 필요한 한정된 meter에만 SLO 경계 8개 이내를
  제안한다. `(경계 수 + Inf/count/sum/max) × 실제 label 조합`과 다른 시계열의 여유를 계산하고
  target당 2,000 samples 상한을 실제 부하에서 검증하기 전에는 켜지 않는다. client percentile도 기본 미설정이다.
- disabled는 의도적으로 수집하지 않음, unavailable은 데이터가 없거나 요청/대상 장애, stale은 마지막 성공이
  허용 시간 밖인 상태다. 모두 정상 0과 다르다. 관측 명령은 35초 안의 마지막 성공만 인정한다.
  이후 외부 polling gauge는 bounded 백그라운드 refresh, request timeout, 마지막 성공과 freshness를 별도로 기록한다.
- 계측은 HTTP 응답, DB commit, Kafka ACK, Consumer ledger commit을 같은 성공으로 합치지 않는다.
  수집이 실패해도 기존 Lock/Transaction/Retry 경계, 예외와 interrupt, 쓰기 여부는 바꾸지 않는다.

| 이슈 | 소유 범위 |
| --- | --- |
| #359 | HTTP와 JVM 상세 정의, latency 및 오류 분류 |
| #360 | MySQL/HikariCP 병목과 풀 지표 |
| #361 | Redis cache 및 예약 동시성·lock 지표 |
| #362 | Kafka/Outbox 지표와 처리 경계 |
| #363 | 구조화 로그·Correlation ID (metric label로 사용하지 않음) |
| #364 | Dashboard/Alert 및 미수집·stale 표현 |
