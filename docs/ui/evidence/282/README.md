# #282 Browser 비교 캡처

2026-11-05, `1440×900` / `390×844` CSS Viewport. 비교 시작점은 `scrollY=0`이다.
IAB 내보내기 래스터는 스크롤바/표시 영역 때문에 CSS Viewport 수치보다 작을 수 있다.
로그인, 가입, 가입 완료, 콜백 오류, 403/404는 Viewport와 전체를 모두 보관했다.
실제 Browser의 로컬 Fixture 화면이며 실계정·실예약·실제 Google 응답은 아니다.

| 비교 | 1440 Viewport / 전체 | 390 Viewport / 전체 |
| --- | --- | --- |
| 독립 A1 원본 (Auth 전용 아님) | [Viewport](reference-a1-1440.jpg) · [#277 전체 원본](../277/reference-full-1440.jpg) | [Viewport](reference-a1-390.jpg) · [#277 전체 원본](../277/reference-full-390.jpg) |
| 변경 전 로그인, #281 병합 기준 | [전체](before-login-1440-full.jpg) | [전체](before-login-390-full.jpg) |
| 로그인 | [Viewport](login-1440.jpg) · [전체](login-1440-full.jpg) | [Viewport](login-390.jpg) · [전체](login-390-full.jpg) |
| 가입 | [Viewport](signup-1440.jpg) · [전체](signup-1440-full.jpg) | [Viewport](signup-390.jpg) · [전체](signup-390-full.jpg) |
| 가입 완료·원래 숙소 복귀 | [Viewport](signup-success-1440.jpg) · [전체](signup-success-1440-full.jpg) | [Viewport](signup-success-390.jpg) · [전체](signup-success-390-full.jpg) |
| 로그인 실패 (`AUTH_003`) | [Viewport](login-error-1440.jpg) | [Viewport](login-error-390.jpg) |
| Google 교환 대기 | [Viewport](callback-pending-1440.jpg) | [Viewport](callback-pending-390.jpg) |
| Google 교환 실패·복귀 | [Viewport](callback-error-1440.jpg) · [전체](callback-error-1440-full.jpg) | [Viewport](callback-error-390.jpg) · [전체](callback-error-390-full.jpg) |
| 검증되지 않은 Callback 직접 접근 | [Viewport](callback-invalid-1440.jpg) | [Viewport](callback-invalid-390.jpg) |
| USER → Admin 접근 거절 | [Viewport](forbidden-1440.jpg) · [전체](forbidden-1440-full.jpg) | [Viewport](forbidden-390.jpg) · [전체](forbidden-390-full.jpg) |
| 없는 경로 | [Viewport](not-found-1440.jpg) · [전체](not-found-1440-full.jpg) | [Viewport](not-found-390.jpg) · [전체](not-found-390-full.jpg) |

원본 A1 캡처에서 Studio 도구바와 상태 시연 UI는 제외했다. 독립 원본의 사진·가격은 [가상 콘셉트](../../prototypes/premium-travel/ASSETS.md)다.
Search/Detail의 [승인 원본 보드](../../prototypes/premium-travel/review.html)는 탐색 복귀의 시각 기준이며 별도 Auth 원본이 아니다.

- 키보드: 제목 → 이메일 → 비밀번호 → 이메일 로그인 → [Google 포커스](login-google-focus-390.jpg).
  [빈 제출 오류](login-validation-390.jpg), [320×568 글자 200%](login-320-text200-submit-focus.jpg),
  [390×400 가입 버튼](signup-390-low-height-focus.jpg). 고정 요소로 필드나 포커스를 덮지 않는다.
- 복귀: 가입 완료에서 `보던 숙소로 돌아가기`를 Enter로 열어, 서울 호텔의 [사진 정상](return-media-present-390.jpg),
  [미제공](return-media-missing-390.jpg), [로드 실패](return-media-failed-390.jpg)를 비교했다. Auth에 매물 사진은 없다.
  실제 계약과 동일한 Media 필드에 가상 콘셉트 이미지 또는 누락/실패를 주입했으며 개발 DB에 저장하지 않았다.
- [Audit 재현](../../../../frontend/scripts/ui-audit/README.md): `auth=signup-success|login-error|callback-pending|callback-error`,
  `path=/login|/signup|/oauth2/callback|/admin|/missing` 및 `role=USER`/`textScale=200`. 403의 숙소 둘러보기와 404의 홈 이동을 실제 Router에서 확인했다.

[구현·검증 보고서](../../frontend-authentication-rebuild-282.md)
