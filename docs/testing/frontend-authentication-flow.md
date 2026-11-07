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

숙소 검색·상세·가용성·적용 가격은 #195부터 공개 Route/GET이며 `includeAuth: false`를 사용합니다.
예약 결과·내 예약·관리자는 보호 Route를 유지합니다. 예약 생성에는 Bearer를 보냅니다.
공개 탐색에서 로그인 복귀 문맥과 재검증은 [공개 탐색 문서](public-exploration-booking-flow.md)를 따릅니다.
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
완료 Router State를 덮지 않게 했습니다. 성공과 실패 모두 HTTP Mock 통합 테스트로 검증합니다.

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

## 격리된 실제 인증 검증 (#300)

[격리 환경 실행 및 계약](frontend-backend-integration.md)의 JAR/Frontend 준비 후, 루트에서
`node scripts/integration/run.mjs --auth`를 실행합니다. `--hold`를 붙이면 스모크 후
브라우저 점검을 이어갈 수 있습니다. 수동 로그인용 임시 비밀번호는 런북의 마스킹 입력을 사용합니다.
기본 개발 Compose, 제품 토큰 TTL, CI는 변경하지 않습니다. Browser 증거를 저장할 때 비밀번호,
토큰, OAuth 코드/state, 투숙객 정보와 전체 요청/응답은 제외합니다.

| 경계 | 검증 |
| --- | --- |
| 실제 API와 DB | 기존 제품 API Client로 가입 201/중복 409/필드 오류 400, 이메일 로그인 200/401, 익명 예약 401·다른 USER/ADMIN 예약 403·본인 조회 200, ADMIN 재고 200/USER 403을 확인합니다. |
| 만료와 재발급 | 격리 Access TTL만 12초입니다. 클라이언트 만료 이후 실제 Redis 재발급 200 → 보호 GET 200을 확인합니다. 서버의 JWT 시간 허용 범위와 클라이언트 만료 기준이 다를 수 있으므로, 반응형 401 재현에는 실제 로그인 응답에서 서명만 변경한 테스트 토큰을 씁니다. |
| 실제 요청 기록 | 병렬 GET 401 두 건 → POST reissue 200 한 건 → GET 200 두 건. 일정 변경 PATCH 401 한 건은 갱신/재실행하지 않고, 새 GET으로 저장 날짜가 그대로인지 확인합니다. 실제 fetch 응답을 바꾸지 않으며 메서드·API 경로·상태만 집계합니다. |
| 로그아웃·실패 | 로그아웃 후 Redis Refresh 재사용은 401입니다. 이미 발급된 유효 Access는 즉시 폐기되지 않습니다. 폐기된 Refresh로 GET 401 뒤 갱신이 실패하면 재시도 없이 메모리를 비우고 재로그인이 필요합니다. |
| 로컬 OAuth 교환 | 전용 Redis에 짧은 TTL의 합성 일회용 코드를 넣어 만료/재사용 401, 유효 코드 교환과 보호 API를 검증합니다. Provider가 발급한 코드가 아니며 Google과 통신하지 않습니다. |
| 실제 Browser | 가입 화면, 잘못된 로그인 안내, 본인 예약 복귀, 익명/USER/ADMIN 경로, 로그아웃·새로고침, 예약 조건/객실 복구, state 없는 로컬 콜백과 URL fragment 제거를 점검합니다. |
| DOM/HTTP Mock | `AuthenticationFlow.integration.test.tsx`와 Callback/Client/AuthProvider Suite는 Provider 취소/실패·유실/불일치 state·복귀·무재전송을 검증합니다. |

브라우저 수동 점검은 익명 `/reservations` 또는 `/admin` 직접 진입부터 시작합니다.
USER는 본인 예약으로 돌아오지만 ADMIN 전용 경로는 차단되며, ADMIN은 관리자 화면에 진입합니다.
보호 화면 새로고침은 메모리 토큰을 복원하지 않습니다. 공개 검색으로 돌아가거나 예약 복귀 URL을
확인할 때는 날짜·인원·카탈로그 ID만 유지하고, 투숙객 입력이나 토큰은 포함하지 않습니다.
실제 Google Provider 왕복은 이번 검증에서 제외했습니다. 전용 테스트 Client·계정 및 등록된 Backend callback을
준비하는 별도 검증이 필요하며, 로컬 교환이나 Mock 통과를 Provider 성공으로 기록하지 않습니다.
