# Frontend

Reservation Platform의 브라우저 애플리케이션입니다. `frontend/`는 React 19,
TypeScript 6, Vite 8 및 pnpm 11을 사용하는 독립 프로젝트이며, `backend/` Gradle
프로젝트와 의존성·빌드 결과를 공유하지 않습니다.

## 현재 Milestone

`f0.1.0 — Frontend Foundation`과 `f0.2.0 — Authentication & User Flow`는
완료했습니다. f0.2.0은 Issue #161–#168 / PR #169–#176을 통해 Signup,
이메일/Google 로그인, 메모리 Token Pair, single-flight 재발급, Logout,
Protected/Role Route와 HTTP Mock 통합 검증을 연결했습니다.
`f0.3.0 — Accommodation Search & Booking`은 #178 숙소 검색·목록부터 진행 중입니다.
전체 새로고침 후 지속 인증 복원, Current User/Profile 조회, 예약·관리
화면은 아직 없습니다. 실제 Backend·Redis·Google 브라우저 E2E는 미검증이며
자동화 검증 경계는 [인증 검증 문서](../docs/testing/frontend-authentication-flow.md)를 따릅니다.

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

| 경로                               | 현재 동작                          |
| ---------------------------------- | ---------------------------------- |
| `/`                                | Home 페이지                        |
| `/signup`                          | 이메일·비밀번호 회원가입           |
| `/login`                           | 이메일·비밀번호 및 Google 로그인   |
| `/oauth2/callback`                 | Google 인증 결과 처리              |
| `/accommodations`                  | 인증 사용자 숙소 검색·목록         |
| `/accommodations/:accommodationId` | 숙소 상세·객실 목록 조회           |
| `/reservations`                    | `USER`/`ADMIN` 보호 영역 진입 안내 |
| `/admin`                           | `ADMIN` 보호 영역 진입 안내        |
| 그 외 경로 (`*`)                   | 공통 Layout 안의 Not Found 페이지  |

경로는 소문자와 kebab-case를 쓰고, 리소스는 복수형 URL을 사용합니다.
`ProtectedRoute`의 중첩 Route가 `/reservations`와 `/admin` 및 각 하위 경로를 보호합니다.
두 진입 화면은 접근 확인 안내만 제공하며 실제 예약 조회·관리 API는 아직 연결하지 않습니다.
등록되지 않은 하위 경로도 먼저 인증·역할 검사 후 Not Found를 표시합니다.
숙소 검색 화면(`/accommodations`)과 상세 진입 경로도 `USER`/`ADMIN` 보호 영역입니다.

### Protected Route와 역할

익명 사용자가 보호 경로를 직접 열면 `/login`으로 이동하며 원래 pathname·query·fragment를
Router State의 `from`으로 전달합니다. 이메일 로그인 후 원래 경로로 복귀하고 역할을 다시
검사합니다. `USER`와 `ADMIN`은 `/reservations`에, `ADMIN`만 `/admin`에 접근할 수 있습니다.
로그인 상태지만 역할이 없거나 알 수 없으면 역할 보호 화면 접근을 거부합니다.
권한 부족은 로그인으로 반복 이동하지 않고 현재 URL에서 접근 불가 안내와 홈 링크를 표시합니다.
Header의 내 예약·관리자 메뉴도 동일한 역할에 따라 표시합니다.

Google 로그인은 전체 페이지 이동을 하므로 복귀 경로만 `sessionStorage`에 일시 보관합니다.
콜백에서 성공·실패와 관계없이 한 번 읽고 제거하며, 취소·실패 안내의 로그인 링크에도 경로를
전달합니다. 토큰은 Storage에 넣지 않습니다. 복귀 값은 내부 `/accommodations`·`/reservations`·`/admin` 영역만
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

## 공통 UI 기본 스타일 (#177)

`src/index.css`의 기존 색상과 Layout을 유지하면서 Header와 인증 화면의 최소 기준을 정리했습니다.
Header Navigation은 Flex·수직 중앙 정렬·줄바꿈과 `0.5rem` Gap을 사용합니다.
40rem 이하에서는 Navigation을 별도 전체 폭 행으로 배치합니다.
Link·Logout Button은 같은 Padding과 최소 `2.75rem` 높이를 사용하며 Hover와
키보드 `:focus-visible` Outline을 제공합니다.

Login/Signup은 기존 최대 `28rem` 폭과 Form Gap을 공유하며 Label/Input 간격은
`0.5rem`, Input/Submit Button 최소 높이는 `2.75rem`입니다. Google 버튼은
폼과 동일한 전체 폭·Typography·Radius를 사용하고 Border·Hover·Focus를 정의합니다.
외부 Icon 라이브러리나 새 의존성은 추가하지 않았고, 로그인·OAuth2 동작은 변경하지 않았습니다.

검증은 기존 Signup·Login·Google Callback·Navigation·인증 통합 테스트를 재사용합니다.
브라우저에서는 데스크톱 Login/Signup, 320px Login의 가로 넘침 없음,
Google 버튼의 키보드 Focus Outline을 확인했습니다. jsdom 테스트는 CSS 렌더링 검증을
대체하지 않으며 원격 CI 결과는 Push/PR 후 따로 확인해야 합니다.
Home 개발용 Placeholder와 전체 Color Palette는 변경하지 않았습니다.
최종 디자인·세부 UX·전체 시각적 일관성 검수는 f0.6.0의 수동 검수 범위입니다.

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

인증 Utility는 `state/tokenHints.ts`, 공유 역할·로그아웃 결과 타입은 `state/authTypes.ts`에 있습니다.
API Layer·Auth State·Router의 책임, f0.3.0 확장 지점 및 통합 검증 Matrix는
[Authentication User Flow](../docs/testing/frontend-authentication-flow.md)에 정리했습니다.
통합 테스트는 `fetch`만 Mock으로 대체하며 실제 Backend/Google 연동 검증과 구분합니다.

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
조회, 예약·관리자 화면은 후속 Frontend 이슈 범위입니다.

## 숙소 검색·목록 (#178)

로그인 후 Header의 숙소 검색 또는 `/accommodations`에서 운영 중인 숙소를 조회합니다.
`GET /api/v1/accommodations`의 `AccommodationSearchRequest`, `AccommodationResponse`,
`PageResponse`를 기준으로 `src/api/accommodation.ts`의 타입·Query 직렬화·응답 검증을 구성했습니다.
화면은 숙소명 부분 검색, 도시 정확한 이름, 지역, 체크인/체크아웃, 인원, 기본 1박 가격 범위와
등록순/이름순 정렬을 제공합니다. 기본은 `status=ACTIVE`, `size=20`, 오름차순이고 새 검색은
0페이지부터 시작합니다. 날짜는 한 쌍으로 입력해야 하며 날짜 입력 시 Backend가 `available=true`를
기본 적용합니다. 가격은 날짜별 Override나 숙박 총액이 아닌 활성 객실 기본 가격입니다.
이후 #179에서 편의시설/운영 상태/예약 가능 여부/정렬 방향/페이지 크기 UI와 URL 동기화를 추가했습니다.

카드는 숙소명·위치·설명·숙소 편의시설·운영 상태만 표시합니다. 응답에 이미지와 가격이 없으므로
임의 이미지/최저가를 만들지 않습니다. 과거 데이터의 null 구조화 위치는 기존 주소만 표시합니다.
DTO에서 UI Model로의 변환은 `components/accommodation/accommodationView.ts`로 분리했습니다.
Loading/Error/Empty 상태, 오류 재시도, 이전/다음 페이지, 교체 요청 취소와 늦은 응답 무시를 제공합니다.
카드의 숙소명 Link는 #180 상세 화면으로 이동하여 숙소 상세·객실 목록을 조회합니다. 예약은 후속 범위입니다.

`pnpm test`는 API Query/Bearer/응답 검증, 목록 Mapping·Link·Empty,
실제 Client와 연결된 검색 화면의 Loading·Pagination·검증·Retry·경합,
인증 전 요청 차단과 상세 경로 이동을 HTTP Mock으로 검증합니다.
실제 Backend 연결은 별도 확인해야 합니다. Docker Compose와 Backend를 실행한 뒤 `pnpm dev`에서
로그인하고 검색을 제출하여 개발자 도구 Network의 `/api/v1/accommodations`가 200인지,
실제 목록·빈 결과·페이지 이동·날짜 검색이 정상인지 확인하세요. 토큰을 공유하거나 기록하지 마세요.
자동 테스트는 개발 DB를 사용하거나 변경하지 않으며 추가 의존성/환경변수/CI Service는 없습니다.

이번 로컬 검증은 관련 19개/전체 165개 테스트, Lint·Format Check·Type Check·Build 통과입니다.
Docker MySQL·Redis·Kafka의 Healthy 상태는 확인했지만 8080 Backend Listener가 없어
실제 로그인 후 검색과 브라우저 렌더링 검수는 실행하지 못했습니다. 원격 GitHub Actions 결과도
Push/PR 후 별도로 확인해야 합니다.

## 검색 URL 상태·Pagination (#179)

`searchQuery.ts`는 Backend Request를 기준으로 URL 파싱·검증·직렬화를 담당합니다.
`AccommodationSearchPage`는 React Router `useSearchParams`의 URL을 제출된 검색 상태의 기준으로
사용합니다. Form의 미제출 입력은 URL/API에 반영하지 않으며 검색 제출 시 `page=0`으로 갱신합니다.
페이지 이동은 제출된 조건·Size를 유지합니다. URL 변경 시 폼을 복원하고 이전 요청을 취소하여
뒤로가기/앞으로가기에서도 폼·API 조건·페이지가 함께 바뀝니다. 같은 조건 재검색과 오류 재시도도 지원합니다.

Form은 Backend가 지원하는 `ID`/`NAME`, `ASC`/`DESC`, `ACTIVE`/`INACTIVE`,
페이지 크기 1~100, 숙소/객실 편의시설 AND 조건을 제공합니다. 날짜를 입력하면 기본 예약 가능 검색이며,
명시적 예약 가능/불가 선택은 날짜 쌍이 필요합니다. 도시 검색은 정확한 구조화 값입니다.
지역은 구조화된 지역명과 정확히 비교하지만, Backend는 지역이 null인 과거 데이터에 한해
기존 주소 부분 검색을 사용합니다. 가격은 기본 1박 가격이고 투숙 총액/날짜별 Override는 아닙니다.

예: `/accommodations?name=호텔&city=서울특별시&page=1&size=10&sortBy=NAME&direction=ASC`
URL의 Page는 0부터 시작하며 표시 Page는 1부터 시작합니다. 날짜는 실제 달력 날짜인지 검증하고,
중복 단일 조건·알 수 없는 조건/Enum·음수 Page·잘못된 Size/인원·기간·가격은 API로 보내지 않습니다.
잘못된 URL은 오류 안내와 기본 조건 폼을 표시하며 정상 검색 제출로 복구할 수 있습니다.
편의시설 반복 값은 중복 제거하며 텍스트는 Trim합니다. 가격은 부동소수점 반올림 없이 비교하고,
Frontend 입력 보호를 위해 가격 문자열은 최대 100자까지 허용합니다.

전체 새로고침은 URL을 유지하지만 인증 Token은 메모리에만 있으므로 재로그인이 필요합니다.
로그인 복귀 후 URL에서 조건을 복원합니다. Storage에 토큰이나 검색 결과를 추가하지 않았습니다.
자동 검증은 Query 파싱/변환·잘못된 조건 차단·URL 재마운트 복원·History Navigation·Pagination이며,
실제 브라우저 새로고침/Backend 연동을 대체하지 않습니다.
로컬에서 Backend와 `pnpm dev`를 실행하고 로그인한 후 조건 검색 → 다음 페이지 → 뒤로/앞으로 →
새로고침 후 재로그인을 수행하여 Form과 URL, Network Query가 일치하는지 확인하세요.
이번 환경에서는 8080 Backend가 실행되지 않아 실제 Backend 연동은 미검증입니다.
의존성·환경변수·CI 설정은 변경하지 않았으며 Frontend CI의 기존 검증 명령을 그대로 사용합니다.

## 숙소 상세·객실 정보 (#180)

`/accommodations/:accommodationId`는 기존 `USER`/`ADMIN` 보호 경로에서
`GET /api/v1/accommodations/{id}`를 호출합니다. `AccommodationResponse`의 기존 타입·검증을
재사용하고 이름·설명·위치·숙소 편의시설·운영 상태·체크인/체크아웃·시간대를 표시합니다.
과거 데이터의 null 위치/시간은 주소와 미등록 안내로 표시하며 값을 추측하지 않습니다.
숫자가 아니거나 안전한 양의 정수가 아닌 ID는 요청 전에 차단하고, 404는 숙소 없음으로 표시합니다.

숙소 조회 성공 후 `GET /api/v1/accommodations/{id}/rooms`로 20개씩 ID 오름차순 객실을 조회합니다.
별도 `RoomResponse`/`RoomPageResponse` 타입과 응답 검증은 `src/api/room.ts`에 있습니다.
`AccommodationInfo`, `RoomListSection`, `RoomList`, `RoomCard`로 표시와 조회 책임을 분리했습니다.
객실 ID·숙소 ID·이름·Capacity·기본 1박 가격·WIFI/AIR_CONDITIONER·상태를 실제 DTO에 맞춰 다룹니다.
가격은 JSON Number로 제공되는 기본 가격만 표시하며 통화는 응답에 없어 임의로 원화 기호를 붙이지 않습니다.
날짜별 가격·총액·재고·예약 가능 여부가 아니며 금액 계산이나 예약 가능 표시를 하지 않습니다.
일반 목록은 운영 중지 객실도 포함할 수 있어 상태를 함께 표시합니다.

현재 예약/취소 정책 Controller에는 POST/PUT만 있고 GET이 없으며 숙소 상세 DTO에도 정책이 없습니다.
따라서 정책 값을 표시하거나 기본 정책을 임의로 안내하지 않고 조회 제한 문구를 표시합니다.
이를 위해 Backend 계약을 확대하지 않았습니다. 정책 조회 API가 제공되면 별도 연결이 필요합니다.
이후 #181에서 Availability 조회·날짜 선택·객실 선택을 추가했습니다. 예약 생성·이미지 추가는 후속 범위입니다.

숙소/객실 각각 Loading/Error·Retry를 제공하며 객실 실패 시 숙소 정보는 유지하고 객실만 재시도합니다.
객실 목록은 Empty와 이전/다음 페이지를 지원합니다. `useDetailQuery`는 요청 취소 및
Load Callback/Retry 식별을 통해 다른 숙소로 이동한 후 과거 응답이 화면을 덮어쓰는 것을 막습니다.
테스트는 실제 API Client에 HTTP 응답만 Mock하여 상세/객실 계약·Route 연결·404·ID 검증·
null·Empty·Retry·Pagination·늦은 응답 무시를 검증합니다. 자동 테스트는 개발 DB를 변경하지 않습니다.

실제 연동 확인: Docker Compose/Backend 실행 → `pnpm dev` → 로그인 → 검색 카드 선택 →
Network에서 상세 및 `/rooms?page=0&size=20&sortBy=ID&direction=ASC` 200 확인 → 객실 페이지 이동.
등록된 숙소와 없는 ID를 각각 확인하고 Token 응답을 기록하거나 공유하지 마세요.
이번 환경에서는 8080 Backend Listener가 없어 실제 Backend 연동과 브라우저 렌더링 검수는 미검증입니다.
새 의존성·환경변수·CI 서비스는 없으며 기존 Frontend CI 명령을 그대로 실행합니다.

## 날짜 기반 객실 가용성·선택 (#181)

#180 상세 화면 아래 `RoomAvailabilitySection`에서 날짜·인원을 입력한 후
`GET /api/v1/accommodations/{id}/rooms/available`을 호출합니다. 파라미터는
`checkInDate`, `checkOutDate`(ISO `yyyy-MM-dd`), `guestCount`, 0-based `page`, `size=20`입니다.
응답은 기존 `PageResponse<RoomResponse>`이며 ID 오름차순입니다. 일반 객실 목록과
별도 영역으로 표시하며 그 목록에서 예약 가능한 것으로 추측해 선택하지 않습니다.

Backend는 활성 숙소/객실·인원·모든 `[체크인, 체크아웃)` 날짜의 OPEN 재고·숙소 예약 정책을
검사합니다. 프런트엔드는 재고 수량을 계산하거나 API에 없는 남은 수량을 표시하지 않습니다.
빈 응답은 가용 객실 없음으로, API 실패/정책 오류는 실패 안내와 재시도로 구분합니다.
반환된 객실만 선택 가능하고 기본 가격·Capacity·편의시설은 기존 RoomCard를 재사용합니다.
가용성은 조회 시점의 정보이며 이후 예약 생성 시 Backend가 최종 검증해야 합니다.

Frontend는 실제 달력 날짜·체크아웃 > 체크인·양의 정수 인원을 검증합니다.
Backend의 숙소 TimeZone/사전 예약 정책을 복제하거나 브라우저 오늘 날짜로 임의 제한하지 않습니다.
날짜/인원은 편집용 Local State, 제출 조건·선택 객실은 해당 숙소 화면의 Local State입니다.
입력 편집 즉시 기존 결과/선택을 제거하고 요청을 취소합니다. 재조회·페이지 이동·재시도 및
숙소 ID 변경도 선택을 초기화하며 늦은 이전 응답은 무시합니다. 전역 Auth Context나 Storage에
Booking State를 보관하지 않습니다. 이후 #182에서 선택 객실의 날짜별 적용 가격·예상 합계를
연결했습니다. 별도의 가격 옵션 선택이나 예약 생성은 아직 없습니다.

자동 테스트는 날짜·인원 검증, 실제 API Client의 Query/Bearer·계약·오류,
선택/해제·초기화·Empty/Error/Retry·Pagination·늦은 응답과 상세 화면 연결을 HTTP Mock으로 검증합니다.
수동 검증은 Backend/Compose 실행 → 로그인 → 상세 화면 → 유효 날짜와 인원 조회 → Network의
`/rooms/available` 200 및 결과 확인 → 객실 선택 → 날짜 수정 후 선택/결과 소멸 → 재조회 순서입니다.
없는 재고 날짜/과도한 인원/숙소 변경도 확인하세요. 개발 DB/Volume을 테스트로 삭제하지 마세요.
이번 환경에서는 8080 Backend가 실행되지 않아 실제 Backend 가용성 연동은 미검증입니다.
새 의존성·환경변수·CI 설정은 없습니다.

이번 브랜치는 미병합 #180의 마지막 커밋 `e70843d`를 기반으로 작업했습니다.
#180 PR/브랜치와 develop은 변경하지 않았습니다. #180 병합 후 develop을 갱신하고
#181 작업 브랜치에도 병합 결과를 반영한 뒤 최종 PR diff와 CI를 확인해야 합니다.

## 객실 요금·예약 요약 (#182)

가용 객실 선택 시 `BookingSummary`가 객실·Capacity·인원·숙박 기간·숙박일 수·기본 가격,
숙박일별 적용 요금/출처와 총 예상 금액을 표시합니다. 가격 타입은 `api/bookingPrice.ts`의
`RoomDailyPriceResponse`/`BookingPrice`로 정의했습니다. 기간 전체 견적 API가 없으므로
`GET /api/v1/rooms/{roomId}/prices/{stayDate}`를 `[check-in, check-out)`의 각 날짜에 호출합니다.
요청은 최대 4개 동시 실행으로 제한하고 날짜 순서대로 표시합니다. UTC 달력 연산으로
숙박일을 열거하여 브라우저 TimeZone/DST 영향과 체크아웃 포함 오류를 방지합니다.

Backend는 날짜별 가격이 있으면 `DAILY`, 없으면 객실 기본 가격을 `DEFAULT`로 반환합니다.
프런트엔드는 이 정책을 복제하거나 실패한 날짜에 자체 기본 가격을 적용하지 않고 반환된
값만 합산합니다. `nightlyPrice`는 Backend `DECIMAL(12,2)`의 JSON Number 계약입니다.
`utils/money.ts`는 그 숫자의 십진 문자열을 정수 단위(BigInt)로 변환해 합산·서식화합니다.
지원되지 않는 Precision/Scale은 반올림으로 숨기지 않고 오류로 처리합니다.
API에 Currency가 없어 통화 기호를 붙이지 않습니다. 세금·추가 수수료·Add-on 계약도 없어
0원 항목이나 임의 옵션을 만들지 않습니다.

하루라도 실패하면 부분 합계를 표시하지 않고 관련 요청을 중단하며 전체 가격 재시도를 제공합니다.
날짜/인원/숙소 변경은 #181 선택 초기화에 따라 요약을 제거하고, 선택 객실 변경은 이전 요청을
취소하고 새 요금을 조회합니다. 늦은 이전 응답은 현재 요약을 덮어쓰지 않습니다.
일별 조회는 하나의 DB Snapshot이 아니며 조회 중 가격이 변경될 수 있습니다. 이 합계는
화면 표시용 예상 금액일 뿐 가격 보장/최종 예약 금액이 아닙니다. 최종 금액은 Backend의
예약 생성 Transaction에서 당시 가격으로 다시 계산하며 아직 Frontend 예약 생성은 연결하지 않았습니다.
장기 숙박은 날짜 수만큼 요청하므로 추후 Backend 기간 견적 API가 제공되면 대체할 수 있습니다.

HTTP Mock 테스트는 DAILY/DEFAULT 혼합·정확한 합산·Checkout 제외·윤년/연말·계약 오류·
4개 요청 제한/취소·부분 실패/재시도·조건 변경/늦은 응답·가용 객실 선택→요약 연결을 검증합니다.
실제 확인은 Backend/Compose 실행 → 로그인 → 상세 → 날짜/인원 조회 → 객실 선택 → Network에서
숙박일별 `/prices/{stayDate}` 200과 요금 출처/예상 합계 확인 → 객실/날짜 변경 순서로 진행합니다.
자동 테스트는 개발 DB/Volume을 변경하지 않습니다. 이번 환경은 8080 Backend가 실행되지 않아
실제 Backend 가격 연동 및 브라우저 렌더링은 미검증입니다. 의존성·환경변수·CI 설정 변경은 없으며
기존 Frontend CI 명령으로 검증합니다.

## 예약 정보 입력·Booking State (#183)

상세 화면의 가용 객실 선택 뒤 `BookingFlow`에서 대표 투숙객 정보를 입력하고
`예약 입력 내용 확인`으로 제출 전 요약을 확인합니다. 숙소명·객실·날짜·인원과 #182의
예상 요금에 대표 투숙객 정보를 연결합니다. 확인은 예약 생성이 아니며 POST는 호출하지 않습니다.
#184에서 예약 생성 버튼과 실제 API 호출을 연결했습니다. 요금 오류 시 부분/임의 합계를 표시하지 않으며
입력 내용 확인은 가능하지만 최종 금액이 확보된 것으로 간주하지 않습니다.

`api/booking.ts`의 `BookingRequest`는 Backend `CreateReservationRequest` 그대로
`roomId`, `guestCount`, `checkInDate`, `checkOutDate`, `representativeGuest`를 정의합니다.
대표 투숙객은 필수 이름(100자), 이메일(255자), 전화번호(30자)이며 연락처 허용 문자는
숫자·`+() .-`입니다. Frontend는 필수값·길이·기본 이메일 형식을 안내하고 Backend Bean Validation이
최종 판단합니다. 성인/아동 구분·메모·결제·동의 항목은 Backend 계약에 없어 추가하지 않습니다.
회원 ID, 숙소 ID, 예상 가격은 예약 요청에 포함하지 않습니다.

`bookingState.ts`는 선택 숙소/객실/기간/인원과 투숙객 Draft, `input/review` 상태 및
요청 생성 책임을 정의합니다. ID 일치·필수 선택·유효 날짜·양의 정수 인원·조회된 객실 Capacity를
검사합니다. Capacity 검사는 즉시 입력 안내일 뿐 최신 Capacity·예약 정책·운영 상태·재고·가격은
예약 생성 시 Backend가 최종 검증합니다. 누락되거나 잘못된 선택은 Form/가격 조회 전에 차단합니다.
페이지에서는 실제 상세 숙소명과 가용성 API가 반환한 객실만 연결합니다.

Auth State와 Booking State는 분리합니다. 기존 USER/ADMIN 보호 경로를 재사용하며,
현재 Auth State에는 검증된 이름/이메일 Profile이 없으므로 JWT나 로그인 이메일을 추측하여
자동 입력하지 않습니다. 예약 소유 회원은 Backend의 JWT Principal로 결정하고 투숙객은 별도 입력합니다.
Booking State는 선택 조건에 Key를 둔 컴포넌트의 메모리에만 보관하며 Storage/URL/History State에
개인정보를 저장하지 않습니다. 입력→확인→정보 수정에서는 Draft를 유지하지만 날짜·인원·객실·숙소
변경, 재조회/페이지 이동/선택 해제, 화면 이탈 시 폐기합니다. 새로고침은 초기화되며 재로그인 및
객실 재선택이 필요합니다. 브라우저 뒤로/앞으로 상세 화면에 재진입해도 이전 예약 Draft는 복원하지 않습니다.
별도 Booking Route를 만들지 않아 상태 없는 직접 URL 접근으로 입력 단계를 건너뛰지 않습니다.

자동 테스트는 DTO 필드·선택 일치·필수/길이/형식·Capacity·State 전이·정보 수정·조건 변경 초기화·
재마운트·요금 실패와 실제 상세→가용성→투숙객→확인 및 MemoryRouter 뒤로/앞으로 초기화를 검증합니다.
HTTP 응답만 Mock하며 실제 Backend 생성이나 개발 DB 변경은 수행하지 않습니다.
수동 확인은 Backend/Frontend 실행 후 로그인→숙소 상세→기간/인원 조회→객실 선택→투숙객 입력→
확인→수정→조건 변경→화면 이탈 및 뒤로/앞으로→새로고침 순서입니다.
실제 Backend 및 브라우저 연동 검증은 자동 테스트와 별도로 수행해야 합니다.
의존성·환경변수·실행 설정 변경은 없으며 기존 Frontend CI 명령을 그대로 사용합니다.

## 예약 생성·완료 Flow (#184)

확인 화면의 `예약 생성`은 `POST /api/v1/reservations`에 #183에서 검증한 요청만 보냅니다.
공유 API Client의 Bearer 인증과 전송 전 Token 준비를 재사용하되, 비멱등 POST이므로
401 응답 후 자동 Refresh/재전송은 이 호출에서 비활성화했습니다. Backend가 회원 소유권·
현재 가격·Capacity·예약 정책·재고·동시성 정합성을 최종 결정합니다. 가격 변경 전용 오류 계약은
없으며 예상 가격을 요청하지 않고 서버의 확정 `totalAmount`를 표시합니다.

`BookingSubmit`은 동기 Ref로 같은 화면의 중복 클릭을 차단하고 전송 중 수정/제출을 비활성화합니다.
성공 시 제출을 잠그고 `/reservations/{reservationId}/complete`로 replace 이동해 Draft를 폐기합니다.
완료 화면은 History/Storage의 개인정보나 성공 표시를 신뢰하지 않고
`GET /api/v1/reservations/{reservationId}`를 다시 호출합니다. Backend 본인 조회 권한을 적용하고
실제 예약 ID·번호·객실 ID·기간·인원·대표 투숙객·금액 Snapshot·현재 상태를 표시합니다.
재방문한 취소 예약은 취소 상태로 표시하며 결제 완료로 표현하지 않습니다.
완료 조회 실패는 생성 POST를 다시 보내지 않고 GET만 재시도합니다.
예약 결과 타입은 전체 ReservationResponse 중 화면이 사용하는 필드의 Projection입니다.
총액은 Backend `DECIMAL(19,2)`이며 JSON Number를 정수 소수 단위로 변환합니다.
안전한 정수 단위 범위를 넘는 응답은 정확한 값을 추측/반올림하지 않고 오류로 처리합니다.
해당 범위를 지원하려면 향후 Backend 문자열 금액 계약이 필요합니다.

400 Validation은 Backend 필드 오류를 표시하고, 404/409의 재고 부족·운영 상태·낙관적 충돌·
락 대기·예약 정책 거절은 서버 메시지와 조건 재조회 안내를 표시합니다. 입력과 확인 상태를 유지하고
사용자가 수정/명시적 재시도를 선택합니다. 명확한 `503 INVENTORY_013` 락 서비스 거절만
복구 후 수동 재시도를 허용합니다. 나머지 5xx·네트워크·Timeout·취소·성공 응답 파싱 실패는
생성 여부 불명으로 취급해 같은 화면에서 재전송/정보 수정을 잠그고 서버 예약 기록 확인을 안내합니다.
401/403은 로그인/권한 안내로 구분하며 보호 Route의 기존 로그인 복귀 URL 정책을 재사용합니다.
재로그인 후 숙소 상세로 복귀해도 개인정보 Draft는 복원하지 않습니다.

Backend에는 생성 Idempotency Key/클라이언트 요청 ID 조회가 없습니다. UI 잠금은 현재 화면에서의
중복 클릭 방지일 뿐 새 탭/화면 재진입의 중복 생성을 보장하지 않습니다. 화면 이탈 후에도 전송된
POST는 서버에서 완료될 수 있으며 클라이언트 취소가 롤백을 의미하지 않습니다. 이탈/로그아웃 후
늦은 응답은 기존 화면으로 이동시키지 않습니다. 현재 내 예약 목록 Frontend는 후속 작업이므로
불명 결과 확인은 Backend 본인 예약 조회/Swagger 또는 운영 확인이 필요합니다.

자동 검증은 실제 Client의 Body/Bearer/401 무재전송·응답 계약·도메인 오류·중복 클릭·수동 재시도·
불명 결과 잠금·늦은 응답 무시·완료 GET/잘못된 ID/권한/404/취소 상태 및
실제 AuthProvider/Router/상세/입력/POST/완료 흐름의 HTTP 경계 Mock 테스트입니다.
개발 DB나 Volume은 변경하지 않습니다. 실제 연동 수동 절차는 Compose/Backend/Frontend 실행→
로그인→재고가 준비된 숙소/기간 선택→투숙객 입력/확인→예약 생성→Network POST 201 및
완료 GET 200→반환 번호·확정 금액·서버 예약/재고 확인 순서입니다. 테스트 예약은 실제 데이터를
변경하므로 별도의 테스트 계정/객실을 사용하세요. 재고 부족/정책 거절도 별도로 확인합니다.
이번 환경은 8080 Backend가 실행되지 않아 실제 Backend 생성 및 브라우저 검수는 미검증입니다.
의존성·환경변수·CI 설정 변경은 없으며 기존 Frontend CI 검증 명령을 그대로 실행합니다.

## Search → Booking 최종 통합 검증 (#185)

기존 `BookingCreationFlow.integration.test.tsx`를 확장해 검색 URL/Pagination→상세→가용 객실→
혼합 날짜별 요금→투숙객→생성→서버 완료 조회를 실제 AuthProvider/Router/API Client와 함께 검증합니다.
재고 부족·동시성 충돌·예약 정책 거절·Network 실패·Empty·대기 중 중복 클릭도 통합 검증합니다.
HTTP 경계만 Mock하며 실제 Backend/브라우저/원격 CI 검증과는 구분합니다.
공통 달력 검증과 완료 URL 생성은 각각 `utils/calendarDate.ts`, `app/routePaths.ts`로 단일화했습니다.
기존 개별 테스트는 유지하고 중복 테스트 파일/새 API·상태 라이브러리는 추가하지 않습니다.

커버리지 Matrix, Search/Booking/Auth 책임, f0.4.0 서버 ID·공개 번호 계약과 실제 연동 절차는
[`Frontend Search & Booking Flow`](../docs/testing/frontend-search-booking-flow.md)에 정리했습니다.
