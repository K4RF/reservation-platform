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
과거 레이아웃이나 구현 선택을 새 작업의 자동 승인 예외로 사용하지 않는다.
#19가 과거에 사용했던 이름 f0.5.3과 **새 #21**을 구분하고 역사 문서를 일괄 치환하지 않는다.
실제 Media 선행은 v0.4.1(#20)의 #272/#273, Frontend 연결은 #276이다.
최종 사용자 검수는 f0.6.0(#17)에 남긴다.

## 작업 전 읽을 자료

1. 해당 Issue, [현재 재구성 명세](prototype-rebuild.md), 이 문서의 승인 상태를 읽는다.
2. [독립 시안](prototypes/premium-travel/index.html)을 Browser에서 열고,
   [Desktop/Mobile 비교 보드](prototypes/premium-travel/review.html)를 확인한다.
3. 해당 GitHub Issue와 현재 소스·테스트·현재 화면 계약을 읽고 차이를 정리한다.

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

## 검수와 변경 기준

제품의 현재 동작과 재현 방법은 [화면 계약과 검수](frontend-guide.md)를 확인한다.
승인 방향 자체를 바꾸는 차이는 사용자의 확인이 필요하다.

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
