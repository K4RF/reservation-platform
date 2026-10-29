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
- 객실 상세 Modal/Mobile Sheet 조회와 가용 결과 기반 명시적 객실 선택
- 숙소·객실 Media 메타데이터 및 공개 이미지 파일 읽기 API (Frontend 사진 연결은 후속)
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
로그인→숙소→객실→가격→재고의 [통합 검증](docs/testing/frontend-admin-management-flow.md)은 HTTP Mock 기준입니다.
실제 Backend Admin 전체 연동·Browser 수동 검수는 별도 확인 대상입니다.
PR #223의 [Frontend CI](https://github.com/K4RF/reservation-platform/actions/runs/39127783049)·
[Backend CI](https://github.com/K4RF/reservation-platform/actions/runs/39127783111)와
병합된 develop의 [Frontend CI](https://github.com/K4RF/reservation-platform/actions/runs/39130734369)는 성공했습니다.
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
├── infra/                 # 인프라 관련 placeholder
├── load-test/             # k6 관련 placeholder
├── docker-compose.yml     # 로컬 MySQL·Redis·Kafka
├── .env_sample            # 환경변수 예시 (비밀값 없음)
└── AGENTS.md              # 저장소 작업 규칙
```

Gradle 프로젝트 루트는 `backend/`입니다. 프론트엔드는 `frontend/`에서 별도로 실행합니다.

## 로컬 실행

Media 파일은 `MEDIA_STORAGE_ROOT`(기본 Backend cwd의 `.local/media`)에 보관하며 Git에서 제외합니다.
DB와 파일을 함께 영속 보관해야 합니다. 기존 DB의 [Media 테이블 추가 SQL](docs/erd/mysql-catalog-media-upgrade.sql)은
대상/백업 검토 후 적용하세요. 이번 작업에서 개발 DB/Volume에 실행하지 않았습니다.
공개 URL·용량/형식·캐시 v2는 [Media 읽기 계약](docs/architecture/catalog-media.md)을 참고하세요.
ADMIN 관리 입력 예시·If-Match 재조회·정리 설정은 [Media 관리/파일 수명주기](docs/architecture/media-management.md)를 따릅니다.
기존 DB의 [정리 테이블 추가 SQL](docs/erd/mysql-media-file-cleanup-upgrade.sql)도 대상/백업 검토 후 적용해야 합니다.
이 작업은 테스트용 임시 DB/파일만 사용했으며 실제 시설 사진이나 개발 Compose 데이터는 변경하지 않았습니다.

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
최근 예약관리 검증의 결과·한계는 [통합 검증 기록](docs/testing/frontend-reservation-management-flow.md)에 있습니다.
중복·초기 Smoke 테스트의 정리 근거와 유지한 커버리지는 [테스트 정리 기록](docs/testing/test-suite-maintenance.md)에 있습니다.

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
- [Frontend UI Audit·증거·개선 우선순위 (#224)](docs/ui/frontend-ui-audit-224.md)
- [승인 디자인 기준·A1/Navy & Ivory·독립 시안 및 작업 범위](docs/ui/approved-design.md)
- [현재 UI 재구성 명세·실측·화면 구성안·후속 이슈 지도 (#271)](docs/ui/prototype-rebuild.md)
- [Catalog Media 공개 읽기·로컬 저장소·캐시·업그레이드 (#272)](docs/architecture/catalog-media.md)
- [Catalog Media 테스트·CI 검토 및 미검증 범위 (#272)](docs/testing/catalog-media-272.md)
- [ADMIN Media 입력 예시·관리·파일 실패 복구 (#273)](docs/architecture/media-management.md)
- [ADMIN Media 실제 HTTP·MySQL/Redis·동시성 검증 (#273)](docs/testing/media-management-273.md)
- [Frontend Design Tokens·전역 스타일 기준 (#225)](docs/ui/frontend-design-tokens-225.md)
- [공통 UI·Navigation 기준과 검증 (#226)](docs/ui/frontend-shared-ui-226.md)
- [인증 화면 UI·Feedback과 검증 경계 (#227)](docs/ui/frontend-authentication-ui-227.md)
- [숙소 탐색·객실 선택·예약 생성 UI와 검증 (#228)](docs/ui/frontend-search-booking-ui-228.md)
- [본인 예약 조회·변경·취소 UI와 검증 (#229)](docs/ui/frontend-reservation-management-ui-229.md)
- [관리자 탐색·입력·재고 Calendar UI와 검증 (#230)](docs/ui/frontend-admin-management-ui-230.md)
- [통합 숙박 날짜 범위 UX·키보드·적용/취소 계약 (#241)](docs/testing/frontend-stay-date-range.md)
- [전체 인원 Stepper·직접 입력·가용성 초기화와 검증 (#242)](docs/testing/frontend-guest-count-stepper.md)
- [검색·Booking 복귀 Query와 Scroll/Focus 계약 (#243)](docs/testing/frontend-exploration-return-context.md)
- [Room DTO 기반 상세·선택·키보드 및 반응형 검증 (#244)](docs/testing/frontend-room-detail-selection.md)
- [횡단 Responsive·접근성·공통 UI State 개선과 검증 (#231)](docs/ui/frontend-responsive-accessibility-231.md)
- [f0.5.1 UI 회귀·스타일 구조 정리·검증 경계 및 인계 (#232)](docs/ui/frontend-ui-regression-232.md)
- [Navy & Ivory 전역 토큰·서체·대비 및 시안 적용 범위 (#251)](docs/ui/frontend-navy-ivory-tokens-251.md)
- [공통 UI·Header/Navigation·달력/Sheet 외형과 회귀 검증 (#252)](docs/ui/frontend-shared-navigation-252.md)
- [Home A1 Hero·브랜드 이미지 출처·검색 진입과 검증 (#253)](docs/ui/frontend-home-a1-253.md)
- [숙소 Search 비교 화면·필터·Summary와 검증 (#254)](docs/ui/frontend-search-comparison-254.md)
- [숙소 Detail·객실 비교/선택 패널·Modal과 검증 (#255)](docs/ui/frontend-detail-room-selection-255.md)
- [Booking 입력·예상 요금·서버 결과 화면과 검증 (#256)](docs/ui/frontend-booking-redesign-256.md)
- [내 예약 목록·상세·변경·취소 화면 리디자인과 검증 (#257)](docs/ui/frontend-reservation-redesign-257.md)
- [인증·접근 거절·없는 경로 화면 리디자인과 검증 (#258)](docs/ui/frontend-authentication-redesign-258.md)
- [관리자 작업 영역·조회/입력 구분·재고 표 리디자인과 검증 (#259)](docs/ui/frontend-admin-redesign-259.md)
- [Visual Redesign 통합 회귀·접근성·시각 검증 및 f0.6.0 인계 (#260)](docs/ui/frontend-visual-regression-260.md)
- [공개 탐색·비파괴 데모 준비](docs/testing/public-exploration-booking-flow.md)

## 로드맵과 남은 범위

`v*`는 Backend/Platform, `f*`는 Frontend Track입니다. 아래는 소스·문서 기준의 구현 범위이며,
GitHub Milestone의 병합·종료 상태와는 구분합니다.

GitHub에서 Backend `v0.1.0`·`v0.1.1`·`v0.1.2`·`v0.1.3`·`v0.2.0`·`v0.3.0`·`v0.4.0`과
Frontend `f0.1.0`·`f0.2.0`·`f0.3.0`·`f0.4.0`·`f0.5.0`은 **Completed**입니다.
`f0.4.0 — Reservation Management`는 Issue #197–#203 7건과 PR #204–#210 7건을 통해
생성 이후 본인 목록 → 상세 → 날짜 변경 → 저장 취소 정책 확인 → 취소 → 재조회를 연결했습니다.
`f0.5.0 — Admin Management`는 Milestone #16의 Issue #211–#216 6건과 PR #218–#223 6건을 종료했습니다.
공통 Layout·Route, 숙소·객실·가격·재고와 HTTP Mock 통합 회귀 검증을 구현했습니다.
2026-10-18 문서 동기화에서 lint·format:check·typecheck·69 files / 968 tests·build를 직접 실행했습니다.
Backend는 RoomInventoryTest·ReservationTest 12건만 재실행했으며 전체 Backend test/build는 실행하지 않았습니다.
위 자동 테스트·원격 CI 성공은 실제 Admin HTTP·Browser 검증 완료를 뜻하지 않습니다.
UI 정돈 단계 `f0.5.1`은 #224 Audit을 기준으로 #225–#230 화면 정돈과 #241–#244 UX,
#231/#232 횡단 검증까지 구현했습니다. [승인 디자인](docs/ui/approved-design.md)은 A1·Navy & Ivory이며,
`f0.5.2 — Frontend Visual Redesign`의 #251에서 Navy·Ivory 전역 토큰과 기본 서체를 적용했습니다.
#253은 Home A1 Hero·하단 검색 진입과 별도 AI 브랜드 풍경을 적용했습니다. 실제 숙소 사진이 아니며,
#254는 Search 2열/1열 비교 배치·필터·적용 조건 Summary를 정리했습니다. 사진 영역은 미제공 상태이며,
#255는 Detail 소개·이용 안내·객실 비교·선택 확인 패널을 정리했습니다. 실제 Gallery/Media 연동은 후속 범위입니다.
#256은 Booking 요약/입력·최종 확인과 완료 화면을 정리하고, 예상 요금과 서버 저장 금액을 구분했습니다.
#257은 내 예약 목록·상세·변경/취소 확인의 정보 출처와 표현을 통일했습니다. 실제 Backend 전체 연동 검증은 별도입니다.
#258은 Login/Signup/Google Callback·접근 거절/없는 경로 화면을 공통 디자인으로 정리했습니다. 인증 Lifecycle은 유지합니다.
#259는 관리자 작업 영역과 숙소·정책·객실·가격·재고의 조회/입력 표현을 정리했습니다.
기존 저장/복구 규칙은 유지하며 실제 Admin HTTP와 최종 사용자 검수는 별도입니다.
#260에서 변경 화면의 통합 회귀·반응형·접근성과 로컬 이미지 성능 관찰을 정리했습니다.
실제 사진/Metadata 연결, 전체 Backend 실연동과 최종 사용자 승인을 완료한 것은 아닙니다.
당시 문맥의 f0.5.3은 Milestone #19의 이전 명칭입니다. 2026-10-29의 **새 f0.5.3(#21)**과는 다릅니다.
[#271 재구성 명세](docs/ui/prototype-rebuild.md)는 현재 작업 기준이며, 기존 DOM/긴 폼/빈 사진 슬롯을
고정하지 않고 승인 시안의 구성·밀도·상호작용을 옮깁니다. #253–#260은 사용자 시각 승인이 아닙니다.
#272/#273 실제 Media 선행 후 #274–#283 화면 재구성, #284 실제 화면/회귀 검증으로 이어집니다.
실제 사진·객실 추가 데이터는 `v0.4.1 — Accommodation Media & Room Metadata`에서 준비합니다.
현재 Audit은 실제 Browser/Fixture 관찰이며 스타일 수정이나 최종 사용자 승인이 아닙니다.
이후 `f0.6.0 — Frontend Integration & UX Completion`에서 실제 연동·Edge Case·최종 UX 검수를 진행할 계획입니다.
`v0.5.0`·`v0.6.0`·`v1.0.0`은 Planned입니다. 같은 Monorepo에서 두 Track을 유지합니다.

f0.6.0 마지막에는 사용자 직접 Color Palette·Typography·Spacing·Layout·Responsive·
전체 UX를 수동 검수하는 Issue를 두는 계획을 유지합니다. 작은 수정은 f0.6.0에서,
큰 재설계·추가 기능은 별도 후속 Frontend Milestone으로 분리합니다.

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
현재 Frontend의 직접 재시도 분류와 서버 멱등성은 후속 안전성 검토 사항이며,
이 응답만으로 예약 미생성을 단정하면 안 됩니다.

## 개발 규칙

- `develop`에서 `feature/#{이슈번호}-{설명}` 브랜치를 생성합니다.
- 커밋은 작업별로 나누고 `[type] #이슈번호 - 설명` 형식을 사용합니다.
- PR·CI·리뷰 후 병합하며, 비밀값·생성물·IDE 설정은 커밋하지 않습니다.
- 상세 작업 규칙은 [AGENTS.md](AGENTS.md)를 따릅니다.

## 라이선스

아직 정하지 않았습니다. 프로젝트 공개 범위 확정 후 추가할 예정입니다.
