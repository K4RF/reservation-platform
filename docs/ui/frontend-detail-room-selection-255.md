# Accommodation Detail / 객실 선택 UI — #255

검증일: 2026-10-27. develop `67ab5cc`(PR #264)에서 `feature/#255-accommodation-detail-redesign` 생성.
선행 #252 공통 UI 및 #254 Search가 포함된 기준이다. 사용자 최종 승인 기록이 아니다.

## 참조와 적용

[승인 기준](approved-design.md), [Detail Desktop](prototypes/premium-travel/screenshots/detail-1440.png) /
[Mobile](prototypes/premium-travel/screenshots/detail-390.png)을 확인하고 독립 index/detail과 review를 Browser에서 열었다.
Home A1·Navy & Ivory와 함께 사용하는 Detail 탐색/선택 방향이며 f0.5.2(Milestone #19) 범위다.
과거 f0.5.3은 같은 단계의 이전 명칭이다.

- 숙소 제목/상태 → 큰 미디어 미제공 영역 → 소개/위치/시설과 이용 안내 → 가용성/객실 비교 → 선택 확인으로 정리했다.
  Desktop 소개/이용 안내는 2열, 64rem 이하에서는 1열이다. 값이 없는 과거 주소/운영시간은 기존 미제공 처리 그대로다.
- 가용 결과와 확인 패널은 Desktop 1.7:1, 64rem 이하에서는 목록 아래 패널이다.
  넓은 객실 카드는 미디어 슬롯/정보를 가로로, Mobile에서는 세로로 배치한다.
- 날짜/인원 입력은 기존 공통 필드다. 상단 “일정·객실 선택”은 가용성 제목으로,
  선택 후 “선택한 객실 확인하기”는 확인 패널 제목으로 이동하는 native Anchor다.
  제목은 tabindex=-1이며 링크 자체는 조회/선택/로그인/예약 쓰기를 수행하지 않는다.
- **시안과의 의도적 차이:** 확인 패널과 Mobile CTA는 static 문서 흐름에 둔다.
  정책 안내·가격표·대표 투숙객 입력·오류로 높이가 늘 수 있어 Sticky/Fixed CTA가 Focus/본문을 가리지 않도록 했다.
  자동 스크롤/선택/계속하기를 추가하지 않고 명시적 이동 링크와 기존 동작을 유지한다.
- Room Modal의 native dialog·Mobile 하단 Sheet를 재사용했다. 기본 Header는 기존처럼 sticky이며,
  24rem 이하 또는 높이 36rem 이하에서는 긴 Header가 내용을 덮지 않도록 static으로 전환한다.

## Media/Metadata와 가격·정책 경계

Backend와 Frontend의 AccommodationResponse / RoomResponse를 직접 확인했다.
숙소·객실 사진 URL, 객실 Description/Bed/Size/View가 없으며 정책 GET도 없다.

- 새 `CatalogMediaPlaceholder`는 **미제공 텍스트 + 장식 SVG**만 표시한다. 가짜 Gallery/썸네일/사진 개수/보기 버튼,
  브랜드 Hero/시안 사진, 임의 금액/통화/시설/전망을 추가하지 않았다. img/외부 미디어 요청이 없다.
- 공개 RoomCard에 `detail` Context가 있을 때만 미디어/탐색 표현을 적용한다. 같은 RoomCard를 쓰는 Admin에는 적용하지 않는다.
  Modal의 미디어도 실제 DTO GET 성공 후에만 표시한다. 카드 스타일은 직계 내용에 한정해 내부 Modal에 새지 않도록 했다.
- **실제 Gallery·사진 표시·이미지 로딩/실패·추가 Metadata 연동은 미완료다.** v0.4.1 계약 이후 구현할 별도 범위다.
  URL 자체가 없는 현재 상태에서 가짜 이미지 요청/실패를 모델링하지 않는다.
- 카드/Modal의 가격은 기본 1박, BookingSummary는 기존 날짜별 가격 GET을 합산한 예상 금액이다.
  확정 금액 Snapshot은 예약 생성 시 Backend가 계산/저장한다. 카드/예상 요금을 확정값으로 표현하지 않는다.
  통화·세금·추가 수수료·결제/환불 완료를 발명하지 않는다. 정책 값은 조회 불가 안내를 유지한다.

## 상태·Auth·쓰기 계약

RoomAvailabilitySection의 request/revision/page/selectedId, useAvailabilityForm, RoomDetailTrigger/Dialog,
BookingSummary/BookingFlow의 기존 로직을 유지하고 결과를 목록/aside로 감쌌다. 새 응답 Store/Cache는 없다.

- 날짜/인원 변경 → 기존 가용성/선택/가격/패널 제거, 명시적 새 조회 후 선택. Calendar Preview/취소는 기존 선택을 보존한다.
- URL roomId는 Hint다. 로그인 복귀에는 새 Availability GET 후 현재 반환된 객실만 복원한다.
- Modal은 매번 공개 Room GET, roomId/숙소 관계 검증, ACTIVE/정원/목록 Snapshot 일치와 선택 가능 Context를 유지한다.
  일반 객실 정보의 Modal은 읽기 전용이며 새 갤러리나 선택 권한을 부여하지 않는다.
- 닫기/Escape/Back/Forward·Abort/늦은 응답 무시·선택/비선택 닫기·Trigger Focus/Scroll 복원은 기존 계약이다.
- Token/대표 투숙객의 URL 보관, 자동 쓰기 재실행, 불명확 결과 잠금/중복 Submit/권한 경계를 변경하지 않았다.
  BookingFlow의 대표 투숙객 입력/최종 확인/명시적 제출은 그대로다.
- Detail은 Search의 CSS 클래스에 의존하지 않도록 분리했다. 공통 오류 표현에는 Detail Scope를 명시해
  예약 입력 오류의 기존 skin을 유지했다. Admin/API/Backend/DB 동작은 변경하지 않았다.

## 자동 검증

Windows / Node 24.14.0 / pnpm 11.19.0, `frontend/`에서 실행:

```powershell
pnpm install --frozen-lockfile --offline
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
pnpm exec tsc -p scripts/ui-audit/tsconfig.json
```

모두 성공, 전체 **76 files / 1,094 tests** 통과. 새 Lifecycle Suite 없이 기존 Suite에 2건을 추가/기존 검증을 보강했다.
미디어 미발명·Admin 미적용·Anchor Target/무요청, 선택 패널의 미선택/선택/해제·조건 변경 제거,
Modal 데이터/선택 권한/History/Focus, 기존 Booking 생성·Auth/예약관리/Admin 회귀를 유지했다.
CSS 검사는 비율/min-height로 인한 오버플로 방지 폭 제약과 카드/Modal Style Scope도 포함한다.
테스트를 삭제/비활성화하지 않았다. jsdom은 실제 Layout/Modal Top Layer/Scroll 검증을 대체하지 않는다.

## Browser 증거

computer-use로 실제 Component/CSS를 [격리 Audit](../../frontend/scripts/ui-audit/README.md)에서 확인했다.
실제 API가 아닌 ready/stress Fixture와 MemoryRouter, synthetic USER Hint를 사용하며 쓰기는 차단된다.

| 조건 | 직접 관찰 |
| --- | --- |
| 1440×1000 | 문서 폭 1425, 가로 넘침 없음. 1280×400 미디어 영역, 소개/안내 2열, 객실/확인 패널 2열 |
| Desktop 선택 | 패널 약 462px, 요금 표 client/scroll=412px. 예상 합계·로그인 CTA 표시. Tab으로 CTA가 viewport 안에 보임 |
| 390×844 | 문서 폭 375, 가로 넘침 없음. 소개/객실/확인 패널 1열, Anchor 후 패널 제목 Focus·상단 약 24px |
| Mobile 선택 | 요금 표는 이름/키보드 Focus를 가진 내부 가로 스크롤. Native Sheet 선택으로만 기존 요약이 표시됨 |
| 320px·textScale=200·stress USER | 글자 32px·문서 폭 305, 긴 이름/설명/주소·선택 후 대표 투숙객 폼에서도 문서 가로 넘침 없음 |
| 같은 조건의 Sheet | client/scroll=303px, Header static. Shift+Tab으로 마지막 선택 CTA가 y=659.5~795.9 안에 보임 |
| 768/1024/1440px·textScale=200 | 문서 폭 753/1009/1425, 모두 가로 넘침 없음. 확인 패널은 1/1/2열 |
| 390×480 짧은 Sheet | Header static, client/scroll=373px, 선택 CTA y=410.7~454.7 ≤ viewport 480 |

Desktop Escape 후 원래 가용 목록 Trigger Focus와 기존 선택을 유지했다. Mobile 명시적 선택 후
확인 이동 링크의 제목 Focus를 확인했다. 확대 USER 선택은 기존 폼/예상 요금을 표시하며,
인원 2→3 편집으로 패널/선택/요금/가용 결과가 모두 사라지는 것을 확인했다. 실제 로그인/예약 제출은 하지 않았다.
Console error/warn은 관찰되지 않았다. 확대 도중 드러난 미디어 최소 크기→폭 전이와
모바일 카드 비율의 Modal 유출은 명시적 폭/단일 Grid Track/직계 자식 Scope로 수정했다.

캡처: [Desktop 소개](evidence/255/detail-1440.png), [Mobile 소개](evidence/255/detail-390.png),
[Desktop 확인 패널](evidence/255/selection-1440.png), [Mobile 확인 패널](evidence/255/selection-390.png),
[Desktop Modal](evidence/255/room-detail-1440.png), [Mobile Sheet](evidence/255/room-detail-390.png),
[320px 확대 선택 Focus](evidence/255/room-detail-320-text200.png).

실제 HTTP/DB/인증·Google·쓰기·재고 경합·Native Browser History 증거가 아니다. History/새 GET/권한은 기존 Router/API 테스트로 구분한다.
`textScale=200`은 root font/rem 확대이며 실제 Browser Zoom·OS 배율과 같지 않다.
실제 Zoom·다중 Browser/실기기·스크린리더·전체 Backend 연동/최종 사용자 UI/UX 승인은 f0.6.0에 남긴다.

## CI/실행 설정

[선행 PR #264](https://github.com/K4RF/reservation-platform/pull/264)의 Backend/Frontend Check 성공을 확인했다(head `32c8fcb`).
현재 #255는 미푸시이므로 원격 CI 미실행이다. 기존 CI 검사 항목을 로컬에서 실행했지만
CI Ubuntu·Node 24.19.0과 로컬 Windows·24.14.0은 동일 환경이 아니다.
의존성/Lockfile/환경변수/Workflow/운영 실행 설정은 변경하지 않았다. Backend test/build는 재실행하지 않았고
실제 `.env`·Compose DB/Volume도 사용하거나 변경하지 않았다.
