# Frontend

Reservation Platform의 브라우저 애플리케이션입니다. `frontend/`는 React 19,
TypeScript 6, Vite 8 및 pnpm 11을 사용하는 독립 프로젝트이며, `backend/` Gradle
프로젝트와 의존성·빌드 결과를 공유하지 않습니다.

## 요구 환경

- Node.js 20.19 이상 또는 22.12 이상 (Vite 8 요구사항)
- pnpm 11.19.0 (`package.json`의 `packageManager` 버전)

## 로컬 실행

프로젝트 루트에서:

```bash
cd frontend
pnpm install --frozen-lockfile
cp .env.example .env
pnpm dev
```

Windows PowerShell에서는 `cp` 대신 `Copy-Item .env.example .env`를 사용할 수
있습니다. 개발 서버의 기본 주소는 `http://localhost:5173`입니다. 이 단계의
화면은 실행 환경을 확인하기 위한 최소 진입 화면이며 Backend API 요청은 아직 하지
않습니다. 따라서 Backend나 Docker Compose를 켜지 않아도 화면을 확인할 수 있습니다.

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
pnpm preview
```

`build`는 TypeScript 검사 후 `dist/`에 Production 정적 파일을 생성합니다.
`preview`는 생성된 파일의 로컬 확인용이며 배포 서버가 아닙니다.

## 코드 품질 검사

`pnpm lint`는 ESLint Flat Config로 TypeScript 권장 규칙, React Hooks 및 Vite
Fast Refresh 규칙을 검사합니다. `pnpm format:check`는 Prettier 서식을 변경하지 않고
검사하며, 로컬에서 서식을 적용할 때만 `pnpm format`을 실행합니다. 두 도구의 책임을
분리하기 위해 ESLint에 서식 규칙을 추가하지 않았습니다.

`pnpm typecheck`는 TypeScript Compiler를 독립적으로 실행합니다. `pnpm build`도
타입 검사 후 Vite Production Build를 수행합니다. 향후 Frontend GitHub Actions
Workflow는 `pnpm install --frozen-lockfile` 다음에 `lint`, `format:check`,
`typecheck`, `test`, `build` 명령을 그대로 사용할 수 있습니다. 현재 저장소에는 Backend
CI만 있으며 Frontend Workflow는 아직 구성되지 않았습니다.

`.editorconfig`는 Frontend 디렉터리의 UTF-8, LF, 2칸 들여쓰기를 IDE에 알리고,
`.prettierrc.json`은 일관된 코드 서식을 정의합니다. Prettier를 IDE 기본 Formatter로
선택하면 CLI와 같은 결과를 얻을 수 있습니다. `.prettierignore`는 설치/빌드 결과와
잠금 파일을 서식 대상에서 제외합니다.
`.gitattributes`는 Windows 체크아웃에서도 Frontend 텍스트 파일을 LF로 유지해
Prettier의 `endOfLine: lf` 설정과 일치시킵니다.

## 라우팅과 공통 레이아웃

`src/App.tsx`가 `BrowserRouter`를 설치하고, `src/app/routes.tsx`가 모든 Route를
정의합니다. `src/layouts/RootLayout.tsx`는 모든 페이지에 공통인 Header·Navigation과
`<main>` 영역을 제공하며, 실제 화면 내용은 `src/pages/`의 페이지가 `<Outlet>`에
표시됩니다. 현재 Footer는 공통으로 표시할 내용이 없어 두지 않았습니다.

| 경로             | 현재 동작                         |
| ---------------- | --------------------------------- |
| `/`              | Home 페이지                       |
| 그 외 경로 (`*`) | 공통 Layout 안의 Not Found 페이지 |

경로는 소문자와 kebab-case를 쓰고, 리소스는 복수형 URL을 사용합니다. 향후 공개 화면은
`/login`·`/accommodations`처럼 Root Layout 아래에 추가하고, 로그인 회원 화면은
`/reservations`, 관리 화면은 `/admin/...` 영역으로 확장하는 **제안**입니다. 이 경로의
화면·인증 검사·권한 검사는 아직 구현되지 않았습니다. 인증 기능을 추가할 때는 해당
중첩 Route에 보호 Layout을 배치하고, 권한의 최종 검증은 Backend에서 수행해야 합니다.

`pnpm test`는 홈·미등록 경로·기본 Navigation을 Memory Router로 검증합니다. Vite 개발
서버와 Preview에서는 깊은 URL을 직접 열어도 SPA 진입 파일을 제공합니다. 실제 정적
호스팅에서는 깊은 경로 요청을 `index.html`로 보내는 Fallback 설정이 별도로 필요합니다.

## Backend API 설정

`src/api/client.ts`의 `apiClient.request<T>('/members', { method: 'POST', body })`로
Backend API를 호출합니다. 경로는 `src/config/api.ts`의 Base URL 뒤에 붙으며,
Component에서 Backend Host를 직접 사용하지 않습니다. JSON 요청은 자동으로
직렬화하고 JSON 응답을 읽습니다. 공통 `Accept` Header, JSON 요청의 `Content-Type`,
공통·요청별 Header, 10초 Timeout을 지원합니다. 실패한 요청은 `src/api/errors.ts`의
`ApiError`로 전달합니다. 인증 토큰 공급 위치는 준비했지만 실제
로그인, Token 보관 및 401 시 Refresh/Retry 흐름은 아직 구현하지 않았습니다.

`ApiError.kind`는 `http`, `network`, `timeout`, `cancelled`, `unexpected_response`를
구분합니다. HTTP 오류의 `category`는 400/401/403/404/409 및 5xx를 각각
`bad_request`/`unauthorized`/`forbidden`/`not_found`/`conflict`/`server_error`로
분류하고 나머지는 `other`입니다. Backend `ErrorResponse`의 HTTP 상태가 실제
응답 상태와 일치할 때만 `code`, `message`, `path`, 필드별 `errors`를 신뢰해
`ApiError`로 옮깁니다. `code`는 Backend 도메인 코드를 그대로 보존하며 목록을
Frontend에 중복 선언하지 않습니다. 비정형 응답은 상태만 남기고 일반 메시지로
대체합니다. 성공 응답의 빈 본문(204/205 제외)이나 잘못된 JSON은
`unexpected_response`입니다.

현재 API Layer는 오류를 자동으로 기록하거나 사용자에게 표시하지 않습니다.
요청 본문·토큰·서버의 비정형 오류 내용을 로그에 남기지 않기 위한 정책입니다.
향후 Page는 `kind`/`category`/`code`/`fieldErrors`에 따라 사용자 안내를 구성할 수
있지만, 401 Refresh 및 화면별 Feedback은 후속 작업입니다.

| 변수                | 로컬 기본값             | 용도                                       |
| ------------------- | ----------------------- | ------------------------------------------ |
| `VITE_API_BASE_URL` | `/api/v1`               | 브라우저에 포함되는 API 접두사             |
| `API_PROXY_TARGET`  | `http://localhost:8080` | Vite 개발 서버에서만 사용하는 Backend 대상 |

`frontend/.env.example`을 `.env`로 복사한 후 환경에 맞게 수정하세요. Vite는
`.env`, `.env.[mode]`, 그리고 실행 시 제공한 환경 변수를 읽으므로 테스트·운영
빌드에는 각각 해당 Mode의 `VITE_API_BASE_URL`을 지정할 수 있습니다. 이 값은
빌드 시 정해지며 운영 배포 후 변경하려면 다시 빌드해야 합니다. 값을 지정하지 않으면
`/api/v1`을 사용하므로 운영 환경에서는 같은 Origin의 Reverse Proxy가 필요합니다.
별도 Origin의 절대 URL을 사용하려면 Backend에서 해당 Origin을 CORS로 허용해야
합니다. 현재 Backend Security 설정에는 그 CORS 허용 규칙이 없습니다.

로컬에서는 브라우저가 `http://localhost:5173/api/v1/...`을 요청하고 Vite가 이를
`API_PROXY_TARGET`으로 전달합니다. Backend와 Docker Compose가 실행 중이라면
다음으로 연결을 확인할 수 있습니다. 이 회원가입 요청은 실제 데이터를 생성하므로
반복 테스트에서는 다른 이메일을 사용하세요.

```bash
curl -i -X POST http://localhost:5173/api/v1/members \
  -H 'Content-Type: application/json' \
  -d '{"email":"frontend-check@example.com","password":"Password123!"}'
```

Vite의 `VITE_` 접두사 변수는 브라우저 번들에 포함되므로 비밀번호·토큰·비밀키를
넣지 마세요. 실제 `.env`와 `node_modules/`, `dist/`는 Git에서 제외됩니다.

현재 구현 범위는 React 진입점, 기본 Home/Not Found Route, 공통 Header/Main Layout,
기본 스타일 및 공통 API Client입니다. 실제 API 호출 화면, 인증, 숙소 검색, 예약,
관리자 화면은 후속 Frontend 이슈 범위입니다.
