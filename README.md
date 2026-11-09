# Reservation Platform

[![Backend CI](https://github.com/K4RF/reservation-platform/actions/workflows/backend-ci.yml/badge.svg)](https://github.com/K4RF/reservation-platform/actions/workflows/backend-ci.yml)
[![Frontend CI](https://github.com/K4RF/reservation-platform/actions/workflows/frontend-ci.yml/badge.svg)](https://github.com/K4RF/reservation-platform/actions/workflows/frontend-ci.yml)

동시 요청에서 예약 재고의 정합성을 지키는 과정을 구현하고 검증하는 개인 포트폴리오 프로젝트입니다.

회원·숙소·객실·예약 기능을 기반으로 동시성 제어, 조회 최적화, Redis 캐시,
Kafka 이벤트 처리를 단계적으로 적용했습니다. 프론트엔드에서는 공개 숙소 탐색부터
예약 생성·본인 예약 조회·일정 변경·취소까지 연결합니다.

이 README는 프로젝트 개요와 실행 방법을 안내합니다.
세부 정책·설계 결정·실험 결과는 [상세 문서](#상세-문서)에서 확인할 수 있습니다.

## 목차

- [현재 구현](#현재-구현)
- [핵심 설계](#핵심-설계)
- [기술 스택](#기술-스택)
- [저장소 구조](#저장소-구조)
- [로컬 실행](#로컬-실행)
- [테스트와 CI](#테스트와-ci)
- [상세 문서](#상세-문서)
- [로드맵과 남은 범위](#로드맵과-남은-범위)
- [개발 규칙](#개발-규칙)

## 현재 구현

### 사용자 기능

- 회원가입, 이메일/비밀번호 로그인, Google OAuth2 로그인
- JWT 인증, Redis 기반 Refresh Token 재발급, 로그아웃
- 비로그인 숙소 검색·상세 조회, 날짜/인원별 가용 객실·적용 요금 조회
- 숙소 검색 API는 기존 정확 지역 필터와 별도로 [자유 목적지 검색](docs/architecture/accommodation-integrated-search.md)을 지원합니다.
  [지역 자동완성 API](docs/architecture/accommodation-location-suggestions.md)는 활성 숙소의 도시·지역 후보와 정확 검색 파라미터를 반환합니다.
  Home/Search 입력 연결은 별도 작업입니다.
- 객실 상세 Modal/Mobile Sheet 조회와 가용 결과 기반 명시적 객실 선택
- 숙소·객실 Media 읽기와 공통 이미지/Gallery, ADMIN 사진 관리 화면 연결
- 대표 투숙객 정보를 포함한 예약 생성과 완료 결과 조회
- 본인 예약 목록·상세 조회, 일정 변경, 저장 취소 정책 확인 및 취소

예약 조회·변경·취소는 JWT 소유자 기준입니다. `ADMIN`도 사용자 예약 영역에서는
자기 예약만 관리합니다. `/admin`에는 ADMIN 전용 공통 Layout과 숙소·객실·가격·재고 메뉴가
있으며, 숙소·객실 목록·생성·수정·운영 상태와 숙소 예약/취소 정책 입력을 연결했습니다.

### 관리자 API

- 숙소·객실 등록, 정보 수정, `ACTIVE/INACTIVE` 운영 상태 관리
- 숙소별 예약 가능 조건과 취소 정책 관리
- 객실별 날짜 재고·`OPEN/CLOSED` 판매 상태 및 날짜별 가격 관리
- 숙소·객실 JPEG/PNG 업로드·출처/사용권·대표/순서·교체/삭제 및 내구성 있는 파일 정리

숙소·객실 관리와 단일 날짜의 적용 가격 조회·Override 생성/수정 화면은 연결되어 있습니다.
재고는 날짜 범위 Calendar 조회와 단일 날짜의 총수량·판매 상태 관리까지 연결되어 있습니다.
미생성 날짜는 별도 표시하고 예약·가용 수량은 수정하지 않습니다. 가격·재고 일괄 설정과 삭제/복원은 지원하지 않습니다.
정책 조회·삭제 API는 없어 정책은 명시적 생성/수정과 성공 응답 확인만 지원합니다.
전체 API의 Method·요청·응답·권한은 실행 후 [Swagger UI](http://localhost:8080/swagger-ui.html)에서 확인합니다.

## 핵심 설계

### 예약·가격·재고

- 숙박 기간은 `[체크인, 체크아웃)`입니다. 체크아웃 날짜의 재고는 점유하지 않습니다.
- 예약·재고 증감·가격 스냅샷은 하나의 DB 트랜잭션에서 처리합니다.
- 각 숙박일의 날짜별 가격 또는 객실 기본 가격을 합산해 확정 금액을 저장합니다.
- 일정 변경은 공유 날짜의 점유를 유지하고, 새 기간 전체를 현재 가격으로 다시 계산합니다.
- 취소는 예약에 저장된 정책으로 수수료·예상 환불액을 계산하고 숙박일 재고를 반환합니다.

프론트엔드의 예상 요금은 확정 가격이 아닙니다. 일반 가용성 조회는 기존 예약의 점유를
제외하지 않으므로, 변경 가능 여부의 최종 판단은 변경 API가 수행합니다.

취소 전 금액 견적 API는 없습니다. 저장 정책 안내 후 실제 취소 요청에서 서버가 금액을
계산하며, **예상 환불액은 결제 취소나 환불 완료를 의미하지 않습니다.**

### 동시성 제어

예약 생성은 다음 순서로 처리합니다.

```text
객실 단위 Redis 분산 락
  → 새 DB 트랜잭션에서 재고 조회·예약 생성
  → RoomInventory의 JPA @Version으로 동시 쓰기 충돌 감지
  → 낙관적 충돌 시 새 트랜잭션에서 재시도 (최초 포함 최대 3회)
```

분산 락과 재시도는 예약 생성에 적용됩니다. 일정 변경·취소는 재고 Version 충돌을
감지하지만 같은 분산 락·재시도 경로를 사용하지 않습니다.

선정 근거와 비교 결과는 [동시성 전략 ADR](docs/adr/006-reservation-concurrency-strategy.md)과
[전략 비교](docs/performance/concurrency-strategy-comparison.md)를 참고하세요.

### 조회·캐시·이벤트

- MySQL을 원본 데이터로 사용하고 JPA Specifications로 검색·필터를 구성합니다.
- 숙소·객실 **단건 응답만** Redis에 캐시합니다. 가용성·가격·재고·예약 조회는 캐시하지 않습니다.
- Media는 목록 대표 1장/상세 최대20장을 페이지 단위로 조회합니다. 기존 행은 사진을 추측하지 않고 null/빈 배열을 반환합니다.
- 예약 생성·변경·취소와 Outbox 이벤트를 같은 DB 트랜잭션에 저장합니다.
- Outbox Publisher가 Kafka 발행을 처리하고, Consumer는 이벤트 ID로 중복을 방지합니다.
- Consumer 실패에는 제한 재시도와 DLT 격리를 적용합니다. 현재 후처리는 Audit Log Stub입니다.

예약 이벤트의 발행은 at-least-once입니다. Consumer 멱등성의 트랜잭션 범위와
외부 부작용의 한계는 [이벤트 계약](docs/architecture/reservation-event-contract.md)에 정리했습니다.

## 기술 스택

버전은 저장소의 빌드·패키지·컨테이너 설정 기준입니다.

| 영역      | 주요 기술                                                                      |
| --------- | ------------------------------------------------------------------------------ |
| Backend   | Java 21, Spring Boot 4.0.7, Gradle Wrapper 9.5.1                               |
| Web·인증  | Spring MVC, Validation, Spring Security, OAuth2 Client/JOSE, JWT               |
| DB        | Spring Data JPA, MySQL 8.4, MySQL Connector/J                                  |
| Redis     | Redis 7.4, Spring Data Redis/Cache, Redisson 4.7.0                             |
| 이벤트    | Spring Kafka, Apache Kafka 4.3.1, Transactional Outbox                         |
| API 문서  | Springdoc OpenAPI 3.0.3, Swagger UI                                            |
| Frontend  | React 19.3, TypeScript 6.0, React Router 7.18.4, Vite 8.3, pnpm 11.19.0        |
| 테스트·CI | JUnit, H2, Testcontainers 2.0.5, Vitest, React Testing Library, GitHub Actions |

전체 의존성은 [backend/build.gradle](backend/build.gradle)과
[frontend/package.json](frontend/package.json)을 기준으로 확인합니다.

## 저장소 구조

```text
reservation-platform/
├── backend/               # Spring Boot·Gradle 프로젝트
├── frontend/              # React·TypeScript·Vite·pnpm 프로젝트
├── docs/
│   ├── architecture/      # 도메인 정책·캐시·이벤트 구조
│   ├── adr/               # 설계 결정
│   ├── erd/               # DB 구조·기존 DB 업그레이드 SQL
│   ├── testing/           # 테스트 범위·실제 연동·수동 검증 기록
│   ├── api/               # API 오류·요청 계약
│   └── performance/       # 동시성·조회 전략 비교
├── .github/               # Issue/PR 템플릿·Backend/Frontend CI
├── infra/                 # 격리 통합 검증용 Compose 및 인프라 폴더
├── scripts/               # 격리 Frontend/Backend 통합 실행기
├── load-test/             # k6 관련 placeholder
├── docker-compose.yml     # 로컬 MySQL·Redis·Kafka
├── .env_sample            # 환경변수 예시 (비밀값 없음)
└── AGENTS.md              # 저장소 작업 규칙
```

Gradle 프로젝트 루트는 `backend/`입니다. 프론트엔드는 `frontend/`에서 별도로 실행합니다.

## 로컬 실행

Media 파일은 `MEDIA_STORAGE_ROOT`(기본 Backend cwd의 `.local/media`)에 보관하며 Git에서 제외합니다.
DB와 파일을 함께 영속 보관해야 합니다. 기존 DB의 [Media 테이블 추가 SQL](docs/erd/mysql-catalog-media-upgrade.sql)은
대상과 백업을 검토한 뒤 적용하세요.
공개 URL·용량/형식·캐시 v2는 [Media 읽기 계약](docs/architecture/catalog-media.md)을 참고하세요.
ADMIN 관리 입력 예시·If-Match 재조회·정리 설정은 [Media 관리/파일 수명주기](docs/architecture/media-management.md)를 따릅니다.
기존 DB의 [정리 테이블 추가 SQL](docs/erd/mysql-media-file-cleanup-upgrade.sql)도 대상/백업 검토 후 적용해야 합니다.

### 1. 준비

- Java 21
- Docker와 Docker Compose
- Node.js `^20.19.0` 또는 `>=22.12.0`, pnpm 11.19.0

```bash
git clone https://github.com/K4RF/reservation-platform.git
cd reservation-platform
```

### 2. 환경변수

루트의 `.env_sample`을 `.env`로 복사하고 로컬 값을 입력합니다.
이미 `.env`가 있다면 덮어쓰지 마세요. 실제 `.env`는 커밋하지 않습니다.

Windows PowerShell:

```powershell
Copy-Item .env_sample .env
```

macOS/Linux:

```bash
cp .env_sample .env
```

| 설정                                       | 입력할 값                             |
| ------------------------------------------ | ------------------------------------- |
| `MYSQL_DATABASE`, `MYSQL_USER`             | 개발 DB 이름·사용자                   |
| `MYSQL_PASSWORD`, `MYSQL_ROOT_PASSWORD`    | 로컬 MySQL 비밀번호                   |
| `JWT_SECRET`                               | 32바이트 이상 난수의 Base64 값        |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth Client 값 (Backend 전용) |

`.env_sample`의 Secret placeholder는 실행 가능한 서명 키가 아닙니다.
JWT 키는 다음과 같이 생성할 수 있습니다.

Windows PowerShell:

```powershell
$jwtBytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Fill($jwtBytes)
[Convert]::ToBase64String($jwtBytes)
```

macOS/Linux:

```bash
openssl rand -base64 32
```

Google OAuth Client의 로컬 Redirect URI는 `http://localhost:8080/login/oauth2/code/google`입니다.
그 외 Redis·Kafka·캐시·락 설정은 [.env_sample](.env_sample)과
[application.yaml](backend/src/main/resources/application.yaml)을 참고하세요.

### 3. 인프라 실행

저장소 루트에서 실행합니다.

```bash
docker compose up -d
docker compose ps
```

| 서비스 | Host → Container 기본 포트 |
| ------ | -------------------------- |
| MySQL  | `3307 → 3306`              |
| Redis  | `6380 → 6379`              |
| Kafka  | `9092 → 9092`              |

Backend는 기본적으로 `localhost:3307`의 Compose MySQL에 연결합니다.
포트 변경 시 `.env`의 연결 설정도 함께 맞춰야 합니다.

기존 DB Volume을 재사용하면 [DB 구조·업그레이드 안내](docs/erd/database-schema.md)를
먼저 확인하세요. `ddl-auto=update`만으로 기존 데이터·제약조건의 모든 변경이 반영되지는 않습니다.
테스트나 초기화를 위해 기존 DB/Volume을 삭제하지 않습니다.

### 4. Backend 실행

별도 터미널에서 실행합니다. 기본 실행에는 MySQL·Redis·Kafka와 환경변수가 필요합니다.

Windows PowerShell:

```powershell
cd backend
.\gradlew.bat bootRun
```

macOS/Linux:

```bash
cd backend
./gradlew bootRun
```

- API: `http://localhost:8080/api/v1`
- [Swagger UI](http://localhost:8080/swagger-ui.html)
- [OpenAPI JSON](http://localhost:8080/v3/api-docs)

Swagger/OpenAPI는 현재 개발 확인용으로 공개됩니다. 보호 API를 테스트할 때는
로그인 응답의 Access Token을 Swagger `Authorize`에 입력합니다. `Bearer ` 접두사는 자동으로 붙습니다.

### 5. Frontend 실행

Backend와 다른 터미널에서, 저장소 루트를 기준으로 실행합니다.

```bash
cd frontend
pnpm install --frozen-lockfile
pnpm dev
```

접속 주소는 `http://localhost:5173`입니다. 개발 서버는 `/api` 요청을 Backend로 프록시합니다.
토큰은 메모리에만 보관하므로 새로고침 후 보호 기능은 재로그인이 필요합니다.

Frontend 환경변수·라우트·인증 흐름은 [Frontend README](frontend/README.md)를 참고하세요.
운영 정적 호스팅에는 깊은 URL을 `index.html`로 보내는 SPA fallback 설정이 필요합니다.

인프라를 종료할 때는 루트에서 `docker compose down`을 사용합니다.
데이터 Volume 삭제 옵션은 기존 데이터를 지우므로 일반 종료 절차에 포함하지 않습니다.

## 테스트와 CI

### Backend

Windows PowerShell:

```powershell
cd backend
.\gradlew.bat test
.\gradlew.bat build
```

macOS/Linux:

```bash
cd backend
./gradlew test
./gradlew build
```

H2 기반 통합 테스트와 MySQL·Redis Testcontainers 검증을 구분합니다.
전체 테스트에는 Docker 호환 Runtime과 테스트 설정의 Redis `localhost:6380`이 필요합니다.
테스트는 개발 Compose MySQL이나 그 Volume을 사용하지 않습니다.

Fixture·격리 환경은 [테스트 구성](docs/testing/test-fixtures.md)을 참고하세요.

### Frontend

```bash
cd frontend
pnpm install --frozen-lockfile
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
```

[Backend CI](.github/workflows/backend-ci.yml)와 [Frontend CI](.github/workflows/frontend-ci.yml)는
`develop` 대상 PR과 각 영역의 `develop` push에서 테스트·빌드를 실행합니다.
로컬 테스트 통과와 원격 CI 성공은 별도로 확인합니다.

HTTP Mock/UI 테스트, 격리된 실제 Backend HTTP 검증, Browser E2E는 서로 다른 검증입니다.
[격리 Frontend/Backend 실행 및 API 계약](docs/testing/frontend-backend-integration.md)으로
개발 데이터와 분리된 통합 스모크를 재현할 수 있습니다.
f0.6.0의 이슈별 증거, 최종 사용자 검수 절차와 다음 성능 테스트 후보는
[프런트엔드 검수 인계](docs/testing/frontend-review-handoff.md)를 참고하세요.
직접 화면을 검수할 때는 [최종 사용자 검수 순서](docs/testing/frontend-final-user-review.md)를 따릅니다.

## 상세 문서

### 설계와 정책

- [DB 구조·제약조건·업그레이드](docs/erd/database-schema.md)
- [가격 스냅샷 ADR](docs/adr/004-reservation-price-snapshot.md) · [날짜별 가격](docs/architecture/room-daily-price-policy.md)
- [예약 가능 정책](docs/architecture/accommodation-booking-policy.md) · [취소 정책](docs/architecture/reservation-cancellation-policy.md)
- [재고 정책](docs/architecture/room-inventory-policy.md) · [숙소 TimeZone](docs/architecture/accommodation-time-zone-policy.md)
- [숙소 통합 검색](docs/architecture/accommodation-integrated-search.md) · [카탈로그](docs/architecture/accommodation-catalog.md)
- [조회·캐시 구조](docs/architecture/read-query-cache-architecture.md)
- [예약 이벤트·Outbox·Consumer](docs/architecture/reservation-event-contract.md)
- [공통 API 오류](docs/api/error-response.md)

### 검증과 비교

- [예약 도메인 Baseline](docs/testing/reservation-domain-baseline.md)
- [동시성 통합 검증](docs/testing/concurrency-control-integration.md) · [전략 비교](docs/performance/concurrency-strategy-comparison.md)
- [조회·캐시 비교](docs/performance/query-cache-optimization-comparison.md)
- [Kafka 실패 시나리오](docs/testing/kafka-failure-scenarios.md)
- [인증 흐름](docs/testing/frontend-authentication-flow.md) · [검색·예약 생성](docs/testing/frontend-search-booking-flow.md)
- [예약관리 전체 흐름](docs/testing/frontend-reservation-management-flow.md)
- [관리자 Route·공통 Layout·권한 경계](docs/testing/frontend-admin-layout.md)
- [관리자 숙소·정책 입력 계약과 검증](docs/testing/frontend-admin-accommodations.md)
- [관리자 객실 관리 계약과 검증](docs/testing/frontend-admin-rooms.md)
- [관리자 날짜별 가격 계약과 검증](docs/testing/frontend-admin-daily-prices.md)
- [관리자 재고 Calendar 계약과 검증](docs/testing/frontend-admin-inventories.md)
- [관리자 전체 흐름·구조·권한 검증 경계](docs/testing/frontend-admin-management-flow.md)
- [승인 디자인 기준·A1/Navy & Ivory·독립 시안 및 작업 범위](docs/ui/approved-design.md)
- [현재 UI 재구성 명세·실측·화면 구성안·후속 이슈 지도 (#271)](docs/ui/prototype-rebuild.md)
- [현재 화면 계약·접근성·검수 절차](docs/ui/frontend-guide.md)
- [Catalog Media 공개 읽기·로컬 저장소·캐시·업그레이드 (#272)](docs/architecture/catalog-media.md)
- [ADMIN Media 입력 예시·관리·파일 실패 복구 (#273)](docs/architecture/media-management.md)
- [검색·Booking 복귀 Query와 Scroll/Focus 계약 (#243)](docs/testing/frontend-exploration-return-context.md)
- [Room DTO 기반 상세·선택·키보드 및 반응형 검증 (#244)](docs/testing/frontend-room-detail-selection.md)
- [공개 탐색·비파괴 데모 준비](docs/testing/public-exploration-booking-flow.md)

## 로드맵과 남은 범위

`v*`는 Backend/Platform, `f*`는 Frontend Track입니다. 아래는 소스·문서 기준의 구현 범위이며,
GitHub Milestone의 병합·종료 상태와는 구분합니다.

Frontend는 [승인 시안](docs/ui/approved-design.md)을 기준으로 Home A1·Navy & Ivory,
사진 중심 Search와 Detail을 구현했습니다. Backend Media 계약과 실제 업로드는 연결되어 있고,
f0.6.0에서 실기기·외부 인증·서비스 자산과 최종 사용자 UX를 별도로 검수합니다.
기존 f0.5.2(Milestone #19)의 과거 명칭 f0.5.3과 새 f0.5.3(Milestone #21)은 구분합니다.

| 영역                 | 현재 범위                                                | 후속 개발                                         |
| -------------------- | -------------------------------------------------------- | ------------------------------------------------- |
| Backend `v0.1–v0.4`  | 예약 도메인·동시성·조회/캐시·이벤트 처리 및 구조 검증    | `v0.5` 부하 테스트, `v0.6` 관측성, `v1.0` 배포    |
| Frontend `f0.1–f0.5` | 기반·인증·공개 탐색/예약·본인 예약관리·관리자 카탈로그/가격/재고 | `f0.5.2` 구현 기록 → 새 `f0.5.3(#21)` 재구성 → `f0.6` 실제 연동·최종 UX 검수 |

아직 구현하지 않은 주요 범위:

- 결제/PG 연동, 실제 환불 처리, 취소 전 금액 견적 API
- 현재 숙소 정책 조회, 전체 사용자 예약 관리, 새로고침 후 인증 복원
- Access Token 블랙리스트, 추가 OAuth2 Provider, 서버 요청 멱등성
- 변경·취소 재시도, Retry Backoff/Jitter, 분산 락 범위 확대
- 외부 Kafka 후처리, 자동 DLT 재처리, Outbox/처리 이력 Cleanup
- 정식 DB Migration 도구, Prometheus/Grafana, k6, CD·운영 배포

현재 전략 비교는 전체 사용자 부하 테스트나 API SLO를 증명하지 않습니다.
실제 Browser/Google E2E와 최종 반응형·시각 검수도 통합 테스트 기록과 구분해야 합니다.

예약 생성의 `503 INVENTORY_013`은 Commit 뒤 락 해제 실패에서도 발생할 수 있습니다.
Frontend는 이 응답을 결과 불명으로 처리해 재제출을 잠그고 본인 예약 확인을 안내합니다.
서버의 예약 생성 멱등성은 별도 과제입니다.

## 개발 규칙

- `develop`에서 `feature/#{이슈번호}-{설명}` 브랜치를 생성합니다.
- 커밋은 작업별로 나누고 `[type] #이슈번호 - 설명` 형식을 사용합니다.
- PR·CI·리뷰 후 병합하며, 비밀값·생성물·IDE 설정은 커밋하지 않습니다.
- 상세 작업 규칙은 [AGENTS.md](AGENTS.md)를 따릅니다.

## 라이선스

아직 정하지 않았습니다. 프로젝트 공개 범위 확정 후 추가할 예정입니다.
