# 인증·접근 안내 재구성 (#282)

검증일: 2026-11-05. #281이 병합된 `develop` (`0834192`, PR #295)에서 작업했다.
[승인 기준](approved-design.md), [#271 구성안](prototype-rebuild.md), [#274 프레임](frontend-consumer-frame-274.md),
[#258 선행 화면](frontend-authentication-redesign-258.md), [인증 수명주기](../testing/frontend-authentication-flow.md) 및 관련 소스/테스트를 비교했다.
독립 [동작 시안](prototypes/premium-travel/index.html)과 [1440/390 비교 보드](prototypes/premium-travel/review.html)를 Browser에서 열었다.
Auth 전용 승인 원본은 없다. 아래는 A1/Navy & Ivory의 브랜드·서체·여백·명확한 CTA를 #271 인증 구성에 적용한 개발자 검증이다.

## 화면과 동작

| 상태 | 이전 | #282 |
| --- | --- | --- |
| 로그인·가입 | 약 1120px 카드에 큰 Navy 안내와 폼, Mobile 아래에도 브랜드 안내 반복 | Desktop 최대 960px 내 제목·목적과 최대 420px 입력 패널. Mobile 한 열로 제목 → 입력 → 이메일/Google → 실제 다음 행동. 익명 Header는 공통 브랜드만 유지 |
| 가입 완료 | 홈으로 이동한 뒤 하단 성공 안내 | 로그인 폼에서 바로 완료 안내와 다음 행동. 원래 `from` 보존, 이메일/비밀번호 전달 또는 자동 로그인 없음 |
| 로그인 오류·인증 만료 | 일반 기술 설명과 입력 주변에 안내 | 필드·서버 오류는 해당 입력/제출 위치에 유지. 인증 만료와 로그아웃 안내는 해당 상태에만 표시 |
| Google | 큰 공통 소개 카드에 대기/결과 | 대기와 실패를 짧은 상태 패널로 표시. 실패 시 로그인으로 돌아가거나 원래 공개 목적지로 이동. 진행 중 교환을 다시 요청하는 버튼 없음 |
| 403·404 | 로그인과 같은 정보량의 공통 카드 | 403은 현재 계정의 접근 안내와 숙소 탐색, 404는 주소 오류 안내와 홈 이동이 우선. 기존 Role 검사/라우팅과 공통 Header 유지 |

`AuthPageLayout`은 화면·제목 포커스만 소유한다. `RootLayout`은 기존 Auth/Logout과 공통 Header를 유지하며 익명 인증 진입 화면에만 브랜드형 Header를 선택한다.
인증 화면의 직접 승인 Hero·검색·Gallery는 없으므로 Home 사진/검색이나 Detail 사진·가격·가상 매물을 인증에 추가하지 않았다.
상시 메모리 안내는 문서에 두고, 필수 입력·서버 오류·만료·로그아웃 미확인 메시지는 보존했다.
미지원 비밀번호 찾기, 소셜 Provider, 약관 링크도 만들지 않았다.

## 복귀와 인증 경계

- 기존 `safeLoginReturn`으로 검증된 경로를 Login ↔ Signup 및 가입 완료 이동의 Router state로 전달한다. 공개 복귀는 검증된 검색/숙소로, 보호 경로에서는 공개 숙소 목록으로 이동한다.
- 이메일 로그인과 Google 성공은 각각 기존 이동 경로를 사용한다. Google만 기존 일회성 `sessionStorage` return/state를 사용한다. Callback은 기존 state 확인·fragment 정리·StrictMode 단일 교환을 유지한다.
- 날짜·인원·객실/숙소 ID·원래 검색 조건은 기존 계약 범위에서만 보존한다. 비밀번호·투숙객 데이터·Token을 URL이나 영속 Storage에 추가하지 않는다.
- 로그인 뒤에는 새 가용성 GET을 거쳐 객실 선택 힌트만 복원한다. Booking 시작·예약 제출은 여전히 명시적이며 자동 재실행하지 않는다.
- AuthProvider, 메모리 Token Pair, 새로고침 후 인증 미복원, single-flight 재발급, ProtectedRoute, Role/소유권, Backend 인증과 HTTP 오류 계약은 바꾸지 않았다.

## Browser 및 자동 검증

[캡처와 재현 조건](evidence/282/README.md). 로컬 Audit에서 실제 React/CSS를 1440×900/390×844 CSS Viewport로 렌더링했다.
로그인 Header는 이전 약 94/72px에서 약 61/61px로 작아졌다. 이메일 입력 상단은 347/289px에서 195/269px로 이동했고,
Mobile 입력 폭은 289 → 331px로 넓어졌다. Desktop 입력 패널은 420px, 내부 입력은 370px이다. 정상 Mobile에서 이메일 로그인/Google 버튼은 첫 Viewport 안에 들어온다.
320px·글자 200%에서 Login/Signup/403/404 문서 가로 폭은 305px였다. 폼은 일반 스크롤로, Tab 이동 시 제출 버튼은 화면 안에서 보였다.
390×400에서도 가입 버튼의 포커스가 노출됐다. 콜백 복귀는 키보드 Enter로 확인했다. 실기기 키보드/Native Zoom/Screen Reader 검증은 아니다.

기존 `AuthenticationFlow`, `BookingCreationFlow`, Login/Signup/Callback 및 Router/Header 테스트를 보완했다.
검색 → 상세 → Login ↔ Signup → 가입 완료 → 명시적 이메일 로그인 → fresh Availability → 명시적 예약으로 연결하고,
이전 검색/예약 조건과 자격정보·투숙객/Token 비저장, 가입 후 빈 로그인 필드, Callback 실패 후 같은 복귀 링크와 제목 포커스를 확인했다.

Windows Node 24.14.0 / pnpm 11.19.0, `frontend/`에서 `pnpm install --frozen-lockfile`, `pnpm lint`,
`pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm exec tsc -p scripts/ui-audit/tsconfig.json`,
`node --check scripts/ui-audit/server.mjs`를 실행했다. 관련 10개 파일/140개, 전체 **80개 파일/1,174개 테스트**가 통과했다.

Backend/API·의존성·환경변수·Workflow 변경은 없다. Windows에서 CI와 같은 Frontend 검사 명령을 실행했지만
GitHub Actions Ubuntu Runner(Node 24.19.0) 및 실제 Backend/Redis/Google 왕복은 미실행이다.
Audit의 403/404는 Router 화면이고 합성 401/대기는 실제 Google/Backend 응답이 아니다. 데이터/계정을 만들거나 수정하지 않았다.
실제 HTTP·장치별 통합 검증 및 f0.6.0 사용자 승인/이슈 종료는 별도다.
