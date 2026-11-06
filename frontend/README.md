# Reservation Platform Frontend

React·TypeScript·Vite로 구성한 예약 웹 앱입니다. 공개 숙소 탐색부터 예약 생성,
본인 예약의 조회·변경·취소, 관리자 카탈로그·사진·가격·재고 관리를 연결합니다.

## 실행

Node.js `^20.19.0` 또는 `>=22.12.0`, pnpm 11.19.0이 필요합니다.
Backend 및 인프라 시작 방법은 [루트 README](../README.md#로컬-실행)를 참고하세요.

```bash
cd frontend
pnpm install --frozen-lockfile
pnpm dev
```

기본 접속 주소는 `http://localhost:5173`입니다. 아래 기본값을 바꿀 때만
[.env.example](.env.example)을 `.env`로 복사해 수정하세요.

| 변수                      | 기본값                  | 용도                            |
| ------------------------- | ----------------------- | ------------------------------- |
| `VITE_API_BASE_URL`       | `/api/v1`               | 브라우저가 사용하는 API 접두사  |
| `API_PROXY_TARGET`        | `http://localhost:8080` | Vite 개발 프록시의 Backend 주소 |
| `VITE_OAUTH2_BACKEND_URL` | `http://localhost:8080` | Google OAuth를 시작할 공개 주소 |

`VITE_*` 값은 공개 번들에 들어가므로 비밀을 넣지 않습니다. 운영에서는 기본 API
접두사를 같은 Origin으로 프록시하고, 깊은 URL은 `index.html`로 보내는 SPA fallback을
설정합니다. 다른 Origin의 API를 쓰려면 서버 CORS 정책을 별도로 맞춰야 합니다.
ADMIN Media의 교차 Origin 요청에는 `Authorization`·`If-Match` 허용과 `ETag` 노출도 필요합니다.

## 주요 경로

| 경로                                                       | 접근 및 기능                       |
| ---------------------------------------------------------- | ---------------------------------- |
| `/`, `/accommodations`, `/accommodations/:accommodationId` | 공개 홈·검색·상세·객실 가용성      |
| `/signup`, `/login`, `/oauth2/callback`                    | 가입·이메일 로그인·Google 인증     |
| `/reservations`, `/reservations/:reservationId`            | 인증 회원 본인 예약 조회·변경·취소 |
| `/reservations/:reservationId/complete`                    | 서버에 저장된 본인 예약 완료 결과  |
| `/admin`, `/admin/accommodations`, `/admin/rooms`          | ADMIN 관리 메뉴·숙소·객실·사진     |
| `/admin/prices`, `/admin/inventories`                      | ADMIN 날짜별 가격·재고 조회·편집   |

Access/Refresh Token은 메모리에만 보관합니다. 새로고침으로 인증이 사라지면 다시
로그인해야 합니다. 공개 탐색은 비회원도 가능하지만 예약 생성과 본인 예약 조회에는
인증이 필요합니다. 관리자도 사용자 예약 영역에서는 자기 예약만 관리합니다.

예약·관리 쓰기는 401을 포함해 자동 재전송하지 않습니다. 성공 여부가 불명확하면
새 조회와 명시적인 확인을 거쳐야 합니다. [현재 UI와 검수 가이드](../docs/ui/frontend-guide.md)에
화면별 상태, Media, 접근성, 예외 처리 기준을 정리했습니다.

## 테스트와 빌드

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
```

[Frontend CI](../.github/workflows/frontend-ci.yml)도 고정 Lockfile 설치 후 같은 명령을 실행합니다.
Vitest/Testing Library는 화면 동작과 HTTP 경계 Mock을 검증합니다. 네 통합 Suite는
인증, 검색·예약 생성, 본인 예약 관리, 관리자 관리를 다룹니다. 실제 Backend/외부 인증,
브라우저 레이아웃·기기 검증과는 구분합니다.

[격리 Frontend/Backend 실행 및 API 계약](../docs/testing/frontend-backend-integration.md)에서
실제 Vite 프록시, MySQL·Redis·Kafka·Media 및 테스트 계정 준비 방법을 확인하세요.

`pnpm preview`는 빌드된 `dist/`의 로컬 확인용입니다. 실제 계정이나 개발 DB 없이 화면을
확인하려면 [격리 UI Audit](scripts/ui-audit/README.md)을 사용하세요.
