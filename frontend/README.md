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
있습니다. 개발 서버의 기본 주소는 `http://localhost:5173`입니다. Home 화면은
Backend 없이 열 수 있지만 `/signup`과 `/login`에서 실제 요청을 보내려면 Backend와
개발 인프라가 실행 중이어야 합니다.

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
타입 검사 후 Vite Production Build를 수행합니다. Vitest는 Vite 설정에서 `jsdom`
환경과 `src/test/setup.ts`를 사용합니다. Setup은 각 테스트 후 React DOM,
Mock Global, Fake Timer를 정리합니다. 기존 Route·공통 UI Component 테스트와
API Client·Error·인증 상태 테스트를 재사용하며 중복 Test Suite를 만들지 않습니다.

`.github/workflows/frontend-ci.yml`은 Node.js 24.19.0과 pnpm 11.19.0을 사용해
`frontend/pnpm-lock.yaml` 기반 Store Cache를 준비하고 `--frozen-lockfile` 설치 후
`lint`, `format:check`, `typecheck`, `test`, `build`를 실행합니다. `develop` 대상
Pull Request는 경로와 무관하게 실행합니다. PR에 Path Filter를 두면 필수 Check가
건너뛴 PR에서 Pending 상태로 남을 수 있기 때문입니다. `develop` Push는
`frontend/**` 또는 Frontend Workflow가 변경될 때만 실행합니다. Backend CI는
별도 Workflow이며 Frontend CI는 Backend Container나 Gradle을 사용하지 않습니다.
GitHub 저장소에서 `Frontend Test and Build`를 필수 Status Check로 지정하는
것은 별도 Branch Protection 설정이며, 실제 PR 실행 결과는 PR 생성 후 확인해야 합니다.

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

| 경로               | 현재 동작                          |
| ------------------ | ---------------------------------- |
| `/`                | Home 페이지                        |
| `/signup`          | 이메일·비밀번호 회원가입           |
| `/login`           | 이메일·비밀번호 및 Google 로그인   |
| `/oauth2/callback` | Google 인증 결과 처리              |
| `/reservations`    | `USER`/`ADMIN` 보호 영역 진입 안내 |
| `/admin`           | `ADMIN` 보호 영역 진입 안내        |
| 그 외 경로 (`*`)   | 공통 Layout 안의 Not Found 페이지  |

경로는 소문자와 kebab-case를 쓰고, 리소스는 복수형 URL을 사용합니다.
`ProtectedRoute`의 중첩 Route가 `/reservations`와 `/admin` 및 각 하위 경로를 보호합니다.
두 진입 화면은 접근 확인 안내만 제공하며 실제 예약 조회·관리 API는 아직 연결하지 않습니다.
등록되지 않은 하위 경로도 먼저 인증·역할 검사 후 Not Found를 표시합니다.
숙소 검색 화면(`/accommodations`)은 후속 작업입니다.

### Protected Route와 역할

익명 사용자가 보호 경로를 직접 열면 `/login`으로 이동하며 원래 pathname·query·fragment를
Router State의 `from`으로 전달합니다. 이메일 로그인 후 원래 경로로 복귀하고 역할을 다시
검사합니다. `USER`와 `ADMIN`은 `/reservations`에, `ADMIN`만 `/admin`에 접근할 수 있습니다.
로그인 상태지만 역할이 없거나 알 수 없으면 역할 보호 화면 접근을 거부합니다.
권한 부족은 로그인으로 반복 이동하지 않고 현재 URL에서 접근 불가 안내와 홈 링크를 표시합니다.
Header의 내 예약·관리자 메뉴도 동일한 역할에 따라 표시합니다.

Google 로그인은 전체 페이지 이동을 하므로 복귀 경로만 `sessionStorage`에 일시 보관합니다.
콜백에서 성공·실패와 관계없이 한 번 읽고 제거하며, 취소·실패 안내의 로그인 링크에도 경로를
전달합니다. 토큰은 Storage에 넣지 않습니다. 복귀 값은 내부 `/reservations`·`/admin` 영역만
허용하며 외부 주소·인증 경로·역슬래시·공백 입력은 홈으로 대체해 Open Redirect와 루프를 막습니다.

만료된 메모리 세션의 Provider 재마운트 또는 Token 재발급 중에는 `loading` 상태에서 인증
확인 안내를 표시하고 보호 화면·역할 메뉴를 숨기며 URL을 유지합니다. 성공하면 새 JWT의
Role Hint를 적용하고, 실패하면 원래 경로를 보존해 재로그인을 안내합니다.
전체 새로고침은 메모리 토큰을 잃으므로 익명으로 시작해 로그인으로 이동합니다.
새로고침 후 지속 세션 복원은 구현하지 않았습니다.

백엔드 `MemberRole`은 `USER`/`ADMIN`이며 JWT의 `role` Claim으로 전달됩니다.
현재 `/me` API가 없어 프런트엔드는 이 Claim을 **서명 미검증 UX Hint**로만 읽습니다.
사용자 Profile을 만들어 채우거나 클라이언트 검사를 보안 경계로 사용하지 않습니다.
Token 변조로 화면 표시를 바꿔도 Backend의 JWT 서명·만료 검사, Spring Security의 ADMIN
검사와 예약 소유권 검사를 통과할 수 없습니다. API의 401/403 처리는 별도로 유지합니다.

`pnpm test`는 홈·미등록 경로·기본 Navigation과 익명/USER/ADMIN 직접 접근, 원래 경로 복귀,
재발급 Loading·역할 변경·실패, Google 복귀, 메모리 세션 초기화 동작을 검증합니다. Vite 개발
서버와 Preview에서는 깊은 URL을 직접 열어도 SPA 진입 파일을 제공합니다. 실제 정적
호스팅에서는 깊은 경로 요청을 `index.html`로 보내는 Fallback 설정이 별도로 필요합니다.

## 회원가입

`/signup`은 Backend `POST /api/v1/members`에 이메일·비밀번호만 전송합니다.
응답에는 회원 ID·이메일·역할이 포함됩니다. 프런트엔드에서 필수 입력·기본 이메일
형식·Backend 필드 길이(이메일 최대 255자, 비밀번호 8~72자)를 먼저 확인하지만,
최종 검증은 Backend가 수행합니다. Backend `COMMON_001`의 필드 오류와 중복 이메일
`MEMBER_001`은 해당 입력 아래 표시하고, 연결·타임아웃 오류는 일반 안내로 표시합니다.
제출 중에는 재제출을 막고 진행 상태를 표시합니다.

가입 성공 후에는 자동 로그인하지 않고 Home으로 이동해 완료 메시지를 보여줍니다.
Home에서 로그인 화면으로 이동할 수 있습니다. 화면 테스트는 API를 Mock으로
대체하며, 실제 Backend를 확인하려면 루트 Docker Compose와 Backend를 실행하고
`frontend/.env.example`을 `.env`로 복사한 뒤 `pnpm dev`에서 `/signup`을 사용하세요.
실제 회원이 생성되므로 테스트마다 새로운 이메일을 사용하세요.

## 로그인

`/login`은 Backend `POST /api/v1/auth/login`에 이메일·비밀번호를 전송합니다.
이메일 필수·형식·최대 255자와 비밀번호 필수·최대 72자를 먼저 확인하며,
회원가입에만 있는 비밀번호 최소 길이 제한은 로그인에 적용하지 않습니다.
요청 중에는 중복 제출을 막고 진행 상태를 표시합니다. `AUTH_003`은 어느 입력이
틀렸는지 밝히지 않는 공통 안내로, `COMMON_001`의 필드 오류는 해당 입력 아래에,
연결·타임아웃 오류는 재시도 가능한 안내로 표시합니다.

성공 응답의 `accessToken`, `refreshToken`, `tokenType: Bearer` 형식을 확인한 뒤
Access Token의 `ACCESS` 타입과 만료 시각을 확인하여 메모리에만 보관합니다.
인증 Context에는 Token 문자열 대신 `authenticated` 상태, 만료 시각, Role Hint만 기록하고
보호 경로에서 왔다면 해당 경로로, 그렇지 않으면 Home으로 이동합니다. Refresh Token도 같은 JavaScript 모듈 메모리에만 보관하며
Access Token 재발급에 사용합니다. 실제 Backend 로그인 응답에는 토큰이
포함되므로 개발자 도구나 터미널에서 응답 내용을 공유하지 마세요.

두 Token은 `localStorage`·`sessionStorage`·Cookie에 기록하지 않습니다.
이 Browser Tab에서 React Provider가 다시 마운트되면 메모리 Token을 확인하여
상태를 복원하지만, 전체 페이지 새로고침·Tab 종료 후에는 Token이 사라져 익명
상태로 시작하며 다시 로그인해야 합니다. Web Storage에 토큰을 두지 않는 것은
[OWASP Session Management 지침](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)의
JavaScript 접근·XSS 위험을 고려한 선택입니다. 메모리 보관도 실행 중인 악성
스크립트로부터 Token을 보호하지는 못합니다.

### Google 로그인

`/login`의 Google 버튼은 브라우저를 Backend
`/api/v1/auth/oauth2/google/start`로 이동시킵니다. Backend가 Google 인증을 시작하고
Google Callback은 Backend의 `/login/oauth2/code/google`에서 처리합니다. 성공 시
Backend는 60초짜리 일회용 코드를 Redis에 저장하고 Frontend
`/oauth2/callback`의 URL Fragment로 전달합니다. 토큰은 URL에 넣지 않습니다.
Frontend는 Fragment를 즉시 주소창에서 지우고 `POST /api/v1/auth/oauth2/exchange`로
코드를 한 번 교환하여 이메일 로그인과 동일한 Access/Refresh Token 상태를 만듭니다.
요청·응답 검증용 무작위 `state`와 내부 복귀 경로만 `sessionStorage`에 일시적으로 보관하며 콜백에서
제거합니다. Google 동의 취소·인증 실패·상태 불일치·코드 만료는 실패 안내로 표시하고
토큰을 저장하지 않습니다. Google 계정의 기존 회원 연결 또는 신규 회원 생성은
Backend가 처리합니다.

로컬 Google OAuth Client의 승인된 Redirect URI는 Frontend가 아닌
`http://localhost:8080/login/oauth2/code/google`입니다. Backend의
`OAUTH2_FRONTEND_BASE_URL`은 `http://localhost:5173`, Frontend의
`VITE_OAUTH2_BACKEND_URL`은 `http://localhost:8080`으로 맞춰야 합니다.
Google Client Secret은 루트의 무시된 `.env` 또는 Backend 환경변수에만 두고
`VITE_` 변수에는 넣지 마세요.

## 상태 관리와 공통 UI

`src/state/`는 React Context와 Reducer로 인증 관련 Client Global State만
관리합니다. `App`이 `AuthProvider`를 설치하며, 초기 상태는 사용자 정보가 없는
`anonymous`입니다. `useAuth()`는 상태와 로그인·로그아웃 함수를 제공합니다.
Backend 로그인 응답에는 사용자 정보가 없고 현재 `/me` API도 없으므로 회원 ID·이메일·
역할을 Token의 서명 미검증 Payload에서 사용자 Profile로 채우지 않습니다. `authenticated`
상태의 `user`는 현재 `null`이며 Access Token 만료 시각과 별도 `role`을 Client Hint로 갖습니다.
Access Token 만료 또는 보호 API의 401에 대해 Refresh Token으로 한 번 재발급하고
실패한 요청을 한 번 재시도합니다. 재발급 실패나 재시도 후 401이면 두 Token을
삭제하고 `reauth_required` 상태로 로그인 화면에 안내합니다. 네트워크 오류도
재발급 실패로 처리하므로 다시 로그인해야 합니다.
Header의 로그아웃은 Bearer Token으로 Backend `POST /api/v1/auth/logout`을 호출합니다.
Access Token이 만료됐다면 먼저 재발급을 시도합니다. 성공(`204`)하면 Redis Refresh
Token이 삭제되며, 요청 실패·연결 오류 때도 현재 Tab의 Token과 인증 상태를 지우고
로그인 화면으로 이동합니다. 후자의 경우 서버 무효화가 확인되지 않았음을 알립니다.
Logout 응답의 401은 다시 재발급하지 않습니다. Backend는 Access Token Blacklist를
사용하지 않으므로 이미 발급된 Access Token은 만료 전까지 서버에서 유효할 수 있습니다.
Protected Route는 구현됐으며 새로고침 후 지속 인증 복원은 후속 작업입니다. 최종 인증과
권한은 Backend가 검증하며, Client의 `authenticated` 상태만으로 권한을 증명할 수
없습니다.

폼 입력·모달 열림 여부처럼 한 화면에서만 필요한 상태는 해당 Component의 Local
State에 둡니다. 숙소·객실·예약 조회 결과는 Server State이며 인증 Context에 복제하지
않습니다. 현재 API Client는 요청·오류 변환까지만 담당하고, 조회 캐시·재요청·무효화
방식이나 전용 Server State 라이브러리는 실제 데이터 화면을 만들 때 결정합니다.

`src/components/ui/`의 `LoadingState`와 `ErrorState`는 접근성 상태 영역과 선택적
재시도 버튼을 제공하는 표시 전용 Component입니다. API 요청 상태나 오류 메시지
선택은 사용하는 화면이 책임집니다. 목록 화면이 아직 없으므로 `EmptyState` 공통
Component는 필요해질 때 추가합니다.

## Backend API 설정

`src/api/client.ts`의 `apiClient.request<T>('/members', { method: 'POST', body })`로
Backend API를 호출합니다. 경로는 `src/config/api.ts`의 Base URL 뒤에 붙으며,
Component에서 Backend Host를 직접 사용하지 않습니다. JSON 요청은 자동으로
직렬화하고 JSON 응답을 읽습니다. 공통 `Accept` Header, JSON 요청의 `Content-Type`,
공통·요청별 Header, 10초 Timeout을 지원합니다. 실패한 요청은 `src/api/errors.ts`의
`ApiError`로 전달합니다. 로그인 API 함수는 응답 형식까지 검증합니다. 공통 Client는
기본적으로 메모리 Access Token이 있으면 `Authorization: Bearer <token>`을 붙이고,
로그인·회원가입·재발급·Google 코드 교환은 `includeAuth: false`로 제외합니다. 만료된 Access Token은
요청 전에 재발급하며, 동시 401은 하나의 재발급 요청을 공유합니다. 재발급 중 시작된
보호 요청도 새 Token을 기다립니다. 원래 요청은 최대 한 번 재시도하며 재발급 요청
자체는 재시도하지 않습니다. 이전 세션의 늦은 응답은 새 로그인을 삭제하지 않습니다.

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
회원가입과 로그인 Page는 `kind`/`category`/`code`/`fieldErrors`에 따라 안내를
구성합니다.

| 변수                      | 로컬 기본값             | 용도                                       |
| ------------------------- | ----------------------- | ------------------------------------------ |
| `VITE_API_BASE_URL`       | `/api/v1`               | 브라우저에 포함되는 API 접두사             |
| `API_PROXY_TARGET`        | `http://localhost:8080` | Vite 개발 서버에서만 사용하는 Backend 대상 |
| `VITE_OAUTH2_BACKEND_URL` | `http://localhost:8080` | Google 인증을 시작할 공개 Backend 주소     |

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

현재 구현 범위는 React 진입점, Home/Not Found/Signup/Login 및 OAuth2 Callback Route,
공통 Header/Main Layout, 기본 스타일, 회원가입·이메일/Google 로그인과 Header 로그아웃, 메모리 기반 Token 인증,
자동 재발급, 공통 Bearer Header, Protected/Role Route 및 로그인 후 원래 경로 복귀입니다. 새로고침 후 세션 복원, 사용자 정보
조회, 숙소 검색·예약·관리자 화면은 후속 Frontend 이슈 범위입니다.
