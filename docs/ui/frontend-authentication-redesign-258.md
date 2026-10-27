# Authentication 리디자인 — #258

검증일: 2026-10-28. develop `9950bff`(PR #267)에서
`feature/#258-authentication-redesign` 생성. 선행 #252가 포함된 기준이다.
개발자 구현/검증 기록이며 사용자 최종 UI/UX 승인 기록이 아니다.

## 참조와 의도적 차이

[승인 기준](approved-design.md), [시안 README](prototypes/premium-travel/README.md),
[독립 index](prototypes/premium-travel/index.html)와 [비교 보드](prototypes/premium-travel/review.html)를 읽고
Browser에서 A1/index와 review를 열었다. A1·Navy & Ivory, Search/Detail 공통 Token·여백·구분선과
로컬 영문 Display Serif/한글 UI Sans를 확장했다. 인증 화면 자체의 직접 승인 시안은 없다.
f0.5.2(Milestone #19, 이전 이름 f0.5.3) 범위이며 새 영문 카피까지 승인된 것으로 취급하지 않는다.

- 순수 표현 Component `AuthPageLayout`을 Login/Signup/Google Callback/Forbidden/NotFound에 적용했다.
  제목 ID·설명·페이지별 피드백/동작은 caller가 소유한다. Hook/인증/요청/Storage 처리는 없다.
- Desktop은 Navy 브랜드 안내와 Surface 입력/결과 패널 2열이다. 전체 폭은 wide,
  실제 입력 패널은 auth Token으로 제한한다. 48rem 이하에서는 입력/오류 패널이 먼저, 브랜드 안내가 뒤인 1열이다.
  DOM도 입력/피드백→공개 탐색 안내 순서다. Desktop의 왼쪽 안내는 보조 정보이며 키보드는 주요 작업부터 진행한다.
- 작은 Eyebrow·현재 화면 제목/설명·Form·Google/복귀 Link·보조 안내를 구분한다.
  Google 버튼의 기존 Accessible Name은 유지하고 외부 인증 화면 이동을 aria-describedby로 안내한다.
- Signup 성공이 자동 로그인은 아니라는 안내, Login의 메모리 인증/새로고침 재로그인 안내를 추가했다.
  없는 경로는 잘못된 주소를 재출력하지 않고 홈/공개 탐색 링크를 제공한다.
  접근 거절은 원래 역할 오류를 유지한다. 실제 HTTP 403/404 응답을 새로 구현한 것은 아니다.
- **시안과 다른 점:** Auth 전용 사진/가상 매물/추가 Google 로고·외부 Font·새 Modal은 없다.
  승인 시안의 큰 사진 Hero를 폼에 복사하지 않고 단색 Navy 안내로 집중도를 유지한다.
  고정/Sticky CTA나 문서 overflow 숨김 없이 자연스럽게 스크롤한다.
- Navy 안내 링크에는 밝은 Focus Ring을 사용한다. 24rem 이하에서는 입력 패널/버튼 안쪽 여백을 줄여
  320px·글자 200%에서 로그인 버튼의 불필요한 줄바꿈을 해소했다.

## 인증 Lifecycle 경계

[기존 Auth Flow](../testing/frontend-authentication-flow.md), 소스와 기존 테스트를 확인했다.

- LoginForm/SignUpForm의 Validation, 서버/필드 Error, pending/단일 제출 Gate, Native email/current-password/new-password,
  Label·마스킹·힌트/aria-invalid·에러 연결을 그대로 재사용한다. 비밀번호 보기/영속 보관 기능은 추가하지 않았다.
- AuthProvider, 메모리 Token Pair, single-flight 재발급, Role Hint, Logout, 401 처리와 ProtectedRoute는 변경하지 않았다.
  Backend가 서명·인가의 최종 경계다. 프로필/지속 인증 복원을 새로 약속하지 않는다.
- Login의 safeLoginReturn·Google 임시 return/state·외부 이동·Callback 코드 교환/Hash 정리와
  StrictMode 단일 교환 로직은 그대로다. Callback의 working/cancelled/failed/invalid/exchange_failed를 유지한다.
- 로그인 복귀의 검색/객실 Hint는 기존 계약을 따르며 투숙객/Token을 URL에 추가하지 않는다.
  복귀 후 Availability를 새로 확인하고 예약 생성/변경/취소를 자동 재전송하지 않는다.
- Forbidden/NotFound는 표현만 변경했다. 역할을 바꾸거나 ADMIN 메뉴/API를 우회하지 않는다.
  공개 탐색 링크는 기존 `/accommodations`만 사용한다.

## 자동 검증

Windows Node 24.14.0 / pnpm 11.19.0, `frontend/`에서 실행했다.

```shell
pnpm install --frozen-lockfile --offline
pnpm test src/pages/LoginPage.test.tsx src/pages/SignUpPage.test.tsx src/pages/OAuth2CallbackPage.test.tsx src/app/protectedRoutes.test.tsx src/app/routes.test.tsx src/test/AuthenticationFlow.integration.test.tsx src/test/BookingCreationFlow.integration.test.tsx src/test/designTokens.test.ts
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
pnpm exec tsc -p scripts/ui-audit/tsconfig.json
```

관련 8 files / 97 tests, 전체 **76 files / 1,098 tests 통과**. 나머지 검사/빌드 성공.
기존 6개 파일의 테스트를 보완하고 CSS 계약 1건을 추가했다. 새 lifecycle Suite는 복제하지 않았다.

- Login/Signup/Callback 기존 Suite: Native 입력, Validation/중복/서버 Error·Loading·성공/취소/교환 실패,
  안내와 공개 탐색 링크/Google 설명 연결.
- Router/Guard Suite: 전역 Header 1개, 없는 경로/홈 복귀, 역할 거절의 공통 Container.
- 기존 AuthenticationFlow/Client/Provider/SessionReload Suite: Logout/인증 만료/401 single-flight,
  USER/ADMIN Guard·새 세션 경합·영속 인증 미복원. 기존 BookingCreationFlow는 Login Return과 가용성 재검증을 검증한다.
- 초기 검사에서 중첩 Auth Header가 Testing Library에 두 번째 banner로 노출됐다.
  공통 내부 제목을 div/h1으로 정리해 전역 Header 1개를 유지했다. 변경된 Display/역상 Focus 역할의
  CSS 계약도 명시적으로 갱신했다. 테스트를 disable/삭제하지 않았다.

Backend/DB/API/의존성/환경변수는 변경하지 않았으며 Backend test/build·실제 HTTP 통합은 이번에 실행하지 않았다.

## 실제 Browser 관찰

[기존 읽기 Audit](../../frontend/scripts/ui-audit/README.md)의 AppRoutes/AuthProvider/Component/CSS를 사용했다.
API Proxy가 없고 쓰기는 405로 차단한다. 실제 계정/비밀값을 입력하거나 Google 버튼/코드 교환을 실행하지 않았다.
빈 Login/Signup 제출은 로컬 Validation만 확인했다. Callback은 code/state 없는 직접 접근의 invalid 상태다.
USER Hint는 서명 없는 Fixture이며 실제 Backend 인증을 의미하지 않는다.

| Route / 조건 | 관찰 |
|---|---|
| `/login`, 1440×1000 | 안내/입력 약 530/588px의 2열, 문서 1425≤1440. Submit/Google/가입 Link·메모리 안내 구분 |
| `/login`, 390×844 | 입력이 먼저인 1열, 문서 375≤390, 이메일 top 약 401px. 브랜드가 입력을 밀어내지 않음 |
| `/signup`, 양쪽 폭 | 같은 Container와 Native new-password. 빈 제출의 이메일/비밀번호 Error·힌트 연결 유지 |
| `/oauth2/callback`, 양쪽 폭 | invalid Error와 Login 복귀 Link. 복귀 후 Login Form 확인. 외부 Google 화면은 열지 않음 |
| USER `/admin`, 양쪽 폭 | 역할 거절 Alert·홈/공개 탐색 Link. Admin 내용 없음 |
| `/missing`, 양쪽 폭 | 없는 경로 제목과 홈/공개 탐색 Link. 홈 Link의 실제 Router 이동 확인 |
| 320×844 / 글자 200% | root 32px, Login/Signup/Forbidden 모두 문서 305≤320. Login 버튼 191px 폭, top 652 / bottom 740 < 844 |
| Login 768/1024/1440, 글자 200% | 문서 753/1009/1425, 1/2/2열. 긴 안내/브랜드 카피도 줄바꿈하며 가로 넘침 없음 |

Tab은 email→password→Login→Google 순서이며 비밀번호 type/autocomplete를 확인했다.
Google 버튼의 설명 연결과 공개 탐색 링크의 흰색 Focus Ring/Viewport 내 표시를 확인했다.
확대된 권한 거절 화면의 공개 링크도 키보드 접근 가능했다. 관찰된 Console warning/error는 없었다.
`textScale=200`은 Audit 글자/rem Reflow이며 Native Zoom/OS 배율/실기기 키보드 검증과 동일하지 않다.

캡처는 실제 뷰포트 기준이다. 검토 중 잘못 저장된 모바일 전체 페이지 캡처를 발견해
Login/Signup/Forbidden/NotFound의 390px 이미지와 관련 Validation/Focus를 재촬영·교체했다.

캡처: [Login 1440](evidence/258/login-1440.png) / [390](evidence/258/login-390.png) /
[Validation](evidence/258/login-validation-390.png) / [320·200%](evidence/258/login-320-text200.png),
[Signup 1440](evidence/258/signup-1440.png) / [390](evidence/258/signup-390.png) /
[Validation](evidence/258/signup-validation-390.png),
[Callback invalid 1440](evidence/258/callback-invalid-1440.png) / [390](evidence/258/callback-invalid-390.png),
[역상 Focus](evidence/258/public-link-focus-390.png),
[권한 거절 1440](evidence/258/forbidden-1440.png) / [390](evidence/258/forbidden-390.png) /
[320·200% 링크](evidence/258/forbidden-320-text200.png),
[없는 경로 1440](evidence/258/not-found-1440.png) / [390](evidence/258/not-found-390.png).

## CI와 남은 검증

의존성·Lockfile·환경변수·실행/Workflow 설정 변경은 없다. CI의 frozen install → lint → format →
typecheck → test → build를 로컬에서 통과했다. CI Ubuntu Node 24.19.0과 Windows 로컬 환경은 구분한다.
선행 PR #267의 [Frontend CI](https://github.com/K4RF/reservation-platform/actions/runs/40570517370)와
[Backend CI](https://github.com/K4RF/reservation-platform/actions/runs/40570517105)는 성공을 확인했다.
이번 #258 브랜치는 로컬 커밋까지만 수행하여 **원격 CI 미실행**이다.

실제 Google 성공/취소·Backend/Redis·새로고침/재발급 E2E, 실제 자동완성/비밀번호 관리자·모바일 키보드,
타 Browser/실기기·Native Zoom·Screen Reader와 최종 사용자 직접 UI/UX 승인/마지막 REVIEW는 f0.6.0에 남는다.
Callback working·서버 로그인 오류·Logout·인증 만료·401·Return 재검증의 이번 증거는 자동 Mock Suite이며
Browser 실연동 증거와 구분한다. 새로고침 지속 인증은 여전히 미구현이다.
