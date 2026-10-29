# 승인된 Frontend 디자인 기준

승인일: 2026-10-22. 인계 문서화: 2026-10-24.
이 문서는 **구현할 목표**이며 현재 Production 적용 완료 기록이 아니다.

## 현재 우선 기준 — 2026-10-29

[승인 시안 기반 재구성 명세 (#271)](prototype-rebuild.md)를 현재 작업 진입점으로 사용한다.
새 **f0.5.3(Milestone #21)**은 기존 베타 DOM에 색상만 덮지 않고 구성·밀도·상호작용을 재구성한다.
Home overlay Header/Hero 내부 검색/사진 탐색, Search compact bar/미디어 카드/필터 Sheet,
Detail 비대칭 Gallery/예약 Rail/Mobile 고정 CTA가 최소 대응 목표다.
Booking/내 예약/Auth/Admin은 #271의 **새 구성안**이며 전용 원본의 직접 승인 화면이 아니다.

f0.5.2(#19)의 #253–#260은 개발자 구현/회귀 기록이지 사용자 시각 승인이 아니다.
아래 과거 범위·예외 기록을 새 작업의 자동 승인 예외로 사용하지 않는다.
#19가 과거에 사용했던 이름 f0.5.3과 **새 #21**을 구분하고 역사 문서를 일괄 치환하지 않는다.
실제 Media 선행은 v0.4.1(#20)의 #272/#273, Frontend 연결은 #276이다.
최종 사용자 검수는 f0.6.0(#17)에 남긴다.

## 작업 전 읽을 자료

1. 해당 Issue, [현재 재구성 명세](prototype-rebuild.md), 이 문서의 승인 상태를 읽는다.
2. [독립 시안](prototypes/premium-travel/index.html)을 Browser에서 열고,
   [Desktop/Mobile 비교 보드](prototypes/premium-travel/review.html)를 확인한다.
3. 해당 GitHub Issue와 현재 소스·테스트·기존 구현 문서를 읽고 차이를 정리한다.

시안은 `docs/ui/prototypes/premium-travel/`에 있다. 이 채팅 기록이나 사용자 PC의
`.codex/visualizations` 폴더, 실행 중인 서버 없이도 재현할 수 있다.
HTML 파일 직접 열기 또는 해당 폴더에서 `node serve.cjs` 후
`http://127.0.0.1:4381`로 확인한다. 서버 종료는 Ctrl+C다.

## 확정 사항과 초안

| 항목 | 상태 | 기준 |
|---|---|---|
| 서비스 방향 | 승인 | Premium Travel Experience × Practical Booking Platform |
| Home | **A1 승인** | 넓은 Cinematic Hero, 큰 사진, 짧은 메시지, Hero 내부/하단 검색 |
| Home A2 | 비교안 보관 | Editorial 대안이며 선택된 목표가 아님 |
| Search | 방향 승인 | 사진 비중이 큰 비교 화면. Desktop 2열·모바일 1열 및 필터 접근 구조 |
| Detail | 방향 승인 | 큰 갤러리, 소개, 객실 비교, 일정/인원과 CTA. Search와 역할별로 함께 사용 |
| Palette | **Navy & Ivory 방향 승인** | Navy Primary, Warm Ivory 배경, Charcoal 텍스트, 절제된 Coral |
| HEX/서체/카피/간격 | 구체화 초안 | 시안 수치는 출발점이며 모든 수치가 최종 승인된 것은 아님 |
| 달력/Stepper/객실 Modal·모바일 Sheet | 추천 UX 초안 | 실제 Issue에서 조작·접근성·표현 검토. 모든 동작의 픽셀 승인 아님 |
| 전체 Production UI/UX | 미승인 | f0.6.0에서 사용자 직접 최종 검수. Codex가 자동 완료하지 않음 |

사용자 승인 요지: A1을 선호하고, Search는 검색에·Detail은 숙소 상세에 함께 적용하며,
추천 색감으로 진행한다. 작업자는 이름 "A1"만 보고 임의의 다른 디자인을 만들지 않는다.

## 참조 화면

| 화면 | 1440px | 390px |
|---|---|---|
| Home A1 | [Desktop](prototypes/premium-travel/screenshots/a1-1440.png) | [Mobile](prototypes/premium-travel/screenshots/a1-390.png) |
| Search | [Desktop](prototypes/premium-travel/screenshots/search-1440.png) | [Mobile](prototypes/premium-travel/screenshots/search-390.png) |
| Detail | [Desktop](prototypes/premium-travel/screenshots/detail-1440.png) | [Mobile](prototypes/premium-travel/screenshots/detail-390.png) |

상호작용 초안: [날짜 Desktop](prototypes/premium-travel/screenshots/date-picker-1440.png),
[날짜 Mobile](prototypes/premium-travel/screenshots/date-picker-390.png),
[객실 상세](prototypes/premium-travel/screenshots/room-drawer-1440.png).
2026-10-22 독립 시안의 실제 Edge 캡처이며 Production 검증 증거가 아니다.
긴 모바일 전체 캡처의 고정 CTA는 당시 viewport 위치에 표시된다.

### Palette / Typography 출발점

| 역할 | 시안 값 |
|---|---|
| Primary | `#253B59` |
| Background | `#F7F4EE` |
| Surface | `#FFFEFA` |
| Text / Muted | `#2C3038` / `#65676A` |
| Accent | `#B96F55` |
| Border | `#DDD9D1` |

#225 등의 녹색 유지 결정은 과거 baseline이며 승인 이후의 최종 목표로 해석하지 않는다.
`f0.5.2`의 #251에서 기존 semantic Token 구조에 Navy & Ivory 전역 팔레트를 연결했다.
성공/오류/취소 의미 색은 브랜드 색과 분리해 유지한다. 이는 A1·Search/Detail 전체 배치 적용이 아니다.
Coral은 포인트에 제한하며 주요 CTA는 Navy를 사용한다.

Typography는 영문 Display Serif + 한글/UI Sans 초안이다. 시안은 설치된
Georgia/Segoe UI/Malgun Gothic/system fallback을 사용하며 외부 폰트를 포함하지 않는다.
특정 외부 서체 라이선스나 카피까지 승인한 것으로 간주하지 않는다.

## 과거 Issue별 적용 범위 — #241이 녹색으로 보이는 이유

아래는 f0.5.1/f0.5.2 당시의 작업 구분이다. 새 #21의 순서·수용 기준은 #271 명세를 따른다.

| 작업 | 적용 범위 |
|---|---|
| #224~#230 | 기존 UI 정돈 기록 보존. 새 승인 방향으로 완료 작업을 재개발하지 않음 |
| #241 | 날짜 범위·최소 1박·적용/취소·키보드·조회 수명주기. 전체 Home/Palette 교체는 범위 밖 |
| #242 | 전체 인원 Stepper/직접 입력. 기존 Token 위 UX 구현 |
| #243 | 기존 URL/Booking Context 및 Scroll/Focus 복귀 |
| #244 | 기존 Room DTO 필드의 상세 표현·선택. 사진·Metadata 확장과 분리 |
| #231 / #232 | 현재 화면과 새 UX의 횡단 접근성·회귀 검증. A1 전체 적용 완료라고 보고하지 않음 |
| v0.4.1 | 실제 Media/Room Metadata·정책 읽기 계약 및 Admin 입력 |
| f0.5.2 | A1·Navy & Ivory·Search/Detail을 실제 적용하고 Booking/Auth/내예약/Admin 통일. #251은 전역 Token·기본 Style만 적용 |
| f0.6.0 | 실제 Backend 전체 연동·오류·반응형·접근성 및 사용자 직접 최종 승인 |

GitHub Milestone #19의 현재 명칭은 **f0.5.2 — Frontend Visual Redesign**이다.
이 표와 당시 기록에서 사용한 f0.5.3은 #19의 이전 명칭이다. 2026-10-29 새로 정의된
f0.5.3(#21)과는 별도이며, 당시 명칭만으로 현재 후속 단계가 없다고 해석하지 않는다.
현재 토큰·대비·서체·시안과의 차이는 [#251 구현/검증 기록](frontend-navy-ivory-tokens-251.md)을 따른다.
과거 #225/#232의 수치·관찰·캡처는 당시 기준으로 보존한다.

2026-10-24 확인 시 #241은 로컬 `feature/#241-stay-date-range`에 구현과 검증 문서가
있지만 GitHub는 Open이고 관련 PR은 확인되지 않았다. 이 관찰로 이슈를 닫거나 병합 완료로
간주하지 않는다. [날짜 UX 구현 문서](../testing/frontend-stay-date-range.md)를 함께 읽는다.

**UX와 Visual 단계는 분리하되 승인 시안을 모른 채 구현하지 않는다.**
구현 전 이번 Issue에서 유지/변경/후속으로 남길 부분을 밝힌다. 당시 시안의 모달 대신
비모달 펼침 달력을 선택하는 등 구조 차이는 이유·접근성 계약을 기록한다.
현재 #241의 비모달 Calendar를 시안의 모달과 동일한 구현으로 보고하지 않는다.
사용자의 승인 방향 자체를 바꾸는 차이는 확인이 필요하다. 새 #275의 Dialog/Popover와
#279의 sticky/fixed 목표를 과거 비모달/static 선택으로 자동 면제하지 않는다.

## 데이터·업무 경계

- 모든 사진·숙소명·금액·가용성은 가상이다. [ASSETS](prototypes/premium-travel/ASSETS.md)를 읽고
  시안 사진을 실매물에 연결하거나 업로드가 이미 구현됐다고 표현하지 않는다.
- #272에서 Backend 숙소/객실 DTO에 Media 읽기 계약을 추가했다. [실제 계약](../architecture/catalog-media.md)을
  사용하고 [#273 Backend 업로드/관리](../architecture/media-management.md)와 #276 Frontend 연결을 구분한다. Room Description/Bed/Size/View는
  여전히 없으므로 실제 정보처럼 채우지 않는다. 이미지 미제공/실패 상태를 함께 설계한다.
- 숙소 검색 DTO에 카드 최저가/총액이 없다. 별도 읽기·명시적 계약 없이 가격 집계나
  가격순 정렬을 발명하지 않는다. 통화·평점·리뷰·할인율도 발명하지 않는다.
- 기존 Booking Policy·가격/재고 Source of Truth·소유권·Auth Lifecycle을 유지한다.
  정책 GET 부재 상태에서 숙소 정책·취소 수수료를 브라우저가 추측하지 않는다.
- URL에 대표 투숙객/토큰을 넣지 않는다. 로그인 후 Availability 재조회, 쓰기 자동 재실행 금지,
  불명확 결과 잠금·상호 제출 방지 등 기존 안전장치를 유지한다.

## “#번호 확인하고 작업해줘” 실행 절차

1. Issue, #271 명세, 이 문서, 해당 시안/스크린샷, 선행 결과·현재 소스/테스트를 읽는다.
2. 구현 전 적용할 참조 화면과 Issue 범위를 요약한다. UX/Visual/Data 작업을 구분한다.
3. 현재 Issue 범위만 구현하고 시안의 가짜 데이터·간략한 업무 로직을 복사하지 않는다.
4. 시각 변경은 실제 Route/Component의 1440px/390px 전체 페이지와 같은 위치 Viewport를 비교한다.
   Studio/시연 UI를 제외하고 Media 있음/없음/실패를 확인한다. Sticky/Fixed 겹침은
   safe-area·본문 여백·Focus/키보드 대응으로 해결한다. DOM 테스트만으로 픽셀·크롭·반응형을 완료했다고 보고하지 않는다.
5. 참조 기준, 적용한 점, 의도적 차이, 테스트와 미검증 범위를 보고한다.
   최종 사용자 시각 승인은 사용자에게 남긴다.

## 버전 관리와 공유

문서와 prototype/assets/screenshots를 함께 Git에 포함해야 다른 Clone/Worktree에서도 볼 수 있다.
로컬 파일 추가만으로 GitHub나 별도 Clone에 배포되지는 않는다. 커밋/푸시/병합 전에는
Issue에 적힌 저장소 경로를 현재 Checkout에서 읽고, 파일이 없는 환경은 해당 문서 변경을
먼저 가져온다. 사용자 PC 절대 경로나 localhost를 공유 원본으로 사용하지 않는다.
