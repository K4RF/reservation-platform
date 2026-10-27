# Booking Form / Summary / 완료 화면 — #256

검증일: 2026-10-28. 최신 develop `dcd1bfc`(PR #265)에서
`feature/#256-booking-redesign` 생성. 선행 #252와 #255가 포함된 기준이다.
개발자 구현/검증 기록이며 최종 사용자 UI/UX 승인 기록이 아니다.

## 참조와 의도적 차이

[승인 기준](approved-design.md), [독립 시안](prototypes/premium-travel/index.html)과
[비교 보드](prototypes/premium-travel/review.html)를 읽고 Browser에서 열었다.
[Detail 1440px](prototypes/premium-travel/screenshots/detail-1440.png) /
[390px](prototypes/premium-travel/screenshots/detail-390.png)을 현재 화면과 비교했다.
Booking 전체의 직접 승인 시안은 없으므로 A1/Search/Detail의 Navy & Ivory, 얇은 구분선,
여백과 정보 계층, Navy CTA를 확장했다. f0.5.2(Milestone #19, 과거 이름 f0.5.3) 범위다.

- `BookingFlow`: 투숙객 입력 → 최종 확인을 `aria-current=step`으로 구분한다.
  입력 확인은 POST가 아니며, 실제 예약 생성은 기존 버튼의 명시적 요청이다.
- 로그인한 사용자에게 BookingFlow가 표시되면 객실 비교 아래 넓은 선택 패널을 사용한다.
  요약/날짜별 가격과 투숙객 입력/확인은 Desktop 2열, 64rem 이하 1열이다.
  익명 요약/로그인 진입은 #255의 목록 옆 패널 배치를 유지한다.
  이는 #255 당시 기록의 로그인 후 좁은 사이드 패널을 이번 범위에서 확장한 것이다.
- `BookingSummary`: 객실/정원/전체 인원, `[체크인, 체크아웃)`, 기본 1박 가격,
  날짜별 적용 요금, 예상 합계와 주의사항을 묶는다. 가격 조회/합산 코드는 변경하지 않았다.
- 완료 화면은 상태 → 저장 ID/Number/객실/기간/전체 인원 → 서버 저장 금액 → 저장 투숙객 → 다음 단계다.
  넓은 화면에서 정보/금액 2열, 48rem 이하 1열이며 본문은 기존 wide Token, Header는 result Token을 쓴다.
  내 예약 목록은 Navy 주요 링크다. Loading/Error에서는 저장 결과 카드를 표시하지 않는다.
- **시안과 다른 점:** Booking 전용 사진·미디어·고정 CTA·새 Route/Modal을 추가하지 않았다.
  긴 요금표·오류·입력·확대 글자의 Focus를 가리지 않도록 CTA와 패널은 static 문서 흐름이다.
  24rem 이하 확인 패널의 여백을 줄여 확대 상태의 버튼이 한 글자씩 세로로 쌓이는 문제를 완화했다.
- 확인 전환 시 제목에 Focus, 수정 전환 시 보존된 이름 입력에 Focus를 돌려준다.
  최초 표시/요금 응답 때 Focus를 강제로 가져오지 않으며 전환 외 요청·상태를 추가하지 않는다.

## 데이터 / Auth / 쓰기 경계

기존 Booking reducer, Validation, selection key, Booking Context, RoomAvailability 상태,
가격 API, createReservation, bookingFailure, useDetailQuery, ProtectedRoute를 재사용한다.
BookingSubmit 변경은 class/설명 표현뿐이며 제출·잠금·오류 분류 로직은 변경하지 않았다.

- 요약은 현재 Backend 날짜별 요금 GET의 예상 합계다. 기본 1박 가격과 구분하며 보장 금액이 아니다.
  가격 실패 때 부분 합계/클라이언트 기본가 fallback을 만들지 않는다.
- 완료는 생성 결과의 서버 ID로 소유자 GET을 수행한다. URL/Navigation State/직전 예상 요금을 결과로 사용하지 않는다.
  응답 status가 CANCELLED이면 취소로 표시한다. 과거 null Number/Guest는 미등록/미제공으로 유지한다.
  완료 GET의 totalAmount를 표시하며 현재 가격으로 재계산하지 않는다. 결제 완료를 주장하지 않는다.
- 통화·세금·할인·추가 수수료·사진·Bed/Size/View·정책 값을 발명하지 않았다.
  완료 화면의 현재 read projection 밖 per-night/취소 결과는 새로 복제하지 않는다.
- 로그인 복귀 후 Availability 재조회, 가용성 없는 객실 미복원, 날짜/인원/객실 변경 시
  선택·요금·투숙객·확인 상태 초기화, 정보 수정 시 값 보존을 유지한다.
  투숙객/Token을 URL/영속 저장소에 넣지 않는다.
- 단일 POST Gate, pending 중 수정/중복 제출 차단, 401/Network/잘못된 Response/5xx의
  자동 POST 재실행 금지와 불명확 결과 잠금을 유지한다. 완료 재조회는 GET만 사용한다.
  기존 `503 INVENTORY_013`의 수동 재시도 분류는 변경하지 않았다. Commit 후 unlock 실패도 가능하므로
  서버 멱등성/직접 재시도 정책은 기존 README의 후속 안전성 검토 사항으로 남는다.

## 자동 검증

Windows, Node 24.14.0 / pnpm 11.19.0, `frontend/`에서 실행했다.

```shell
pnpm install --frozen-lockfile --offline
pnpm test src/components/booking src/pages/BookingCompletePage.test.tsx src/test/BookingCreationFlow.integration.test.tsx src/test/designTokens.test.ts
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
pnpm exec tsc -p scripts/ui-audit/tsconfig.json
```

- 관련 7 files / 87 tests, 전체 **76 files / 1,096 tests 통과**, 나머지 명령 모두 성공.
- 기존 BookingFlow/Summary/Complete Suite를 보완했다. 단계/Focus 왕복, 예상·저장 금액 영역,
  null 과거 응답, CTA/반응형 CSS 계약을 검증한다. 새 lifecycle Suite를 중복 생성하지 않았다.
- 기존 BookingCreationFlow는 로그인 복귀/가용성 초기화, 입력 보존, 혼합 DAILY/DEFAULT 예상 합계와
  다른 서버 Snapshot, 단일 POST, pending Gate, 불명확 실패, Back/Forward 결과 재조회 등을 검증한다.
  BookingSubmit/API 세부 Suite의 401/Response/5xx 잠금도 재사용한다.
- 개발 중 폭 Token 계약·단일 테스트 포맷 검사 실패를 수정한 뒤 전체 검사를 다시 통과했다.
  테스트 disable/삭제와 Backend/DB/Auth/가격 규칙 변경은 없다. Backend test/build는 이번에 실행하지 않았다.

## 실제 Browser 관찰

[기존 읽기 Audit](../../frontend/scripts/ui-audit/README.md)의 실제 AppRoutes/AuthProvider/Component/CSS,
가상 USER Hint와 Fixture GET을 사용했다. 쓰기는 405, 실제 Backend Proxy는 없다.
대표 투숙객 입력에는 가짜 값만 사용하고 **예약 생성은 클릭하지 않았다**.

- 입력 Route: `/accommodations/7?checkInDate=2030-01-01&checkOutDate=2030-01-03&guestCount=2&roomId=3`
- 완료 Route: `/reservations/42/complete`; Navigation State 없이 직접 진입.
- Audit 옵션: `role=USER`, `scenario=ready/cancelled/error/stress`, `textScale=200`.

| 조건 | 관찰 |
|---|---|
| 1440×1000 입력/확인 | 문서 scrollWidth 1425, 요약/입력 599px씩 2열, 가격 client/scroll 599/599 |
| 390×844 입력/확인 | 문서 375, 1열, 가격 309/400의 내부 스크롤. Validation 3개 오류와 입력/수정 값 보존 |
| 1440×1000 완료 | 문서 1425, 저장 정보/금액 2열. 서버 ID/Number·350.25 Snapshot·투숙객 표시 |
| 390×844 완료 | 문서 375, 1열. 긴 Number 줄바꿈, 다음 단계 링크 Tab 접근 |
| 320×844, stress + 200% | 문서 305, root 32px. 긴 이름/이메일·큰 금액에도 문서 overflow 없음. 가격 175/800 내부 스크롤 |
| 768/1024/1440, stress + 200% | 문서 753/1009/1425, 입력 Grid 1/1/2열, 가로 넘침 없음 |

확인 제목 Focus는 Mobile top 약 24px, 수정 후 이름 Focus와 값 유지.
320px/200%에서도 Tab으로 예약 생성 버튼에 도달하고 최종 버튼 top 531 / bottom 668 < height 844였다.
글자를 생략/문서 overflow 숨김으로 해결하지 않았다. 인원 2→3 편집은 가용 목록/선택/Booking 전체를 제거했다.
취소 Fixture는 취소 제목/의미색, 결과 Error는 성공 카드 없이 안내/GET 재조회만 표시했다.
익명 완료 URL은 Login으로 보내며 익명 Detail에는 투숙객 Form이 없다. 관찰된 Console warning/error는 없었다.

캡처: [입력 1440](evidence/256/input-1440.png) / [390](evidence/256/input-390.png),
[오류 1440](evidence/256/input-errors-1440.png) / [390](evidence/256/input-errors-390.png),
[확인 1440](evidence/256/review-1440.png) / [390](evidence/256/review-390.png) /
[320·200%](evidence/256/review-320-text200.png),
[완료 1440](evidence/256/complete-1440.png) / [390 전체](evidence/256/complete-390.png) /
[320·200% 다음 단계](evidence/256/complete-320-text200.png),
[취소](evidence/256/cancelled-390.png) / [결과 조회 실패](evidence/256/result-error-390.png).
모두 가상 Fixture이며 실제 예약/매물 증거가 아니다.

## CI와 남은 검증

의존성/Lockfile/환경변수/실행 설정/Workflow는 변경하지 않았다.
Frontend CI의 frozen install → lint → format → typecheck → test → build 항목을 로컬에서 확인했다.
CI Ubuntu Node 24.19.0과 로컬 Windows Node 24.14.0은 동일 환경이 아니다.
선행 PR #265의 [Frontend CI](https://github.com/K4RF/reservation-platform/actions/runs/40381448265)와
[Backend CI](https://github.com/K4RF/reservation-platform/actions/runs/40381448061)는 성공을 확인했다.
이는 #256의 원격 CI 성공 증거가 아니다. 이번 브랜치는 push/PR 없이 **원격 CI 미실행**이다.

DOM/HTTP Mock 테스트와 Browser Fixture 관찰은 실제 HTTP/Auth/Redis/DB 통합 검증이 아니다.
실제 로그인·예약 생성·소유권·새로고침 인증/Google E2E, Native Browser Zoom, 타 Browser/실기기,
Screen Reader 및 사용자 직접 최종 시각 승인은 f0.6.0에 남는다.
`textScale=200`은 Audit root 글자/rem Reflow이며 Native Zoom을 검증한 것으로 보고하지 않는다.
