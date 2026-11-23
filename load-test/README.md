# 격리 HTTP 부하 테스트 (#342)

**로컬에서 러너가 만든 전용 스택**의 Boot JAR에만 HTTP를 보낸다. URL 옵션이나 개발/운영
포트가 없다. Vite/프록시 측정, 신규 기능, 용량 보장 및 운영 SLO는 범위 밖이다.
[기존 격리 통합 스모크](../docs/testing/frontend-backend-integration.md)와
[SQL/서비스 Baseline](../docs/performance/read-api-query-baseline.md)은 다른 측정이다.

## 실행 및 복구

Node.js 24, Java 21, Docker Linux 엔진(Desktop 포함), Compose가 필요하다. k6는 로컬 설치 없이
Compose의 Grafana k6 2.0.0 이미지와 digest를 사용한다. 저장소 루트에서 실행한다.

```powershell
Push-Location backend
.\gradlew.bat bootJar
Pop-Location
node --test load-test/harness.test.mjs
$stay = (Get-Date).AddDays(35).ToString('yyyy-MM-dd')
node load-test/run.mjs prepare --confirm=isolated --seed=342 "--stay=$stay" --profile=baseline --cache=warm --room=distributed
node load-test/run.mjs run <run-id> --confirm=<run-id>
node load-test/run.mjs cleanup <run-id> --confirm=<run-id>
```

macOS/Linux는 `(cd backend && ./gradlew bootJar)`를 사용하고 미래 날짜를 직접 적는다.
두 숙소 시간대를 고려하여 체크인 날짜는 UTC 기준 9~150일 이후로 제한한다. 준비 명령이 출력한
ID를 사용한다. 같은 seed·날짜·설정으로 다시 준비하려면 `reset <run-id> --confirm=<run-id>`를
실행한다. reset은 옛 DB를 비우지 않고 **새 ID**를 발급한다. 옛 스택은 별도 cleanup 대상이다.

- `reservation-load-<id>`는 전용 internal bridge에만 붙으며 포트를 **전혀 publish하지 않는다**.
  MySQL 8.4·Redis 7.4·Kafka 4.3.1(단일 브로커·3 파티션)과 Media 볼륨을 공유하지 않는다.
- 기존 격리 실행기의 임의 프로젝트/자격증명 방식을 재사용한다. Compose env 파일은 전용 빈 파일이다.
  백엔드는 저장소가 보이지 않는 `/isolated`의 JAR만 읽고 classpath만 사용하는 동시에
  `spring.config.import`를 빈 값으로 지정한다. 두 후보 위치에 개발 `.env`가 없는지도 확인한다.
- 시작·seed·부하·정리는 명시적 확인과 manifest가 필요하다. 이미 존재하는 이름/라벨, 외부 네트워크
  부착, 변경된 JAR나 컨테이너 ID, 원격 Docker를 거절한다. 가입 API로 만든 테스트 ADMIN
  1명만 전용 SQL로 승격한다. 쓰기 VU는 각각 다른 USER로 로그인하고 토큰 발급은 측정에서 제외한다.
- 실패 시 자동 재전송·정리하지 않는다. 다른 터미널에서
  `node load-test/run.mjs stop <run-id> --confirm=<run-id>`로 해당 k6만 중지한다.
  `docker ps -a --filter label=reservation.load.run=<run-id>`, `docker volume ls --filter label=reservation.load.run=<run-id>`
  및 결과를 확인한다. 셸이 비정상 종료되어 `operation.lock`이 남으면 기록된 PID와 소유 프로세스가
  없음을 확인한 뒤 그 파일만 제거한다. 다른 소유권이 섞인 경우 좁혀 조사하며 전역 prune은 하지 않는다.
- `cleanup`은 확인한 컨테이너·네트워크·볼륨만 삭제하고, `.local/load-test/<run-id>`의 자료는
  비교용으로 남긴다. 토큰이 들어 있는 전용 볼륨은 cleanup 시 함께 제거된다.

## 데이터와 단계

8숙소×3객실(24), 지역 4곳·`Asia/Seoul` 및 `America/New_York`, 합성 PNG 8장,
메타데이터 객실 8개, 예약/취소 정책 각각 4개, 객실당 5일·총 120개 재고, 첫날 가격 24개,
ADMIN 1 + USER 8, 본인 확정 예약 4건을 생성한다. 고정 seed/날짜는 구성과 가격을 재현한다.
자격증명·임의 번호·시간은 지문에 포함하지 않는다. 숙박은 체크아웃 제외, 변경은 override가
없는 2박, 취소는 무료 기간이다. 넉넉한 재고 32실과 유한 재고 1실을 분리한다.

| 프로필 | 계획 |
| --- | --- |
| `smoke` | 단일 VU가 조회와 예약 생명주기를 1회씩 순서대로 |
| `baseline` | 1 VU 조회 8회 + 2 VU별 생성→변경→취소 2회 |
| `read-heavy` | 2 iterations/s × 12초, 최대 2 VU |
| `write-heavy` | 4 VU별 쓰기 여정 3회 |
| `mixed` | read-heavy + 2 VU별 쓰기 여정 2회 |
| `exhaustion` | 4 VU가 한 객실에 생성 1회씩; 1건 성공 + 3건 `409 INVENTORY_005` |

`--room=hot`은 같은 객실, `distributed`는 VU별 다른 객실이다. 소진은 `hot`만 허용한다.
`--cache=warm`은 선행 상세 조회, `cold`는 해당 run의 상세 키만 제거한 뒤 첫 순회,
`off`는 Backend 응답 캐시만 비활성화(인증/락은 유지)한다. cold는 smoke/baseline/read-heavy에
한하며 read-heavy의 cold는 8회 폐쇄형이다. detail cold는 JVM/DB cold가 아니다.
준비 → seed·단일 사용자 HTTP/소유권 검증·warm-up → k6 → 부하 중지 → 이벤트 drain → 독립 SQL
검증 순이다. 준비와 로그인은 측정 밖이며, 짧은 최초 실행으로 JVM steady state를 보장하지 않는다.

## 관측·결과 형식

`.local/load-test/<id>` 아래 JSON 파일을 보관한다(Git 제외). 요청·응답 본문, 토큰·투숙객 정보,
원시 SQL 및 애플리케이션 로그는 저장·공유 대상이 아니다. 브로커 로그는 집계만 저장한다.

| 파일 | 범위 |
| --- | --- |
| `manifest.json`, `results/seed.json` | SHA/JAR 해시·이미지·자원·프로필·격리 식별자·단계·데이터 규모/지문 |
| `results/raw.jsonl`, `k6-summary.json`, `summary.json` | 원시 metric, endpoint·시나리오별 표본/RPS/p50/p95/p99, HTTP/도메인 분포, 제공/달성 iteration, drop/timeout |
| `results/observations.jsonl` | 전·후 및 목표 5초마다 JVM PID/heap/GC·Hikari active/idle/total/pending(Local JMX), Docker 자원, MySQL digest/rows/시간/잠금/slow, Redis INFO/명령, Outbox·Kafka lag와 WARN/ERROR 합계 |
| `results/verification.json` | 예약·재고·박별/합계 가격 및 이벤트/처리 원장의 사전/사후 대조, lag와 drain 시간 |

RPS는 첫~마지막 측정 요청 완료 간격 기준이다. n<100이면 p99를 짧은 표본으로 표시한다.
예상 409도 HTTP 오류율에 남고 별도로 분류한다. 연결 실패·5xx·확인할 수 없는 성공 쓰기는
즉시 중지하며 자동 재전송하지 않는다. 시스템 오류, drop, 계획 대비 부족, 불변식 위반이나 이벤트 drain 실패도
실행 실패다. MySQL 250ms 이상은 slow table에서 원문 없이 집계한다. Redis keyspace hits/misses는
전체 인스턴스 통계이며 detail hit rate가 아니다. 누적 지표는 전후 차이를 본다. 샘플링 오버헤드는
`collectorMs`로 기록하며, 짧은 실행은 중간 표본이 없을 수 있다. 미수집 값은 `unavailable`에 표시한다.
요청별 락/재시도 횟수, SQL별 p99, 실제 포화 용량은 이 단계에서 단정하지 않는다.

동일 Docker 호스트에서 MySQL 2 CPU/1536MiB, Kafka 1 CPU/1024MiB, Redis 0.5 CPU/320MiB,
Backend 2 CPU/1536MiB(heap 512MiB), fixture 0.75 CPU/256MiB, k6 1 CPU/320MiB를 제한한다.
같은 호스트의 간섭으로 생성기와 대상의 자원 사용을 구분해 읽어야 한다.
후속 #343~#347에서 VU/제공률을 높이기 전에 생성기 여유·표본 수·오차를 확인한다.
OOM, 지속 오류, 연결/락 대기, 복구되지 않는 backlog, 정합성 위반은 중단 조건이다.
[k6 메트릭](https://grafana.com/docs/k6/latest/using-k6/metrics/reference/)과
[개방형/폐쇄형 모델](https://grafana.com/docs/k6/latest/using-k6/scenarios/concepts/open-vs-closed/)에 맞춰
제공률과 달성률을 구분한다.
