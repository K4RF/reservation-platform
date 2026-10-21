# Authentication UI (#227)

## 적용 범위

2026-10-21(Asia/Tokyo), #226이 병합된 `develop` (`d0a98fa`)에서 작업했다.
Login/Signup/OAuth2Callback의 **배치·안내·시각적 Feedback**만 개선했다.
API, Token Pair 저장, OAuth2 State/Code 교환, Role, 401 정책, Login Return 처리와 검증 함수는 변경하지 않았다.

| 대상 | 적용 내용 / 판단 |
| --- | --- |
| Container | 세 화면에 `.auth-page`와 기존 Token 기반 Surface·28rem 최대 폭·모바일 Padding 적용. Callback도 같은 인증 카드 사용 |
| Title / Description | 기존 Heading Level·문구 유지, `.auth-header`의 왼쪽 정렬·일관된 간격·구분선. Section은 제목 ID로 이름 부여 |
| Label / Input | #226 공통 44px Control·Focus·aria-invalid 유지. Form 간격은 인증 영역에만 조정 |
| Email | email Input Mode, 대문자 자동 변환·맞춤법 검사 비활성화. 입력값/Trim/검증/요청 형식은 기존 그대로 |
| Password | 기본 password 마스킹·current-password/new-password 자동완성 유지. Login은 기존 비밀번호 안내, Signup은 기존 validateSignUp의 8–72자 기준 안내. Hint와 오류 ID를 aria-describedby로 함께 연결 |
| 비밀번호 사용성 검토 | 표시/숨기기·확인 입력·비밀번호 재설정·새 복잡도 규칙을 추가하지 않음. 기본 노출을 늘리지 않고 기존 입력/검증 계약 유지 |
| Submit / Google | #226 Primary/Secondary와 같은 폭·높이·중앙 정렬 유지. 실제 pending을 Submit aria-busy에 연결하고 기존 disabled/중복 제출 Guard 유지 |
| Google Icon | 현재 별도 Icon이 없음을 확인. 텍스트형 버튼을 유지하며 임의 Google 마크·원격 이미지·새 Asset/Dependency를 추가하지 않음. Email/Google 사이 장식 구분선만 추가 |
| 이동 Link | Signup/Login 하단 Link의 간격·44px 최소 클릭 높이·줄바꿈 정리. Callback 복귀 Link도 같은 계열. 목적 경로와 state 전달은 변경하지 않음 |
| Field / Authentication Error | 인증 영역의 role=alert에 Error Surface/테두리/텍스트 적용. ErrorState 내부 문단도 색을 상속하며 중첩 Box를 만들지 않음. ID/role/메시지/오류 분류 유지 |
| Loading / Success | 기존 role=status는 중립 안내 Surface, 알려진 Logout 성공만 Success 색. 모든 status를 인증 성공으로 해석하지 않음. 기존 LoadingState 텍스트와 처리 시점 유지 |

새 Theme/UI Library, Token 값, Modal, 인증 상태 공유 구조나 영속 저장을 만들지 않았다.
비밀번호·투숙객 정보·Token을 URL이나 로그에 추가하지 않았다. Google 시작 함수/콜백 Effect 및
Form Handler는 그대로이고, 변경은 표시용 Markup·속성·안내·인증에 한정된 CSS다.
Signup 성공의 기존 Home 이동, 이메일/Google 로그인 후 안전한 Return 경로와 재검증도 유지한다.

## 검증

- 기존 LoginPage/SignUpPage/OAuth2CallbackPage 테스트에 카드·Form 이름, 마스킹/자동완성,
  Hint+오류 연결, pending aria-busy를 추가 검증했다. 기존 성공/실패·중복 요청·복귀 경로 테스트는 유지했다.
- Callback working 상태의 카드/Feedback 및 교환 전 미인증 상태를 검증하는 테스트 1건 추가.
  StrictMode에서도 Code 교환은 한 번만 호출하며 기존 State 검증·URL 정리/Return 소비는 그대로다.
- `pnpm install --frozen-lockfile --offline`, `pnpm lint`, `pnpm format:check`, `pnpm typecheck`,
  `pnpm test`, `pnpm build`: 통과. **71 files / 983 tests**, 운영 빌드132개 Module.
- `pnpm exec tsc -p scripts/ui-audit/tsconfig.json`: 통과.
- Dependency/Lockfile/Vite/환경변수/실행 명령/GitHub Actions 변경 없음. 기존 Frontend CI와 같은 검사 명령 실행.
  로컬 Node24.14.0/pnpm11.19.0과 원격 Ubuntu/Node24.19.0은 동일 환경이 아니다.
  이번 요청은 로컬 커밋까지이며 원격 CI 성공을 주장하지 않는다. Backend 전체 테스트는 실행하지 않았다.

## Browser 증거와 미확인 범위

기존 [읽기 전용 Audit 도구](../../frontend/scripts/ui-audit/README.md)로 1440×1000 / 390×844의
Login/Signup/무효 Callback과 빈 입력 오류, 일부 320×844 / 768×1024 경계를 확인했다.
[측정 원본](evidence/227/measurements.json)에 **10개 측정 / 대표 이미지 8장**을 보존했다.
사진은 실제 가시 영역이며 이미지 출력 크기보다 DOM 뷰포트/폭 값을 비교 기준으로 삼는다.

- Desktop 인증 카드448px, Login·Google Button 높이 모두44px. Mobile에서는 가용 폭에 맞춰 줄바꿈.
- 측정한 390px/768px 문서의 scrollWidth=clientWidth. 320px의 기존 body 최소 폭/스크롤바에 의한
  문서15px 넘침은 여전히 남으며 #231 범위다. 인증 화면 CSS로 전체 페이지 Overflow를 숨기지 않았다.
- 빈 입력만 제출해 기존 Client Validation을 실행했다. 빨간 Field Border·별도 오류 Surface,
  안내 텍스트와 오류 연결·Tab Focus를 확인했다. 실제 이메일/비밀번호/계정은 사용하지 않았다.
- Browser Callback 증거는 예상 State가 없는 **invalid** 상태다. Working/취소/교환 실패/정상 로그인과
  Return/Token 검증은 기존 Mock 테스트 경계이며 실제 Provider E2E나 Backend 인증 성공을 증명하지 않는다.
- Google 버튼의 외부 이동·실제 Signup/Login·DB/Redis는 실행하지 않았다. 전체 대비·Keyboard·Zoom·실기기,
  비밀번호 관리자/모바일 키보드의 실제 동작, 모든 상태의 시각적 승인은 별도 확인 대상이다.

대표 화면: [Desktop Login](evidence/227/login-desktop.jpg), [Mobile Login](evidence/227/login-mobile.jpg),
[Mobile 오류](evidence/227/login-errors-mobile.jpg), [Signup](evidence/227/signup-mobile.jpg),
[Callback](evidence/227/oauth-invalid-mobile.jpg).

인증 밖의 공통 Loading/Error/Empty 마감과 전체 반응형/접근성은 #231, 전체 회귀는 #232,
실제 통합·Google E2E·사용자 최종 디자인 승인은 f0.6.0에 남긴다. 새 수동 검수 Issue는 생성하지 않았다.
