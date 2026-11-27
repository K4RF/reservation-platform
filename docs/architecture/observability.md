# 관측 기반 환경 (#358)

기존 HTTP/JWT·OAuth2와 예약 Transaction은 변경하지 않는다. 이 변경은 내부 관리 listener, 기본 지표 수집,
격리 Grafana datasource를 제공한다. 서비스 SLO, 업무 지표, Dashboard, Alert는 아직 제공하지 않는다.

## 구성과 자원

- Java 21, Spring Boot 및 Actuator 4.0.7, Gradle 9.5.1을 유지한다. Boot BOM이 Micrometer Prometheus
  1.16.6과 HikariCP 7.0.2를 결정한다. 버전은 아래 명령으로 확인할 수 있다.
- 평소 로컬 개발·통합·테스트와 기본 부하 실행은 관리 listener와 Prometheus export가 꺼져 있다.
  opt-in 부하 환경만 내부 `backend:9091`을 연다. API 8080, 관리 9091, Prometheus 9090,
  Grafana 3000 모두 호스트에 publish하지 않는다. HTTP Basic은 이 전용 내부 네트워크의 검증에만 사용한다.
  운영 네트워크/TLS, 인증서·Secret 관리 정책을 의미하지 않는다.
- [overlay](../../infra/observability/compose.yaml)는 Prometheus 3.13.5와 Grafana 13.3.2를 각각 이미지
  digest로 고정한다. Prometheus 0.5 CPU/256 MiB, Grafana 0.5 CPU/384 MiB를 제한한다.
  Prometheus TSDB는 6시간/256 MiB retention을 설정한다(영속 사용량에 대한 하드 디스크 한도는 아님).
  datasource는 파일로 자동 구성하며 별도 전용 볼륨 두 개를 쓴다.
- Prometheus는 고정 target의 `/actuator/prometheus`만 15초 간격/3초 timeout으로 읽는다.
  응답 크기 2 MB, 2,000 samples, sample마다 label 16개·value 200 bytes를 제한한다.
  scrape는 구간별 운영 SQL, Redis INFO 또는 Kafka CLI를 실행하지 않는다.
- runner가 실행마다 독립적인 암호를 생성해 읽기 전용 파일로 연결한다. 정상 기동과 부하 전후에는
  Grafana 인증 및 datasource, 최근 scrape, health와 경로 차단을 확인한다. 다른 ID/label, 네트워크,
  호스트 포트, mount, 이미지나 임의 endpoint는 거절한다. [실행과 복구](../observability/runbook.md)를 참고한다.

```powershell
cd backend
.\gradlew.bat dependencyInsight --configuration runtimeClasspath --dependency micrometer-registry-prometheus
.\gradlew.bat dependencyInsight --configuration runtimeClasspath --dependency HikariCP
```

## 관리 listener와 health 계약

전용 `reservation-scraper` Basic 계정으로만 아래 **정확한 GET 경로**를 열며 API JWT(ADMIN 포함),
익명 사용자, API 포트의 동일 경로, JMX, 쓰기와 discovery를 허용하지 않는다.
`env`, `configprops`, `heapdump`, `logfile`, `shutdown` 등은 제공하지 않는다.
health에는 상태와 집계 응답의 공개 그룹 이름만 나오며, component 상세·연결문자열·예외 원문은 숨긴다.

| 경로 | 의미와 범위 |
| --- | --- |
| `/actuator/health/liveness` | Spring 애플리케이션 liveness만 읽는다. DB/Redis/Kafka 장애를 재시작 조건으로 쓰지 않는다. |
| `/actuator/health/readiness` | 애플리케이션 readiness와 Boot JDBC `db`를 확인한다. DB는 핵심 읽기·쓰기 경로다. Redis/Kafka 일부 장애는 서비스 전체의 비준비로 간주하지 않는다. |
| `/actuator/health` | 등록된 전체 contributor 집계다. JDBC, Redis, Spring 가용성 및 Boot의 기타 기본 contributor가 포함될 수 있다. Redis 장애 시에도 liveness/readiness가 `UP`일 수 있다. |
| `/actuator/prometheus` | 기본 runtime·pool·HTTP meters를 읽는다. 집계 health가 DOWN이라고 자동으로 scrape 오류가 되지 않는다. |

Redis는 상세 응답 cache에서는 DB fallback, 예약 생성 분산 Lock에서는 실패, Refresh에서는 Token 관련
요청 영향으로 구분한다. 집계 Health만으로 어느 Redis 경로가 정상인지 단정하지 않는다. Kafka 자동 health
contributor를 추가하지 않았다. 브로커 장애 중에도 DB와 Outbox에 저장될 수 있으므로 health `UP`은 Kafka ACK,
Outbox drain 또는 Consumer 처리 완료의 증거가 아니다.

일반 health 조회에는 응답 cache 5초를 설정한다. run probe의 요청 timeout은 4초이며 사람이 반복 확인할
때는 15초 이상 간격을 권장한다. health가 지연되더라도 예약 요청을 재실행하지 않는다. 응답이 timeout으로
끝나도 내부 JDBC 획득이 즉시 취소됨을 가정하지 않으므로 health를 고빈도 SQL poller로 사용하지 않는다.

## 후속 작업

[지표 카탈로그](../observability/metrics-catalog.md)와 [runbook](../observability/runbook.md)은 후속 작업의 공통 계약이다.
분산 tracing stack, raw payload 수집, 클라우드·운영 배포·HA는 범위 밖이다. 기존 v0.5.0 격리 부하 기록은
운영 용량·SLO나 마일스톤 전체 관측성의 근거로 사용하지 않는다.
