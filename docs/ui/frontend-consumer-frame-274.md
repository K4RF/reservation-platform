# 소비자 Header·Footer 및 페이지 프레임 (#274)

## 기준과 적용 범위

2026-10-30, `develop`의 #273 병합 결과(`9720d10`)에서 작업했다.
[재구성 명세](prototype-rebuild.md), [승인 기준](approved-design.md),
독립 Prototype의 A1 / Navy & Ivory, Search, Detail을 직접 열어 비교했다.

이번 변경은 공통 프레임이다. #275 검색 입력·Popover, #276 실제 Media 연결,
#277 Home 본문, #278 Search 비교 구성, #279 Detail Gallery·Booking Rail,
#280 Booking 본문, #282 Auth 본문의 완성이나 사용자 최종 시각 승인을 의미하지 않는다.

## 구현과 책임

- `RootLayout`은 기존 인증 만료 안내·로그아웃 중 Outlet 차단·이동을 소유한다.
  경로별 `data-page-frame`을 지정하고 Router Location이 바뀌면 Header의 메뉴만 초기화한다.
  Outlet을 메뉴 열기/닫기로 재생성하지 않으며 메뉴 상태를 URL/History에 추가하지 않는다.
- `SiteHeader`는 공통 Brand와 실제 NavLink/로그아웃 Button을 제공한다.
  Desktop과 Mobile 메뉴가 같은 `NavigationLinks`를 사용하므로 USER/ADMIN/비로그인/로딩의
  목적지와 현재 위치가 동일하다. 권한 검증은 기존 ProtectedRoute와 Backend의 책임이다.
- Home은 Hero 위의 반투명 Navy Scrim Header, 다른 화면은 Ivory Header다.
  Home의 인증 만료 안내 또는 로그아웃 Loading이 Hero를 앞서거나 대체할 때는
  일반 Header로 돌아가 메시지를 덮지 않는다.
- 56rem 이하에서는 Brand·둘러보기·메뉴를 한 줄로 배치한다.
  Container 폭 22rem 이하는 둘러보기를 메뉴로 통합하고, 12rem 이하는 시각적 Wordmark를
  생략하되 Brand의 접근성 이름은 유지한다. Container rem은 확대된 루트 글자 크기도 반영한다.
- Mobile 메뉴는 Native modal Dialog다. 닫기 버튼으로 초기 Focus, Tab 순환, Escape/닫기,
  Scroll Lock 해제와 Trigger Focus 복귀를 제공한다. Desktop 전환으로 Trigger가 숨으면
  보이는 Brand로 복귀한다. 메뉴 안 링크 이동·Back/Forward는 닫힌 상태로 다음 화면에 도착한다.
- 모달 동안에만 이전 Body/Root overflow 값을 보관·복원한다. 일반 문서 overflow를 숨기지 않는다.
  Stable scrollbar gutter로 메뉴 전후 배경 폭 변경을 줄인다.
- 기존 Footer의 브랜드·여정 문구를 유지하고 A1의 구분선·여백·작은 보조 서체를 적용했다.
  임의 약관·연락처·Social 링크나 Studio/개발 안내 문구는 추가하지 않았다.

| 프레임 | 적용 폭/여백 | 유지한 경계 |
| --- | --- | --- |
| Home | Full bleed Hero, 740px / Mobile 720px 최소 높이 | 검색 폼·브랜드 사진·본문은 기존 구현 |
| Search | Desktop 좌우 6%, 가용 폭 전체 | 검색 URL·페이지·필터·정렬·응답 계약 유지 |
| Detail | Desktop 좌우 4%, 가용 폭 전체 | Gallery/본문 분리는 #279, Media 연결은 #276 |
| Booking/본인 예약 | Detail 안 작성 영역 최대 70rem, 기존 결과/예약 읽기 폭 유지 | Room·인원·Guest·Mutation Gate 변경 없음 |
| Auth/기타 읽기 | 기존 70rem 패널·28rem Form 등 역할별 폭 유지 | 인증/Return URL/메모리 Token 정책 변경 없음 |
| Admin | 기존 작업 영역·좁은 화면 Date Control 여백 유지 | 공통 Header 외 관리자 본문 재구성 없음 |

Mobile 소비자 본문은 좌우 22px이다. 기존 상태 배지의 동적 클래스와 Admin의
`nav-link-active`는 유지하고, 예전 다중 행 `.site-nav` Grid만 메뉴로 대체했다.
새 규칙을 끝에 덮어쓰는 대신 기존 Header·Footer·Home 프레임 정의를 수정했다.

## 실측과 의도적 차이

IAB의 실제 Component/CSS 렌더이며 UI Audit의 가상 읽기 응답을 사용했다.
Viewport 1440×900 / 390×844에서 Header의 실측 높이는 각각 **94 / 72px**로 원본과 같다.
Scrollbar를 제외한 Header 폭은 약 1424.8 / 375.2px이었다.

- 1440px Search 좌우 여백 85.49px, Detail 56.99px, Footer 113.98px.
  Footer 높이 76px, 390px Footer 높이 99.2px.
- Brand Mark는 Desktop 36×40px, Mobile 30×34px, Brand 링크는 최소 44px 높이다.
  원본 Mobile의 작은 로그인 링크 대신 최소 44px 메뉴 Button을 사용한다.
- Home Header는 임의 사진 위에서도 읽을 수 있도록 원본보다 진한 Scrim을 사용한다.
  순백 배경에 합성한 최소 Alpha에서도 글자 대비 4.5:1 이상을 소스 테스트로 검증한다.
  Menu 내부는 Ivory/Navy로 전환하고 Focus Ring도 이에 맞춘다.
- 원본의 가상 숙소 이미지·가격·지역·Gallery를 실제 숙소 정보에 이식하지 않았다.
  현재 Home 사진은 기존 AI 브랜드 이미지이고, Search/Detail은 아직 사진 미제공 Placeholder다.
  Home 카피의 줄 위치·Provenance·검색 폼 높이, Search의 큰 입력 폼과 Detail Gallery 미구현은
  후속 이슈에서 비교해야 할 명시적인 차이다.
- Header는 스크롤을 따라 고정되지 않는다. Home에서만 상단 Hero를 Overlay한다.
  Skip Link는 Header보다 위에서 보이며 Enter 후 `main-content`가 Focus를 받는다.
  Home 검색 Anchor는 Header가 화면 위로 나간 뒤 제목으로 이동하는 것을 확인했다.
  Main Scroll Margin과 기존 Detail Anchor 여백을 유지했다.
  이번 작업에 Fixed CTA를 추가하지 않았다. Footer는 Bottom Safe Area를 고려하지만,
  실제 Notch 기기와 후속 #279/#280의 Sticky/Fixed CTA는 별도 검증해야 한다.

## 검증

`frontend/`에서 실행:

```shell
pnpm test src/layouts/SiteHeader.test.tsx src/app/routes.test.tsx src/test/designTokens.test.ts
pnpm test
pnpm lint
pnpm typecheck
pnpm format:check
pnpm build
```

- 집중 테스트 3개 Suite / 54개 통과. 메뉴 열기/닫기, Focus 순환·복귀,
  URL/입력 Draft 보존, 메뉴 전용 History 미생성, 역할별 목적지·로그아웃 호출,
  Breakpoint 해제, 만료 안내 비가림과 기존 이미지 실패 회귀를 포함한다.
- 전체 77개 Suite / 1,117개 테스트 통과. 기존 인증·예약 생성·예약 관리·Admin 관리
  Lifecycle Integration Suite를 재사용하며 해당 흐름을 중복 생성하지 않았다.
- lint / typecheck / format:check / build 통과.
- 실제 Browser에서 Home/Search/Detail/Login의 1440/390 Header·본문·Footer와
  390 메뉴 열린 상태를 확인했다. 320px 및 루트 글자 200%의 네 화면에서 문서 가로 넘침이
  없었다. 확대 메뉴는 높이 제한 안에서 내부 스크롤한다.
- Browser ADMIN 메뉴의 내 예약/관리자/로그아웃, 현재 위치, Tab 순환,
  Escape 후 메뉴 Trigger 복귀, Desktop 전환 후 Brand Focus와 Scroll Lock 해제를 확인했다.

## 증거와 검증 한계

[캡처 목록·정렬 방법](evidence/274/README.md)을 따른다. 전체 페이지 캡처 API와 문서 높이
Clip이 실패해 **전체 페이지 스크린샷은 미확보**다. 상단과 실제 Footer 도달 화면을 분리 저장했다.
Desktop에는 Mobile 메뉴가 없으므로 1440px 메뉴 열린 화면을 연출하지 않았다.
Desktop 전환 시 열린 메뉴가 닫히는 동작을 대신 검증했다.

Browser는 실제 React/CSS와 Native Dialog의 증거이지 실제 Backend 인증·예약·DB·Media HTTP
연동 증거가 아니다. Brand 이미지 표시와 Catalog 사진 미제공을 Browser에서 확인했지만,
이미지 로드 실패는 기존 DOM Error 회귀 테스트 경계다. 실제 Media 있음/없음/실패의 통합
Browser 검증은 #276 이후에 필요하다. 네이티브 Browser Zoom/실기기 Notch/스크린리더는
이번에 검증하지 않았고 루트 글자 200%를 Browser Zoom과 동일시하지 않는다.

의존성·Lockfile·환경변수·실행 포트·Backend·CI 설정은 바꾸지 않았다.
`.github/workflows/frontend-ci.yml`의 Node/pnpm 설치 이후 lint·format·typecheck·test·build와
동일한 프로젝트 명령을 로컬에서 검증했다. 로컬은 Node 24.14.0 / pnpm 11.19.0이고,
CI는 Node 24.19.0 / pnpm 11.19.0이므로 완전히 동일한 실행 환경은 아니다.
원격 GitHub Actions 실행/성공은 미확인이다.
최종 시각 승인은 사용자에게 남아 있다.
