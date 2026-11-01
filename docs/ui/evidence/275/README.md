# #275 Browser evidence

2026-11-02(Asia/Tokyo). `frontend/scripts/ui-audit/server.mjs`의 실제 React/CSS와
읽기 fixture를 사용했다. 실제 Backend proxy/DB 쓰기/예약 요청은 없다.
원본은 `docs/ui/prototypes/premium-travel`의 A1/Navy & Ivory다.

- `home/search/detail-closed-{1440,390}.jpg`: scroll top viewport.
- `home/search/detail-full-{1440,390}.jpg`: 실제 full-page, Header부터 Footer까지.
- `*-date-{1440,390}.jpg`, `*-guests-{1440,390}.jpg`: 연 실제 레이어.
  trigger 자동 가시화로 배경 scroll 위치는 닫힌 top 캡처와 다를 수 있다.
- `detail-bar-1440.jpg`: 상세 가용성 Bar로 스크롤한 viewport.
- `home-date-selected-390.jpg`, `home-applied-390.jpg`: Nov12→14/2박 적용.
- `home-guests-invalid-390.jpg`: 잘못된 raw draft 차단, 닫힌 값은 미변경.
- `detail-guests-320.jpg`: 320×568 Sheet.
- `home-date-320-text200.jpg`: 320×568, root font 200%, 내부 스크롤로 footer
  버튼에 도달한 상태. 제목/달력까지 한 화면에 다 보이는 상태가 아니다.
- `prototype-home/search-{1440,390}.jpg`: Studio를 뺀 원본 top viewport.
  Desktop 높이846, Mobile 높이772이며 각각 Studio 54/72px를 제외했다.
- `home/search-compare-390.jpg`: 앱 top에서 같은772px 높이를 자른 비교용.
  원본 clip은 scrollbar 영역을 포함할 수 있다. UI 폭/scrollbar 차이를
  동일한 가로 pixel이라고 해석하지 않는다.
- `prototype-*-full.jpg`: Studio를 제외한 원본 전체 본문 clip.
  `prototype-home-390-full-with-studio.jpg`는 자르기 전 원본 증거만 보존한다.
  원본 날짜 레이어 `prototype-date-*.jpg`의 배경 Studio는 비교 대상이 아니다.

Search/Detail fixture는 서울 호텔(id7), 스탠다드(id3), Nov12–14, 전체2명이다.
Home 초기 캡처는 빈 도시/날짜·1명, applied 캡처는2박·2명이다. 사진/가상 금액은
실제 catalog 데이터로 옮기지 않았다. 원본/제품의 전체 화면 차이와 미검증 경계는
[구현 보고서](../../frontend-compact-search-275.md)에 기록한다.
