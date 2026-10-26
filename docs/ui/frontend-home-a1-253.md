# Home A1 Cinematic Hero / #253

검증일: 2026-10-27. 개발자 구현/검증 기록이며 사용자 최종 승인이 아니다.

## 기준과 적용 범위

- [승인 디자인](approved-design.md)의 A1·Navy & Ivory, [Desktop](prototypes/premium-travel/screenshots/a1-1440.png) /
  [Mobile](prototypes/premium-travel/screenshots/a1-390.png)을 참조했다. 독립 index와 review도 Browser에서 열어 비교했다.
- 선행 #252는 develop `fad4eae`(PR #262)에 병합된 공통 Header/Navigation·UI 기준이다.
- 큰 배경 사진, 짧은 Serif 메시지/한글 안내, 충분한 여백과 하단 겹침 검색 Panel을 Home에 적용했다.
  A2나 검색창 우선 화면으로 바꾸지 않았다. f0.5.2(Milestone #19)의 Home 범위다.
- Header는 사진 위 투명형 대신 #252의 공통 Ivory Header를 유지한다. 역할별 메뉴·현재 경로·Focus와
  대비를 보존하기 위한 의도적 차이다. Mobile Header 줄바꿈도 공통 Navigation 계약을 따른다.
- 시안의 가상 리조트 대신 **새로 생성한 가상 해안 브랜드 풍경**을 사용한다. 실제 숙소/객실/시설/위치
  사진이 아니며 상시 AI 표시를 제공한다. [출처·정확한 Prompt·파일 Hash](../../frontend/src/assets/brand/README.md).
- 시안의 가짜 매물 카드 대신 기존 EXPLORE/CHECK/BOOK 안내와 전체 숙소 링크를 유지한다.
  Home에서 카탈로그를 추가 조회하거나 추천/인기/평점/가격/사진을 발명하지 않는다.
  링크는 기존 `/accommodations` 검색으로 이동하며 기본 ACTIVE·ID 오름차순 의미를 유지한다.

## 이미지·배치·접근성

- `HomePage.tsx`가 로컬 WebP 800w/1600w를 import한다. `srcSet`, `sizes=100vw`, 1600×900 크기 속성,
  `fetchPriority=high`, 비-lazy 로딩과 async decode를 사용한다. 외부 CDN/폰트 요청은 없다.
- 두 파일은 각각 66,996 / 219,136 bytes다. 고해상도 화면은 큰 후보를 선택할 수 있다.
  Vitest는 WebP Header와 80/256 KiB 예산을 검사한다. LCP/CLS 실측이나 느린 네트워크 성능 통과를 뜻하지 않는다.
- Hero는 Desktop 최소 40rem, Mobile 36rem로 공간을 확보하며 글자가 늘면 높이가 자란다.
  `cover`, `object-position:65% 45%`로 오른쪽 해안과 바다를 남긴다. 390px에서는 더 좁게 크롭된다.
- 장식 이미지 `alt=""`는 중복 낭독을 피한다. 콘텐츠/실매물 사진으로 설명하지 않는다.
  실패하면 이미지를 제거하고 Navy 배경·실패 status 안내·기존 입력을 유지한다. 자동 재시도는 없다.
  출처/실패 문구는 일반 Grid 흐름에 두어 확대 시 카피와 겹치지 않게 했다.
- White 카피는 Navy scrim의 평탄한 영역 안으로 폭을 제한한다. 75rem 이하에서는 전체 균일 scrim을 쓴다.
  실제 사진이 순백이어도 Alpha 합성 후 White 텍스트 대비가 4.5:1 이상임을 Token 테스트로 검사한다.
  출처는 불투명 Primary 배경이다. 밝은 사진 가장자리에는 카피를 배치하지 않는다.
- 검색 이동은 네이티브 Anchor와 `tabIndex=-1` 제목을 사용한다. Keyboard Focus Outline은 White다.
  문서 overflow를 숨기지 않는다. 펼친 달력 표만 이름/키보드 Focus가 있는 내부 가로 스크롤을 유지한다.

## 유지한 업무/데이터 경계

기존 `StayDateFields` / `GuestCountField`, FormData → `parseSearchQuery` → 검색 이동을 재사용한다.
일정 최소 1박 보정, 미완성 날짜 거부, 전체 인원 직접 입력/Stepper, 제출 전 조회 없음과 조건 전달을 유지한다.
가격/재고/정책/소유권/Auth API는 바꾸지 않았다. 대표 투숙객/Token을 URL에 추가하지 않는다.
로그인 후 Availability 재조회·쓰기 자동 재실행 금지·불명확 결과 잠금은 기존 Lifecycle Suite를 그대로 재사용한다.

브랜드 이미지 준비는 완료했지만 **실매물 사진·Gallery·v0.4.1 Media/Room Metadata 연동은 미완료/별도 범위**다.
Search/Detail 리디자인, 전체 Backend 실연동과 최종 UI/UX 직접 승인은 f0.6.0/후속 Issue에 남긴다.

## 검증

Windows / Node 24.14.0 / pnpm 11.19.0. 아래 명령은 `frontend/`에서 실행했다.

```powershell
pnpm install --frozen-lockfile --offline
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
```

전체 76 files / 1,088 tests 통과. 새 대형 Suite 대신 기존 routes/Token 테스트에 3건을 보완했다.
Auth 복귀 3개 Suite는 바뀐 Home 제목 assertion만 수정했다. 기존 검색·Booking 생성·예약관리·Admin·Auth
Lifecycle 테스트를 삭제/중복/비활성화하지 않았다. Backend/의존성/Lockfile/환경변수/Workflow 변경은 없으며
Backend 테스트는 재실행하지 않았다.

### Browser: 실제 Component + 격리 Fixture 읽기

`node scripts/ui-audit/server.mjs`의 Home `/`를 IAB에서 검사했다. 실제 AppRoutes/CSS를 사용하지만
Auth는 UI Hint, API는 Fixture이며 쓰기는 차단된다. MemoryRouter라 주소창 Query는 초기값이고,
검색 조건 전달은 렌더링된 검색 폼과 상세 링크의 Query로 확인했다. 실제 HTTP/DB/E2E 증거가 아니다.

| 조건 | 확인 결과 |
| --- | --- |
| 1440×1000 익명 | 문서 폭 1425, 가로 넘침 없음. 1600w 로딩·해안 크롭·하단 Panel 확인 |
| 390×844 익명 | 문서 폭 375, 가로 넘침 없음. 800w 로딩·1열 검색/안내 확인 |
| 768×1000 USER | 문서 폭 753, 가로 넘침 없음. 내 예약/로그아웃·Home 확인 |
| 320×844 ADMIN, textScale=200 | 문서 폭 305, 가로 넘침 없음. 글자 32px·카피/출처 비겹침 확인 |
| 같은 확대 조건, 펼친 달력 | 표 영역 clientWidth 157 / scrollWidth 448, tabindex=0 내부 스크롤. 방향키 날짜 이동·Escape 닫기/Trigger 복귀 |
| 1440px, textScale=200 | 문서 폭 1425, 가로 넘침 없음. 카피 오른쪽 845.4 ≤ scrim 경계 855, 출처와 분리 |

검색 Anchor 클릭 후 `home-search-title` Focus, Shift+Tab 복귀 후 White `:focus-visible`을 확인했다.
390px 달력에서 2026-10-28~30 선택/적용, 도시 서울·2명 Stepper 후 제출하여 검색 폼/상세 링크의
동일 일정·인원·도시 Query를 확인했다. Console error/warn은 관찰되지 않았다.
`textScale=200`은 root font/rem 확대이며 실제 Browser Zoom·OS 배율·실기기 검증을 대체하지 않는다.
이미지 실패는 DOM error Event 테스트로 확인했으며 Browser 네트워크 실패 주입은 하지 않았다.

최종 캡처:
[Desktop](evidence/253/home-1440.png), [Mobile](evidence/253/home-390.png),
[Mobile 검색/탐색](evidence/253/home-search-390.png), [320px 확대 달력](evidence/253/home-calendar-320-text200.png).
공통 Navigation은 #252와 같고, 검색의 정책 안내 때문에 시안의 압축 Search Bar보다 Panel이 높다.
이 차이는 지원하지 않는 정책/가용성을 숨기거나 추측하지 않기 위해 유지했다.

### CI와 미검증

[선행 PR #262](https://github.com/K4RF/reservation-platform/pull/262)의
Backend/Frontend Test and Build 성공을 GitHub Check에서 확인했다(head `3610184`).
**현재 #253은 미푸시이므로 원격 CI를 실행/통과한 것이 아니다.**
기존 Frontend Workflow의 frozen install/lint/format/typecheck/test/build 단계를 로컬에서 실행했다.
CI는 Ubuntu·Node 24.19.0, 로컬은 Windows·24.14.0이며 같은 환경 검증이라고 주장하지 않는다.
빌드가 두 WebP를 해시된 정적 자산(66.99 / 219.13 kB)으로 포함하는 것을 확인했다.
새 런타임/서비스/Secret 설정은 필요 없다.
다중 Browser·실기기·네트워크 지연 성능·스크린리더 수동 검수·실제 Backend·사용자 최종 승인은 남아 있다.
