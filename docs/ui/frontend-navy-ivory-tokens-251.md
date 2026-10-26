# Navy & Ivory Design Tokens / Global Style (#251)

검증일: 2026-10-26. #232가 병합된 `develop`(`64d5b7b`)에서
`feature/#251-navy-ivory-tokens`를 생성했다. f0.5.2 Visual Redesign의 전역 기준 적용이며
A1 Hero·사진 Gallery·Search/Detail 전체 배치 완료나 최종 사용자 승인이 아니다.

## 참조와 범위

[승인 기준](approved-design.md), Prototype README/ASSETS, #225/#232 기록과 현재 CSS/테스트를 읽었다.
[독립 시안](prototypes/premium-travel/index.html)·[비교 보드](prototypes/premium-travel/review.html)를
Browser에서 열고 Navy Palette/Home A1 Desktop·Search Mobile 참조 캡처를 직접 확인했다.
Home A1·Navy & Ivory와 Search/Detail의 역할은 유지한다. A2/다른 Palette로 변경하지 않았다.

`src/styles/tokens.css`를 의미별 값의 단일 원본으로 유지하고 `src/index.css`가 소비한다.
별도 Styling Framework, Dark Mode, 외부 Font/이미지 요청, Dependency/Lockfile/실행 설정 변경은 없다.
API/Domain/DB/Auth/Route·예약/가격/재고 로직과 쓰기 Gate는 변경하지 않았다.
시안의 가상 사진·금액·가용성·Metadata는 Production으로 가져오지 않았다.

## 적용 기준

| 역할 | Token / 값 | 근거와 사용 경계 |
|---|---|---|
| Primary | `primary` #253b59 / hover #1c2e47 / on-primary #fff | 승인 Navy, 주요 CTA/Link. Hover는 명도 차이를 둔 구현 초안 |
| Background / Surface | #f7f4ee / #fffefa | 승인 Warm Ivory 배경과 카드/입력 Surface |
| Secondary / Hover | #eee9df / #e2dacd; Surface Hover #f2eee6 | 선택 Navigation·Table Header와 보조 Surface. Primary CTA와 구분 |
| Text | #2c3038 / muted #65676a / subtle #62666c | 본문·보조·메타 역할. 정상 글자 대비 4.5:1 이상 확인 |
| Border | 장식 #ddd9d1 / Control #7b8189 | 시안의 가벼운 장식선은 입력 경계가 아님. Input/Select/Button은 3:1 이상 별도 경계 |
| Focus | Primary Navy, 3px + 3px Offset | 시안 Coral Focus 대신 Navy 사용. 배경 위 명확한 Focus를 확보하고 Coral 사용을 작은 장식으로 제한 |
| Accent | #b96f55 | Eyebrow의 작은 시작 Border만 사용. 본문/CTA/성공·오류/취소 의미에 사용하지 않음 |
| Success / Error / Warning | #205c4d/#e2f3ed, #b42318/#fff1ef, #854d0e/#fef3c7 | 기존 의미의 Text/Surface 유지. 성공의 녹색은 과거 브랜드색 잔재가 아닌 독립 상태색 |
| Cancelled | #655044/#f2ece7 | 저장된 취소 상태이며 오류·환불 완료가 아님. 동적 Class 유지 |
| Hero / Catalog 장식 | Highlight #e8dfd1 / Pattern #253b5908 | 기존 Gradient/Pattern의 색만 연결. 사진이 없는 상태를 가짜 실제 사진으로 채우지 않음 |

색상 표의 역할은 `--color-` 접두사를 생략했다. 단순 장식 Border는 3:1을 주장하지 않는다.
Coral은 최소 표본 대비 3.174:1로 작은 일반 본문의 4.5:1 기준에 못 미치므로 글자색으로 쓰지 않는다.

### Typography·간격·Geometry

- Body/UI: `Segoe UI`, `Malgun Gothic`, `Apple SD Gothic Neo`, system-ui, sans-serif.
  영문 Brand·h1·Hero Display는 Georgia, Times New Roman 다음 **동일 UI Sans Stack**으로 fallback한다.
  한글용 Serif나 외부 Font를 추가하지 않는다. 실제 Glyph/Weight는 설치 Font·OS·Browser에 따라 다르며
  계산된 font-family 문자열만으로 실제 선택된 모든 Font Face를 증명하지 않는다.
- Body 1rem/1.6: 기본 16px를 존중하며 행간은 24→25.6px로 의도적으로 증가한다.
  h1 2rem/1.25, Hero 1.7~3rem/1.35를 유지한다. Brand는 1.1→1.25rem,
  Hero Display Weight는 750→400으로 정돈한다. UI Label/Button의 Sans·600 Weight는 유지한다.
- 4px 기반 Spacing Scale(.25/.5/.75/1/1.25/1.5/2/3/4rem)과 40/48/60rem Breakpoint는 유지한다.
  Role별 Width도 Auth28/Form32/Result45/Reservation60/Wide70rem을 유지한다.
  시안의 대형 Hero/두 열 사진 Layout까지 이번 전역 작업에 섞지 않는다.
- Radius는 Control .6→.35rem, Card 1→.75rem, Hero 1.5→1rem으로 조금 더 절제한다.
  모든 모서리를 시안처럼 직각으로 강제하지 않으며 모바일 Sheet 형태도 유지한다.
  Shadow의 Tint는 Navy로 바꾸고 사용 위치는 유지한다. Control 최소 2.75rem(기본 44px),
  Focus 폭·Offset·줄바꿈·내부 표 Scroll을 유지한다. 문서 Overflow를 숨기지 않는다.

이 값들은 가독성과 기존 업무 Form을 고려한 구현 초안이다. 전면 Typography·화면별 배치는 후속 Issue와
f0.6.0 사용자 직접 검수에서 조정할 수 있으며, 승인 목표 자체가 달라졌다고 해석하지 않는다.

## 검증 결과

기존 `designTokens.test.ts`를 보완했다. Navy/Surface/Accent 매핑, 상태색 보존, Local Display/UI Fallback,
외부 Font 비사용을 추가하고 기존 변수 참조·단일 선언·동적 상태 Class·대비·Layout 계약을 유지했다.
새 Lifecycle Suite를 복제하지 않고 기존 Auth/Booking/Reservation/Admin 통합 Flow를 전체 실행했다.

| 명령 (`frontend/`) | 결과 |
|---|---|
| `pnpm install --frozen-lockfile --offline` | 성공, Lockfile 변경 없음 |
| `pnpm test src/test/designTokens.test.ts` | 15개 통과 |
| `pnpm lint` / `pnpm format:check` / `pnpm typecheck` | 모두 성공 |
| `pnpm test` | 76개 파일 / **1,083개 통과** |
| `pnpm build` | 성공, 139 Module |

Backend 변경이 없어 Backend Test/Build는 재실행하지 않았다.

### 대비 산술과 실제 Browser

Token의 sRGB 상대휘도 기반 대비를 테스트했다. 최소 표본:

| 조합 | 대비 |
|---|---|
| 흰 CTA 글자 / Navy (Hover) | 11.361:1 (13.715:1) |
| 본문 / Ivory Background | 12.054:1 |
| Muted / Secondary | 4.689:1 |
| Control Border / Secondary | 3.248:1 |
| Navy Focus / Secondary | 9.390:1 |
| Coral 장식 / Secondary | 3.174:1 |
| Success / Error / Warning / Cancelled 각 Surface | 6.771 / 5.973 / 6.153 / 6.439:1 |

이는 정의된 불투명 색 조합의 산술 검사다. 모든 실제 Pixel/투명 Gradient/disabled Opacity·UA Control,
사진 위 글자나 전체 WCAG 적합성을 증명하지 않는다.

computer-use 스킬로 [읽기 전용 Audit](../../frontend/scripts/ui-audit/README.md)의 실제 App Component/CSS를
렌더링했다. [측정 요약](evidence/251/measurements.json)과 같은 폴더의 PNG를 직접 시각 확인했다.
실제 Backend/Google/DB/Volume을 사용하지 않았고 Fixture 쓰기는 차단된 상태다.

- 15개 Ready Route × 390×844 / 1440×1000 = 30조합: Auth/Search/Detail/예약 목록·상세·완료/Admin 각 관리
  화면에서 실제 본문 로드와 적용 Palette/Font Stack, 문서 가로 넘침 없음을 확인했다.
- Home/Login/Search/예약 상세/Inventory 320px 5조합도 넘침 없음.
- Home/Search/Detail/예약 상세/Inventory × 320/390/1440의 **200% 글자/rem 확대** 15조합에서
  root 32px·실제 내용·문서 넘침 없음을 확인했다. 실제 Browser Zoom과는 다르다.
- Search Error/Empty·예약 상세/완료 Cancelled × 두 폭 = 8조합. Alert의 빨강과 저장 취소의 갈색 Surface가
  Navy와 별도로 유지되었다. 기존 CONFIRMED Badge도 녹색 상태색을 유지한다.
- Login 이메일에서 Tab으로 비밀번호 이동 시 Navy 3px Outline/3px Offset, 기본 Submit 높이 44px를 확인했다.
  Inventory Region도 Navy 3px Outline과 ArrowRight 내부 Scroll 0→40px를 확인했다.
  390px에서 Region clientWidth309/scrollWidth576이며 문서 폭375/375는 유지된다.
- Room Sheet의 Shift+Tab/Tab 순환, Escape 닫기와 원래 Trigger Focus 복귀를 재확인했다.
  내부 clientWidth=scrollWidth=373px, 선택 Button의 Focus도 Navy다. 실제 예약 생성은 실행하지 않았다.
  관찰한 Audit Tab의 Console error/warn은 0건이다.

대표 비교: [기존 녹색 Login](evidence/251/before-login-390.png) → [Ivory Login](evidence/251/login-390.png),
[Desktop Focus](evidence/251/login-focus-1440.png), [Home](evidence/251/home-1440.png),
[Search](evidence/251/search-1440.png), [예약 상세](evidence/251/reservation-1440.png),
[Admin Inventory](evidence/251/inventory-1440.png).
모바일 표본: [Home](evidence/251/home-390.png), [Search](evidence/251/search-390.png),
[Room Sheet](evidence/251/room-sheet-390.png), [Inventory 키보드](evidence/251/inventory-keyboard-390.png),
[저장 취소](evidence/251/cancelled-390.png), [오류](evidence/251/error-390.png).
시안과 비교하면 Palette·영문 Serif Brand·Warm Surface는 적용됐지만 사진·대형 Hero·사진 카드·
Gallery·메뉴 구조는 기존 구현이다. 시안과 같은 전체 UI라고 보고하지 않는다.

## 버전·CI·후속 검증 경계

현재 AGENTS/approved-design/루트·Frontend README의 Visual Redesign을 **f0.5.2**로 동기화했다.
과거 f0.5.3은 GitHub Milestone #19의 이전 이름으로, 별도 단계가 아니다. #225/#232 등 과거 수치·
검증 기록은 당시 사실로 그대로 보존했다. v0.4.1 실제 Media/Metadata 계약은 이번 작업 범위가 아니다.

로컬 Windows Node24.14.0/pnpm11.19.0에서 CI와 같은 검사 명령을 통과했다.
원격은 Ubuntu/Node24.19.0이며 OS·Font·Node Patch/온라인 Install은 동일 환경 검증이 아니다.
Workflow·Dependency·실행 설정 변경은 없다. 읽기 전용 확인한 선행 #232 PR #250의 Head
`7038e16afed54bf64ef588f9de786daaaac09339`는
[Frontend CI](https://github.com/K4RF/reservation-platform/actions/runs/40217808737/job/121242656210)와
[Backend CI](https://github.com/K4RF/reservation-platform/actions/runs/40217808735/job/121242656465)가 성공했다.
이번 #251은 로컬 Commit 요청으로 Push/PR하지 않았으며 **이번 변경의 원격 CI는 미실행**이다.

실제 Backend/Google 전체 Flow, Native Browser History/Hosting, Browser 200%/400% Zoom,
Screen Reader·실기기·다른 OS Font는 이번 검증의 증거가 아니다. Token 변경으로 API 안전 정책을
증명하거나 자동 재실행하지 않는다. 기존 HTTP Mock Suite의 성공은 실제 HTTP/Browser 통합 성공과 다르다.
최종 UI/UX 사용자 승인·마지막 REVIEW는 f0.6.0에 유지하며 자동 완료/Issue 생성하지 않는다.
