# Frontend Authentication User Flow — #168

## 검증 경계

`frontend/src/test/AuthenticationFlow.integration.test.tsx`는 실제 Form, API 함수,
API Client, 메모리 Token Store, AuthProvider, AppRoutes와 ProtectedRoute를 함께 실행합니다.
`fetch` HTTP 경계만 Mock으로 대체하고 React StrictMode에서도 실행합니다.
백엔드 데이터베이스·Redis·Google 서버를 실행하거나 개발 DB 데이터를 변경하지 않습니다.
기존 API·Form·Provider·Router 단위 테스트는 유지합니다.

이는 프런트엔드 통합 테스트이지 실제 브라우저/백엔드 End-to-End 테스트가 아닙니다.
JWT Fixture의 서명은 테스트 문자열이며 실제 백엔드는 이를 인증 Token으로 허용하지 않습니다.

## 인증 책임과 f0.3.0 확장 지점

| 영역 | 책임 | 다른 영역에서 하지 않을 일 |
| --- | --- | --- |
| `api/auth.ts`, `api/member.ts`, `api/reissue.ts` | Endpoint·Request/Response 계약 및 응답 형식 검사 | Router 이동·사용자 메시지 표시 |
| `api/client.ts` | JSON·Timeout·Bearer, 만료 전처리, 단일 재발급, 최대 1회 Replay, 공통 오류 변환 | 페이지별 권한 판단·프로필 보관 |
| `state/tokenHints.ts` | UTF-8 JWT Payload 해석, ACCESS 타입·미래 만료시각 검사, Role Hint | JWT 서명 검증을 했다고 주장 |
| `state/authTypes.ts` | 공통 `UserRole`·`LogoutResult` 타입 | API 사용자 정보가 없는데 프로필 생성 |
| `state/accessToken.ts` | 메모리 Token Pair·Expiry·Session Version·Loading 통지 | Web Storage/Cookie 저장 |
| `AuthProvider`·`useAuth()` | Client 인증 상태 구독, 만료 Timer, 로그인·로그아웃 Lifecycle | 숙소·객실·예약 Server State 저장 |
| `ProtectedRoute`·Login/Callback Page | 로그인 이동·안전한 원래 경로 복귀·역할별 화면 제어 | 백엔드 인증/인가 대체 |
| `RootLayout` | 역할별 Navigation·로그아웃 진행 UI·완료 안내 | 보호 라우트와 로그아웃 이동을 경쟁시킴 |
| Backend | JWT 서명·만료, ADMIN 역할, 예약 소유권 등 최종 검증 | Client Role Hint 신뢰 |

JWT 만료와 역할 해석을 하나의 Utility로 합쳤고 API DTO와 Router가 같은 `UserRole`을 사용합니다.
사용자 Profile은 `/me` API가 없으므로 계속 `null`입니다. 저장소에 존재하는 타입과 계약만 사용합니다.
재발급 응답과 이전 요청은 Session Version을 확인하므로 늦은 응답이 새 세션을 덮지 않습니다.

숙소 검색·예약 화면은 보호 Route 아래에 추가하고 `apiClient.request()`로 API를 호출합니다.
로그인·회원가입·Token 교환처럼 공개 Endpoint만 `includeAuth: false`를 사용합니다.
도메인별 Request/Response는 해당 API 모듈에서 정의하고 인증 Context에 조회 결과를 복제하지 않습니다.
401은 공통 인증 Lifecycle이 처리하며, 403은 해당 화면이 안내해야 합니다. 403이나 일반
API Network Error만으로 Token을 삭제하거나 재발급하지 않습니다. 재발급 자체의 실패는 재로그인이 필요합니다.
새 보호 영역을 추가하면 `routePaths`, Route 설정과 `safeLoginReturn` 허용 영역도 함께 갱신합니다.

## 검증 Matrix

| 시나리오 | 연결 검증 |
| --- | --- |
| Signup → Email Login → API → Logout | 실제 Form 제출·공개 API 무 Bearer·가입 성공 익명 유지·로그인 상태·보호 API Bearer·204 로그아웃·두 Token 삭제·보호 경로 재진입 차단 |
| USER/ADMIN 직접 `/admin` 접근 | 익명 로그인 이동·로그인 후 원래 경로 복귀·USER 접근 불가·ADMIN 화면과 메뉴 허용 |
| 동시 보호 API 401 | 재발급 1회·Loading·현재 URL 유지·두 요청을 새 Token으로 Replay |
| Access Token 만료 | 실제 Provider Timer → 재발급 → 새 Token으로 후속 API |
| 재발급 401/Network Error 및 Replay 401 | 재로그인 상태·Token 삭제·추가 재발급 없음·원래 Query 경로 복귀 |
| 보호 API 403/Network Error | 오류 분류 보존·인증 상태 유지·재발급 없음 |
| Google Callback | state 검증·공개 코드 교환·Token Pair 설정·원래 보호 경로 복귀·StrictMode 교환 1회 |
| Google 취소/state 불일치/교환 실패 | 인증 상태 생성 안 함·Storage 임시 값 제거 |
| 보호 화면 Logout 실패 | 진행 UI·중복 요청 방지·서버 미확인 안내·로컬 세션 삭제 |
| 전체 Module Reload | `SessionReload.test.ts`가 Module을 재생성하여 Token·Role·Loading이 초기화됨을 검증 |
| JWT Utility | `tokenHints.test.ts`가 타입·만료·잘못된 Payload·미지 역할·UTF-8 Payload 검증 |

Module Reload 검증은 실제 브라우저 새로고침을 대신한 메모리 정책 검증입니다.
새로고침 이후 지속 인증 복원은 구현하지 않았으며 보호 화면은 다시 로그인해야 합니다.
개별 테스트는 Validation/중복 이메일/로그인 오류/Timeout/재발급 중 새 요청/늦은 응답/
로그아웃과 새 로그인 경합/Router 역할 검사 등 기존 경계를 보완합니다.

## 이번 통합 검증에서 수정한 연결 문제

보호 화면에서 로그아웃하면 Token 삭제에 따른 ProtectedRoute의 `<Navigate>`와
RootLayout의 로그아웃 완료 이동이 경쟁해 `logoutResult` 안내가 사라졌습니다.
RootLayout은 로그아웃 중 Outlet 대신 LoadingState를 표시하며 완료 Router 이동과 Loading 해제를
같은 React Transition으로 묶습니다. 토큰 삭제 직후의 이전 보호 Route가 다시 마운트되어
완료 Router State를 덮지 않게 했습니다. 성공과 실패 모두 실제 HTTP 경계 통합 테스트로 검증합니다.

## 실행 및 CI

```bash
cd frontend
pnpm install --frozen-lockfile
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
```

위 명령은 `.github/workflows/frontend-ci.yml`과 동일합니다. 추가 의존성·환경변수·CI Service는 없습니다.
Windows 로컬 실행 성공은 GitHub Ubuntu Runner의 실제 Check 성공과는 구분합니다.
원격 브랜치 Push/PR 후 `Frontend Test and Build` Check를 확인해야 합니다.

## 실제 Backend 연동 확인 — 미검증

#168 작업 환경에서 Docker Desktop Linux Engine Pipe가 없었고 8080 API Listener도 확인되지 않았습니다.
실제 Backend/Redis/Google 연동과 원격 CI는 실행 완료로 표시하지 않습니다.
개발 DB·Volume은 변경/삭제하지 않았습니다. 아래는 인프라가 준비된 뒤의 수동 검증 절차입니다.

1. Docker Desktop을 실행하고 루트의 기존 `.env` 설정으로 `docker compose up -d`,
   `docker compose ps`를 확인합니다. 비밀값은 문서/로그에 복사하지 않습니다.
2. `backend/`에서 Gradle Wrapper `bootRun`, `frontend/`에서 `pnpm dev`를 실행합니다.
   Vite Proxy와 Google Redirect 환경변수는 기존 README 설정을 사용합니다.
3. `/signup`에서 전용 테스트 이메일로 가입 → 이메일 로그인 → `/reservations` 접근을 확인합니다.
   이 수동 작업은 실제 개발 DB에 회원을 생성하므로 승인된 테스트 계정을 사용합니다.
4. DevTools에서 보호 API의 Bearer Header와 공개 API의 무 Bearer를 확인하되 Token을 공유/기록하지 않습니다.
   예약 목록 API는 읽기 요청으로 확인합니다. 접근 확인 화면 자체는 예약 API를 호출하지 않습니다.
5. 별도 검증 환경에서 Access Token TTL을 짧게 설정해 만료·동시 요청 시 재발급 1회와 새 Token 적용을
   확인합니다. Redis 실패는 운영/공용 인프라가 아닌 격리된 검증 환경에서만 재현합니다.
6. Logout → 보호 URL 직접 접근 → Login 이동, 보호 화면 새로고침 → 익명/Login 이동을 확인합니다.
7. 기존 승인된 ADMIN 테스트 계정으로 `/admin` 접근을 확인하고 USER 계정의 직접 접근은 차단되는지 확인합니다.
   관리자 회원이나 권한을 임의로 DB에 추가/변경하지 않습니다.
8. Google 로그인 성공/취소와 원래 경로 복귀를 실제 브라우저에서 확인합니다.
   실제 Google 동의 페이지·Backend Session state·Redis 일회용 코드 처리는 Mock 테스트 범위가 아닙니다.

실제 Backend/Google 검증과 원격 CI 확인 전에는 f0.2.0의 모든 완료 조건이 충족됐다고 표시하지 않습니다.
