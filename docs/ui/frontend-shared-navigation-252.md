# 공통 UI·Header/Navigation 리디자인 (#252)

검증일: 2026-10-27. 선행 #251의 PR #261이 병합된 `develop`(`76b6891`)에서
`feature/#252-shared-ui-navigation`을 생성했다. f0.5.2의 공통 외형 작업이며,
A1 Home·Search/Detail 전체 화면 완성이나 f0.6.0 사용자 최종 승인은 아니다.

## 참조와 의도적 차이

[승인 기준](approved-design.md), Prototype README/ASSETS, #226/#231/#232와 현행 소스·테스트를 읽고
[독립 시안](prototypes/premium-travel/index.html)·[비교 보드](prototypes/premium-travel/review.html)를
Browser에서 열었다. Search 1440px, 날짜 390px, Room 상세 1440px 참조 캡처를 시각 확인했다.
Home A1·Navy & Ivory를 기준으로 R 마크·두 줄 영문 브랜드와 절제된 Control/Surface를 적용했다.
새 Token/Styling Framework/Font/Asset을 추가하지 않고 #251의 semantic 값을 재사용한다.

시안의 사진 Hero·Gallery·가상 객실 Metadata/요금/가용성은 복사하지 않았다.
현재 Route별 업무 메뉴를 유지하므로 시안의 단순한 두 탐색 Link와 같지 않다.
모바일 메뉴는 숨기는 Drawer/Hamburger가 아니라 가용 폭에 따라 줄바꿈하는 전체 메뉴다.
달력은 기존 비모달 펼침, Booking/변경/취소 확인은 기존 인라인 패널이다.
실제 Modal은 기존 Room 상세뿐이며 사진 없이 API 제공 필드만 표시한다.

## 공통 표현과 소유권

| 대상 | 적용 | 보존한 계약 |
|---|---|---|
| Root Header/Footer | CSS R 마크·두 줄 브랜드명, 분리된 Footer 브랜드/문구, Desktop 정렬·Mobile wrap | Link 접근성 이름은 `Reservation Platform`, R은 aria-hidden. Skip Link·Main·기존 경로 유지 |
| Navigation | Active 밑줄/경계, Hover Surface, Navy Focus. Admin Active는 Navy/흰 글자·밑줄, 관리 메뉴 표제 | 익명/USER/ADMIN/인증 확인/재인증/Logout 항목은 기존 AuthProvider가 결정. 메뉴/권한·Logout Handler 변경 없음 |
| Button / Primary Link | 보조 Action Navy 글자·공통 여백; Primary Button/Link의 동일 높이·Padding·Border | Native type/disabled/fieldset·onClick·실제 pending aria-busy 유지. Link를 Submit으로 바꾸지 않음 |
| Input/Select/Textarea/Label | 공통 Control Border/Radius와 작은 Sans Label. 유효하고 편집 가능한 입력만 Hover 강조 | Native date/number/select·Label/오류 연결 유지. readonly/disabled/aria-invalid는 Hover로 정상처럼 바꾸지 않음 |
| Card/Badge/Heading | 공유 Card의 절제된 Control Radius, 상태 Badge의 currentColor 경계, 페이지 표제 구분선 | 역할별 폭·Padding·표제 Level·상태 문구·동적 Class 보존. 성공/취소/오류 의미를 브랜드색으로 합치지 않음 |
| Confirmation | 반응형 Padding·시작 경계; 취소의 Error Border는 유지 | 명시적 동의·미동의 Disabled·실패 후 잠금/GET 확인·자동 재전송 금지 유지 |
| Disabled/Loading/Error/Empty | Disabled 불투명도 1·점선; Loading 점선 시작 경계; Empty 점선·Error solid | 색만이 아닌 기존 상태 문장·role/status/alert·이름·실제 disabled가 기준. 가짜 Progress/자동 Retry 없음 |
| 날짜/인원 | 달력 Card·경계일 밑선·표 내부 Scroll, 월 이동 Auto-fit, Stepper의 Secondary 버튼 | 날짜 산술·미리보기/적용·Escape·키보드 Roving·정원·Raw 입력·조회 무효화는 기존 로직 그대로 |
| Room Modal/Sheet | Secondary Header·Navy Backdrop, 공통 Control 표현 | Dialog/ID 검증·선택 조건·Focus 순환/복귀·Scroll Lock·Back/Forward 계약 유지 |
| 표 | 가격/재고의 기존 이름 있는 Keyboard Scroll, 달력에도 별도 이름 있는 표 Scroll | 문서 Overflow 숨김·값 생략·강제 Font 축소로 통과시키지 않음 |

표현은 `src/index.css`, 값은 기존 `src/styles/tokens.css`다. RootLayout/AdminLayout은 표시 Markup만
바꿨고 StayDateCalendar에는 표를 감싸는 Labelled Region/tabIndex만 추가했다.
API/DB/Auth/Domain/Retry/Submit Gate·오류 복구를 공통 Form 상태로 옮기지 않았다.
LoadingState/ErrorState/EmptyState의 로직은 수정하지 않았다.

## 실제 Browser에서 확인한 보완

1. Search의 일반 `p[role=status]` 규칙이 공통 Loading의 경계를 덮는 Cascade를 확인했다.
   일반 탐색/예약 성공 Feedback Selector에서 `.ui-state`를 제외해 공통 상태 외형과 업무 Feedback을 분리했다.
   최종 Loading은 dashed/status, Error는 solid/alert이며 Empty의 상태 문장 Live Region도 유지한다.
2. 320px·200% 글자 확대에서 중첩 Form 안의 열린 달력은 client107/scroll144px였다.
   좁은 월 이동 Control의 Padding/Auto-fit과 중첩 Card/Form의 가로 여백을 조정하고, 날짜 표는
   최소 14rem과 이름 있는 내부 Scroll Region을 사용하도록 했다. 최종 달력205/205,
   월 이동189/189, 문서305/305px다. 날짜 표는 189px 안에서 448px를 Scroll하며
   ArrowRight 0→40px·3px Navy Focus를 확인했다. 기본 390px에서는 달력323/323px로 내부 넘침이 없다.
   넓이가 부족할 때 글자를 겹치거나 줄여 숨기지 않는다. 추가 Region은 Tab으로 접근할 수 있지만
   Grid의 Roving Tab Stop·날짜 키보드 Handler는 그대로다.

이 두 문제는 Source/DOM 테스트만으로 실제 Cascade·Layout을 증명할 수 없음을 보여준다.
기존 #231/#232의 수치와 캡처는 당시 기록으로 보존했다.

## 자동 검증

기존 `routes.test.tsx`의 브랜드 접근성 이름/Skip/Main/Footer, `adminRoutes.test.tsx`의 메뉴 이름·단일 Active,
`StayDateFields.test.tsx`의 명명된 Scroll/기존 Focus 계약을 보강했다.
`designTokens.test.ts`에 Navigation·Disabled/State·Calendar 외형 계약 두 건을 추가했다.
기존 UiStates와 날짜/인원/Room 세부 Suite, Auth/Booking/예약관리/Admin Lifecycle Suite를 재사용했다.
중복 통합 Suite·새 Framework·테스트 삭제/skip은 없다.

`frontend/`에서 실행:

```powershell
pnpm install --frozen-lockfile --offline
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
```

- 집중 7개 Suite/99개 성공. 최종 전체 **76개 파일·1,085개 테스트**와 위 검사 모두 성공했다.
- 검증 중 테스트 Locator의 지원하지 않는 `exact` 옵션을 Typecheck가 발견해 제거한 뒤 전체 재실행했다.
- Dependency/Lockfile/환경변수/실행 명령/Workflow 변경 없음. Backend 변경이 없어 Backend Test/Build는 미실행.

## Browser 증거와 한계

computer-use 스킬로 [기존 읽기 전용 Audit](../../frontend/scripts/ui-audit/README.md)의 실제
App Component/CSS를 렌더링했다. [측정 요약](evidence/252/measurements.json)과 PNG는 Fixture 증거다.
실 Backend/Google/DB/Volume을 사용하거나 생성/변경/취소/Admin 저장을 실행하지 않았다.

- 15 Ready Route × 320/390/768/1440 = **60조합**: 실제 본문·로딩 완료·역할별 Header/Admin 메뉴·
  실제 Active와 문서 가로 넘침을 검사했다. 모든 Header Navigation 항목의 높이는 44px 이상이었다.
- 200% 글자/rem 확대: Home/Search/Detail/예약 상세/재고 × 320/390/1440 = **15조합**.
  root32px·실제 내용·문서 넘침 없음을 확인했다. 열린 달력/Sheet는 별도 상호작용으로 검사했다.
- 긴 이름/설명/이메일·큰 요금: Search/Detail/예약 상세/Admin Room 편집 × 세 폭 = **12조합**.
- Search Loading/Error/Empty·완료 Cancelled × 390/1440 = **8조합**. 상태 표시·문서 폭 유지.
  이 95조합은 전체 Pixel Diff나 모든 폼/운영 조합의 인증이 아니다.
- Login 빈 제출의 이메일/비밀번호 오류와 Tab→비밀번호 Navy Focus를 확인했다.
  390px 달력 ArrowDown으로 01-01→01-08 Focus 이동 시 적용 전 입력값01-01~03은 유지되고,
  Escape는 원래 Trigger로 돌아왔다. Region Scroll을 추가한 뒤에도 이 경계를 재확인했다.
- Room Sheet의 Shift+Tab/Tab 순환·Escape·Trigger 복귀, 390px373/373과 확대320px303/303을 확인했다.
  취소 정책 확인은 GET까지만 실행했다. 인라인 확인 패널은 Red Border·Dialog0개였고,
  미동의 확정 버튼은 Disabled·점선·opacity1로 유지되어 Tab이 건너뛰었다.
- 인원2→1에서 감소 Disabled·점선과 숫자 입력 Focus 복귀를 확인했다. 재고 Region은
  client309/scroll576px 안에서 ArrowRight 0→40px·Navy Focus, 문서는375/375px를 유지했다.
  관찰한 Audit Tab의 Console error/warn은 0건이었다.

대표 화면: [Login Desktop](evidence/252/login-1440.png), [Admin Desktop](evidence/252/admin-1440.png),
[Mobile 오류/Focus](evidence/252/login-error-focus-390.png), [달력](evidence/252/calendar-390.png),
[확대 달력](evidence/252/calendar-expanded-320.png), [Room Sheet](evidence/252/room-sheet-390.png),
[취소 미동의](evidence/252/cancel-confirmation-390.png), [Mobile Admin](evidence/252/admin-390.png).
[재고 키보드 Scroll](evidence/252/inventory-keyboard-390.png)도 별도 캡처했다.
캡처는 필요한 상태가 보이는 Scroll 위치다. 시안의 Header/Control 방향을 반영했지만 Home/검색 카드/
Detail 전체 배치·사진·최종 시각 승인은 아니다.

## CI와 후속 범위

로컬 Windows Node24.14.0/pnpm11.19.0에서 CI와 같은 검사 항목을 통과했다.
Frontend CI의 Ubuntu/Node24.19.0 및 온라인 Install·OS Font까지 동일 조건 검증은 아니다.
선행 PR #261 Head `8418c4b65873802894f8289790c34c4a08da42fc`의
[Frontend CI](https://github.com/K4RF/reservation-platform/actions/runs/40345965420/job/121652838642)·
[Backend CI](https://github.com/K4RF/reservation-platform/actions/runs/40345965463/job/121652840193)는 성공했다.
이는 #252 변경의 CI가 아니다. 요청은 로컬 Commit까지이며 Push/PR·이번 원격 CI는 미실행이다.

실제 Browser Zoom 200/400%·실기기 Touch/가상 키보드·Screen Reader·다른 OS/Browser·모든 Hover/UA
표현·전체 WCAG 검수는 이번 결과로 단정하지 않는다. 글자/rem 확대는 실제 Zoom과 다르다.
실 Backend/Google 전체 HTTP Flow와 권한·재고 Race·Mutation 복구 검증도 별개다.
후속 화면 작업은 이 공통 표현과 기존 #241–#244·#231/#232의 안전 계약을 재사용하며,
실 Media/Metadata는 v0.4.1 계약 확인 후 연결한다. f0.6.0 최종 사용자 REVIEW를 자동 완료하거나 새 Issue로 만들지 않는다.
