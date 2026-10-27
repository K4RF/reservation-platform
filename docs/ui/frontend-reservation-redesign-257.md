# Reservation Management 리디자인 — #257

검증일: 2026-10-28. 최신 develop `ed24ba1`(PR #266)에서
`feature/#257-reservation-management-redesign` 생성. 선행 #252가 포함된 기준이다.
개발자 구현/검증 완료이며 최종 사용자 UI/UX 승인은 아니다.

## 참조와 적용 범위

[승인 기준](approved-design.md), [독립 시안](prototypes/premium-travel/index.html),
[비교 보드](prototypes/premium-travel/review.html)를 읽고 index/Detail/review를 Browser에서 열었다.
[Detail Desktop](prototypes/premium-travel/screenshots/detail-1440.png) /
[Mobile](prototypes/premium-travel/screenshots/detail-390.png)의 Navy & Ivory, 여백·구분선·정보 계층과
Navy 주요 CTA를 확장했다. 예약관리 전체의 직접 승인 시안은 없으며 픽셀 일치 구현을 주장하지 않는다.
f0.5.2(Milestone #19, 과거 이름 f0.5.3) 범위다.

- 목록/상세 Header에 짧은 Eyebrow를 적용했다. 카드는 ID·현재 카탈로그 이름, 상태 Badge,
  공개 번호, 기간/전체 인원과 저장 금액을 구분한다. 카탈로그 실패 시 일부 미조회라고 표시한다.
  확정/취소 의미색은 브랜드 Navy와 별도로 유지하며 사진/통화/추가 Metadata는 넣지 않았다.
- 상세 저장 투숙객/숙박일별 가격은 넓은 화면 2열, 64rem 이하 1열이다.
  저장 정책·관리 작업·저장 취소 결과는 전체 폭이다. 본문은 wide, 목록은 reservation 폭 Token을 사용한다.
- 변경 전 저장 일정/총액과 새 요청 일정은 별도 영역이다. 48rem 이하에서 1열로 바뀐다.
  날짜별 참고 요금/참고 합계는 변경 응답의 서버 확정 금액이 아니라고 명시한다.
  확인 진입 때 제목에 Focus를 주며 가격 응답/재렌더링마다 Focus를 다시 가져오지 않는다.
- 취소 확인의 fresh GET 기록, 저장 정책 상대 경계, 사전 금액 미제공과 위험 안내를 구분한다.
  저장 결과와 취소 API 완료 응답은 각각 출처를 표시하며 환불 완료가 아니라는 안내를 강조했다.
- **의도적 차이:** 작업은 inline 확인 UI와 static CTA를 유지한다. 새 Modal/고정 하단 Bar/사진을
  만들지 않는다. 긴 설명·표·에러와 확대 글자/Focus를 덮지 않도록 했다.
  24rem 이하의 중첩 카드/확인 영역 여백을 줄이고 표는 내부에서만 스크롤한다.

## 유지한 데이터·상태 계약

소스와 [기존 관리 Flow](../testing/frontend-reservation-management-flow.md),
[일정 변경](../testing/frontend-reservation-change-flow.md), [취소](../testing/frontend-reservation-cancel-flow.md)를 확인했다.

- 카탈로그 이름은 현재 값이며 과거 이름 Snapshot이 아니다. 가격·투숙객·정책·취소 결과는 저장 기록이다.
  누락된 과거 정보는 추정하지 않고 현재 가격으로 저장 금액을 다시 합산하지 않는다.
- 일반 가용성은 기존 예약 점유를 제외하지 않는다. 미포함은 변경 불가, 포함은 변경 성공으로 보장하지 않는다.
  날짜 전용 PATCH·서버 재계산·동의·확인 전 가격 조회 금지와 수정 시 초기화는 그대로다.
- 취소 전 Fee/Refund 금액은 미제공이다. 저장 정책의 상대 경계만 표시하며 브라우저 시간으로
  현재 가능 여부·비율·수수료·환불액을 계산하지 않는다. 정책 확인을 위해 취소를 실행하지 않는다.
- 취소 완료 API의 estimatedRefundAmount와 상세 GET의 refundAmount를 혼용하지 않는다.
  저장 결과에 없는 적용 비율·숙소 기준 취소일을 역산하지 않는다. 실제 결제 취소/환불 완료는 없다.
- Change/Cancel 상호 Fieldset 잠금, Ref 중복 제출 Gate, pending/불명 결과 잠금,
  쓰기 401 자동 Replay 금지, 세션/이탈 뒤 늦은 응답 폐기를 유지한다.
  취소는 모든 실패 후 fresh detail GET + 새 확인/동의가 필요하다. 변경의 확실한 4xx와
  불명 결과 복구 정책은 기존대로 서로 다르며 하나로 합치지 않았다.
- URL/Storage에 투숙객·Token·동의/결과를 추가하지 않았다. USER/ADMIN 모두 자기 예약만 관리한다.
  전체 Admin 예약관리·새 Backend API/Schema·견적/가격/재고 규칙은 추가하지 않았다.
- **상태 필터 범위:** 현재 MyReservationsPage의 UI는 page만 제공한다. 상태/기간/정렬은 API 계약과
  기존 API Suite에 있으나 새 필터 Form을 추가하지 않았다. Issue의 필터 회귀를 UI 구현 완료로 과장하지 않는다.

## 자동 검증

Windows Node 24.14.0 / pnpm 11.19.0, `frontend/`에서 실행했다.

```shell
pnpm install --frozen-lockfile --offline
pnpm test src/components/reservation src/pages/MyReservationsPage.test.tsx src/pages/ReservationDetailPage.test.tsx src/test/ReservationManagementFlow.integration.test.tsx src/test/designTokens.test.ts
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
pnpm exec tsc -p scripts/ui-audit/tsconfig.json
```

초기 관련 9 files / 160 tests 통과 후 기존 Suite를 보완했다.
최종 전체 **76 files / 1,097 tests 통과**, lint/format/typecheck/build 및 Audit 타입 검사 성공.
기존 파일 5개의 테스트를 보완하고 CSS 계약 1건을 추가했으며 lifecycle Suite를 복제하지 않았다.

- ReservationList/Detail: 실제 ID·카탈로그 미조회와 저장 정보 영역의 구분.
- ChangeConfirmation: 확인 Focus, 저장/요청 일정 영역과 참고 금액, 기존 단일 PATCH Gate.
- CancellationSection: fresh GET 기록·저장 상대 경계와 사전 금액 미제공·동의의 기존 계약.
- 기존 ReservationManagementFlow와 세부 Suite: 성공/거절/불명 결과·후속 GET 실패·상호 제출 방지,
  새 GET/재확인·무자동재실행·403/404/로그인/History, 빈 목록·Pagination·API 상태 필터.

API/도메인 Mutation 코드는 변경하지 않았다. 테스트 disable/삭제, 개발 DB/Volume 조작은 없다.
Backend test/build·실제 HTTP 통합은 이번에 실행하지 않았다.

## 실제 Browser 관찰

[기존 Audit](../../frontend/scripts/ui-audit/README.md)의 실제 AppRoutes/Component/CSS와
USER Hint·가상 GET Fixture를 사용했다. API Proxy가 없고 쓰기는 405로 차단한다.
변경·취소는 안내/동의/버튼 Focus까지만 확인했으며 **확정 버튼은 실행하지 않았다**.
실제 완료 응답 Feedback·Mutation 실패 화면은 기존 자동 Suite 경계이고, Browser에서는 저장 취소 결과를 확인했다.

- Route: `/reservations`, `/reservations/42`.
- Audit: `role=USER`, `scenario=ready/empty/error/cancelled/stress`, `textScale=200`.
- 기존 달력의 Enter/방향키로 2030-01-02→04를 적용하고 가용성 GET→변경 확인을 열었다.
  기존 01-01→03 / 저장 350.25와 새 01-02→04 / 참고 246,913.56을 구분했다.
  날짜 적용 후 기존 확인이 제거되는 것도 관찰했다. native date fill 도구로 값 반영을 확인하지 못해
  달력 UI로 검증했으며 앱 입력 로직을 우회/변경하지 않았다.

| 조건 | 관찰 |
|---|---|
| 1440×1000 | 목록 1열 기록 카드, 상세 투숙객/가격 2열, 변경 전/후 2열. 문서 가로 넘침 없음 |
| 390×844 | 상세/변경 비교 1열, 저장 표 내부 스크롤. 변경 참고 표 client/scroll 273/448 |
| 취소 확인 390px | 사전 Fee/Refund 미제공, 동의 후에도 미전송. 취소 버튼 Tab 접근 top 753 / bottom 797 < 844 |
| 취소 저장 결과 390px | UTC 시각, 적용 175.13 / 예상 환불 175.12와 환불 미완료 안내. 변경/재취소 버튼 없음 |
| 320×844, stress + 200% | root 32px, 문서 305≤320. 긴 이름/이메일·큰 금액 줄바꿈. 저장 표 207/768, 변경 참고 표 139/896 내부 스크롤 |
| 같은 조건의 CTA | 변경 버튼 top 328 / bottom 516, 취소 top 354 / bottom 491. 키보드 접근, 확정 요청 없음 |
| 768/1024/1440, stress + 200% | 문서 753/1009/1425, 상세 1/1/2열, 변경 비교 1/2/2열. 가로 넘침 없음 |

빈 목록은 0건/0페이지와 탐색 링크, Error는 상세/관리 작업 없이 GET 재시도를 표시한다.
관찰된 Console warning/error는 없었다. `textScale=200`은 글자/rem Reflow이며 Native Browser Zoom과 다르다.
깊은 중첩 Form은 확대 시 세로로 길어지지만 문서 스크롤/줄바꿈을 유지하고 overflow를 숨기지 않았다.

캡처: [목록 1440](evidence/257/list-1440.png) / [390 전체](evidence/257/list-390.png),
[상세 1440 전체](evidence/257/detail-1440.png) / [390 전체](evidence/257/detail-390.png),
[변경 1440](evidence/257/change-1440.png) / [390](evidence/257/change-390.png) /
[320·200%](evidence/257/change-320-text200.png),
[취소 확인 1440](evidence/257/cancel-confirm-1440.png) / [390](evidence/257/cancel-confirm-390.png) /
[320·200%](evidence/257/cancel-320-text200.png), [저장 취소 결과](evidence/257/cancelled-390.png),
[빈 목록](evidence/257/empty-390.png) / [조회 실패](evidence/257/error-390.png).

## CI와 남은 검증

의존성·Lockfile·환경변수·Workflow·실행 설정 변경은 없다. Frontend CI의 frozen install,
lint/format/typecheck/test/build 항목을 로컬에서 통과했다. CI Ubuntu Node 24.19.0과 로컬 Windows는 구분한다.
선행 PR #266의 [Frontend CI](https://github.com/K4RF/reservation-platform/actions/runs/40567387463)와
[Backend CI](https://github.com/K4RF/reservation-platform/actions/runs/40567387256)는 성공을 확인했다.
#257은 로컬 커밋까지만 수행하여 **이번 브랜치 원격 CI는 미실행**이다.

DOM/HTTP Mock, Browser Fixture, 실제 HTTP/DB 통합과 원격 CI는 서로 다른 증거다.
실제 Backend 소유권/Mutation·다중 요청·새로고침 인증/Google E2E, 여러 실제 페이지의 Browser Pagination,
Native Zoom·타 Browser/실기기·Screen Reader·최종 사용자 직접 승인 및 마지막 REVIEW는 f0.6.0에 남긴다.
