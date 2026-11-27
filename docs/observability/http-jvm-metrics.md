# HTTP API 및 JVM Metrics (#359)

격리 관측이 켜졌을 때만 Spring MVC의 기존 `ServerHttpObservationFilter`와 Micrometer
`http.server.requests` Timer에 분류와 bucket을 적용한다. 새 HTTP 필터·타이머·바인더는 등록하지 않는다.
별도 registry나 tracer도 추가하지 않는다. [관측 기반](../architecture/observability.md)의 포트·권한·책임은 동일하다.

## HTTP 집계 계약

| Label | 허용 값 |
| --- | --- |
| `method` | Spring의 표준 HTTP method 또는 `UNKNOWN` |
| `uri` | MVC가 고른 `/api/v1/…` template만 사용. MVC 이전 인증·인가 종료는 `SECURITY`, 등록된 API template이 없으면 `UNMATCHED` |
| `status` | 서버가 관측한 표준 HTTP 상태 또는 `UNKNOWN` |
| `outcome` | `SUCCESS`, `REDIRECT`, `INFORMATIONAL`, 오류 코드가 확정된 4xx `EXPECTED_REJECTION`, 코드 없는 4xx `CLIENT_ERROR`, 5xx `SERVER_ERROR`, 그 외 `UNKNOWN` |
| `error_code` | 응답 상태와 일치하는 기존 공통·보안·도메인 enum 코드만 허용. 오류가 없으면 `NONE`, 코드가 없는 오류 또는 분류할 수 없는 상태는 `UNCLASSIFIED` |

Advice와 Security writer는 이미 결정된 코드를 현재 observation에만 전달한다. 응답 본문을 버퍼링하지
않으며 요청 상태, 코드, JSON 구조 및 Security filter를 바꾸지 않는다. 예를 들어 409 `MEMBER_001`,
검증 400 `COMMON_001`, 형식 400 `COMMON_002`, Security 401/403 `AUTH_001/002`로 집계한다.
매핑된 endpoint의 리소스 부재 404와 주소 미매핑을 구분한다. 현재 advice가 미매핑 정적 리소스 예외를
500으로 반환하면 `UNMATCHED/500/COMMON_003`이다. 지표가 임의로 404로 바꾸지 않는다.
인증 이전 거절에서는 route를 추측하지 않는다. 원문 경로·query·ID·이메일·토큰·예외 메시지·클래스명은
라벨에 없다. 기존 catch-all의 예외 로그는 예외 타입만 남긴다(전체 구조화 로깅은 #363).

관리 listener 및 API listener의 `/actuator` 시도는 제외한다. Servlet `ERROR` dispatch는 별도
요청으로 계수하지 않는다. MVC async 완료/timeout도 요청당 한 번이다. Spring Framework 7.0.8의
timeout 콜백이 아직 MVC 결과를 쓰기 전에 끝날 경우 redispatch의 최종 응답을 기다린다.
서버 Timer는 최초 Servlet 관측부터 처리 완료까지의 벽시계 시간이다. 컨테이너가 필터 전에 거절했거나
클라이언트가 응답을 못 받았는지, DB가 실제 commit됐는지, Kafka가 ACK했는지는 이 지표로 판단하지 않는다.

## Histogram과 PromQL

- 이 Timer에만 `5, 10, 25, 50, 100, 250, 1000, 3000 ms`와 `+Inf`의 고정 classic bucket을 둔다.
  범용 자동 bucket과 client percentile은 비활성화한다. 마지막 유한 경계 이상은 충분히 분해하지 못한다.
- 라우트 63개, 라벨 조합 119개까지만 개별 집계한다. 초과는 request를 드롭하지 않고 단일
  `uri="OVERFLOW"` 조합에 합친다. 120개 × (bucket 9 + count/sum/max 3) = 최대 1,440 HTTP
  sample/target. 2,000 sample scrape 상한에서 기존 JVM/pool과 후속 meter 예산을 함께 검토한다.
  `OVERFLOW`에는 개별 상태가 없으므로 총수에는 포함하되 route·상태별 결과는 불완전함을 표시한다.
- 기본 타이머 비교 모드는 bucket만 꺼진다. 수집 설정 off, scrape unavailable/stale, 0건은 구분한다.
  새 시계열은 샘플 전까지 부재할 수 있다. p99는 해당 그룹에 100건 미만이면 희소 추정치로 표시하고
  운영 임계값으로 사용하지 않는다. 요청이나 bucket 표본이 없으면 percentile은 제공하지 않는다.

```promql
# route·method·status별 최근 5분 평균 요청률(단위 req/s)
sum by (uri, method, status) (rate(http_server_requests_seconds_count{job="reservation"}[5m]))

# route·method별 p95 (초); 0.50 및 0.99도 같은 방식
histogram_quantile(0.95, sum by (le, uri, method) (
  rate(http_server_requests_seconds_bucket{job="reservation"}[5m])
))

# 표본 수를 보고 작은 p99를 숨기거나 표시
sum by (uri, method) (increase(http_server_requests_seconds_count{job="reservation"}[5m]))
```

instance마다 계수 reset을 처리한 뒤 합산한다. percentile은 `rate`된 bucket을 `le` 기준으로
합친 후 추정하며 instance별 p99를 평균하지 않는다. [Prometheus histogram 문서](https://prometheus.io/docs/practices/histograms/)
참고. 서버 5xx 비율의 분모는 관측된 전체 HTTP 완료, 분자는 `status=~"5.."`이다.
예상 409는 분모에 포함되지만 5xx가 아니다(`status="409",outcome="EXPECTED_REJECTION"` 별도).
k6 transport 오류/status 0은 클라이언트 관측의 별도 분자이며 서버 비율에 더하지 않는다.

## JVM·프로세스

- `jvm_memory_used_bytes`, `jvm_memory_committed_bytes`, `jvm_memory_max_bytes`: JVM heap/nonheap과
  pool별 bytes. JVM 또는 pool이 한도를 제공하지 않으면 미정이며 RSS로 변환할 수 없다.
- `jvm_gc_pause_seconds_count/sum`: pause 횟수·누적 초(GC 이벤트가 관측된 경우). `jvm_threads_live_threads`,
  `jvm_threads_states_threads` 등은 현재 JVM의 thread 수다.
- `process_cpu_usage`, `system_cpu_usage`: JVM이 반환한 CPU 사용 비율(0–1), `process_cpu_time_ns_total`은
  노출될 때 JVM이 제공한 누적 CPU 시간(ns)이다. `process_uptime_seconds`는 가동 시간(초)이다.
  JVM/OS가 지원하지 않는 process RSS나 CPU 통계를 heap 또는 0으로 대체하지 않는다.
  [격리 환경의 Docker stats와 JMX 표본](../../load-test/README.md)은 컨테이너 전체 CPU·메모리 cgroup
  사용량/한도와 별도 시점의 JVM 값을 다룬다. JVM heap, RSS, 전체 컨테이너 메모리는 서로 다르다.

## 같은 요청 구간의 k6 대조

같은 JAR, seed/날짜, warm cache, distributed room 및 기존 bounded `mixed` 또는 `read-heavy`를 사용한다.
각 모드는 새 격리 DB에서 시작한다. 실행 명령은 [runbook](runbook.md#http-서버와-k6-동일-구간-검증)을 참고한다.

runner는 시드·preflight 이후 새 성공 scrape를 기다린 뒤 k6를 실행한다. k6 종료 후, 다른 업무 HTTP가
시작되기 전에 새 성공 scrape 시각을 다시 잡는다. 내부 Prometheus에서 두 시각의 동일 프로세스를
확인하고 `_count/_sum/_bucket` 차분을 집계한다. `+Inf`와 `_count`가 일치해야 한다. 누락·재시작·수집 실패를
0으로 기록하지 않는다. transport 오류가 없을 때만 서버 count와 `k6.http_reqs` 정합이 성립한다.
차이가 나면 해당 결과를 조사하고 쓰기를 재생하지 않는다.

`k6 http_req_duration`은 요청 송신·응답 대기·수신의 클라이언트 시간(보통 ms, 연결/TLS/blocked 별도)이다.
서버 Timer는 컨테이너 안에서 관측한 처리 시간(초)이며 클라이언트 수신 시간·네트워크와 일치하지 않는다.
고정 15초 scrape 경계는 부하 구간보다 넓고, 임의 운영 구간에 이 차분 방식을 그대로 적용하지 않는다.

### 격리 비교 기록

동일 JAR, seed 359, 체크인 2026-12-30, `mixed/warm/distributed`와 같은 컨테이너 예산으로
각 모드 한 번씩 실행했다. Prometheus 수집 전후 차분이 각 실행의 k6 총수 및 DB·재고·이벤트 검증과
일치했다. transport 오류·timeout·drop은 모두 0이었다.

| 관측치 | 기본 Timer | 고정 histogram |
| --- | ---: | ---: |
| 서버 count / k6 count | 108 / 108 | 112 / 112 |
| 서버 평균 (ms) | 10.39 | 7.56 |
| 서버 p50 / p95 / p99 (ms) | bucket 비활성 | 6.09 / 24.11 / 43.00 |
| k6 원시 p50 / p95 / p99 (ms) | 8.50 / 26.57 / 59.54 | 6.97 / 22.40 / 35.69 |
| 마지막 scrape sample 수 / 시간 | 154 / 59.34 ms | 343 / 58.19 ms |
| 측정 중 Docker Backend 표본 CPU / 메모리 | 19.01% / 531.4 MiB | 10.98–12.75% / 520.2–521.9 MiB |

open workload의 종료 경계에서 read iteration 한 번(HTTP 4건)이 추가될 수 있다.
154→343은 활성 Timer 조합 21개에 bucket 9개씩 추가된 결과다. 지연과 CPU·메모리는 표본이 적고
백그라운드 처리·호스트 상태도 같지 않아 histogram의 순수 비용, 성능 개선, 운영 p99 또는 SLO로
해석할 수 없다. route별 p99에는 특히 표본이 부족하다.
