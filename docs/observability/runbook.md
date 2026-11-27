# 격리 모니터링 실행과 복구 (#358)

이 절차는 기존 [부하 runner](../../load-test/README.md)와 같이 전용 Compose만 사용한다. 개발 DB, 공유
볼륨, 운영 대상, 원격 Docker, 수동 외부 컨테이너 attach는 금지한다. Dashboard/UI는 호스트에 열지 않는다.
Docker Linux 엔진에 6 vCPU 및 6 GiB 이상을 제공하고, Node.js 24와 Java 21을 사용한다.

```powershell
Push-Location backend
.\gradlew.bat bootJar
Pop-Location
$stay = (Get-Date).AddDays(35).ToString('yyyy-MM-dd')
node load-test/run.mjs prepare --confirm=isolated --seed=358 "--stay=$stay" --profile=smoke --cache=warm --monitoring=on
# 아래 <run-id>는 바로 위가 발급한 값으로 치환
node load-test/run.mjs monitor-check <run-id> --confirm=<run-id>
node load-test/run.mjs run <run-id> --confirm=<run-id>
node load-test/run.mjs cleanup <run-id> --confirm=<run-id>
```

macOS/Linux는 `(cd backend && ./gradlew bootJar)`와 UTC 기준 9~150일 미래 체크인 날짜를 사용한다.
`--monitoring=on`은 prepare에만 사용하며, 두 번째 Backend가 있는 peer 프로필에는 사용할 수 없다.
기본 실행에는 모니터링이 없고, 옵션을 켜면 자원이 달라지므로 이전 Baseline 결과와 같은 조건으로 해석하지 않는다.

## 읽기·종료·실패 대응

1. `monitor-check`가 `up=1`, duration, sample 수, 최근 성공 시각, 세 health 상태와 Grafana datasource를
   확인한다. 준비 결과는 manifest의 `monitoringStartup`, 부하 전후는
   `.local/load-test/<run-id>/results/monitoring.json`에 기록된다. 요약만 공유한다.
2. 준비 또는 monitor-check 실패를 0으로 바꾸지 않는다. `up=0`은 실패 응답이고, 결과 없음/오래된
   결과/검증 불가와 구분한다. 실패한 prepare/run은 부하를 자동 재시작하지 않는다. 소유 라벨의
   컨테이너 상태와 관리 포트 설정을 먼저 확인하고, 실행 중이라면 runner의 `stop`으로 해당 k6만 중지한다.
3. 앱과 DB가 정상이고 collector만 내려갔다면 업무 요청 재실행·DB 복구 대상이 아니다. datasource 파일과
   scrape 상태를 확인한다. 실패한 의존성은 집계/liveness/readiness 의미를 [설계 문서](../architecture/observability.md)에
   따라 나누어 본다. Redis와 특히 Kafka의 자체 근거를 확인한 뒤에만 장애 해소를 선언한다.
4. `cleanup`은 정확한 ID와 소유권 검사를 통과한 Docker 컨테이너·네트워크·볼륨 및 생성된 Secret 파일만
   삭제한다. 결과와 manifest는 남는다. 다른 서비스가 attach되어 있거나 ID가 바뀐 상태에서 강제 정리·prune을
   하지 않는다. 새 실행으로 다시 확인할 때는 기존 DB를 지우지 않는 runner `reset`을 사용한다.

재시작 검증은 disposable stack에서 현재 manifest의 Prometheus/Grafana 컨테이너 ID·소유 라벨·격리
네트워크를 먼저 확인한 뒤 해당 프로세스만 재시작하고 `monitor-check`를 다시 실행한다. 누락된 scrape는
다음 정상 scrape 전까지 가용하지 않다. 설정, 자격증명, 응답 본문, raw Docker 환경값을 로그나 PR에
복사하지 않는다.

## 관리 listener 환경변수

일반 개발/통합 실행 시 아래 변수를 주입하지 않는다. 격리 runner는 파일 방식과 예산을 자동 구성한다.
Java의 전용 테스트처럼 로컬 단독 확인이 필요하면 별도 loopback listener를 사용하고 API와 같은 포트는 쓰지 않는다.

| 변수 | 기본값 및 역할 |
| --- | --- |
| `RESERVATION_OBSERVABILITY_ENABLED` | `false`; opt-in에서만 `true` |
| `RESERVATION_OBSERVABILITY_PORT` | `-1`; 격리 runner는 `9091` |
| `RESERVATION_OBSERVABILITY_ADDRESS` | `127.0.0.1`; 격리 runner만 전용 internal network 안에서 `0.0.0.0` |
| `RESERVATION_SCRAPE_PASSWORD_FILE` | 전용 password 파일 경로. runner가 자동 생성한다. |
| `RESERVATION_SCRAPE_PASSWORD` | 파일 대신 별도 실행 환경에만 주입할 때 사용. 두 방식을 동시에 사용할 수 없다. |

자격증명은 32바이트 이상의 난수를 Base64URL로 생성한다(코드는 32~128자의 허용 형식을 검사).
Grafana는 별도 랜덤 admin 암호를 파일로 주입하며 익명·가입을 끈다. Prometheus 관리 API는 전용 네트워크
내부에서만 접근한다. 이 로컬 방식에 운영 보안 가정을 적용하거나 임의 포트를 publish하지 않는다.
