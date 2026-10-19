# Frontend Design Tokens / Global Style (#225)

## 범위와 적용 경로

#224 Audit이 병합된 `develop` (`accc4f0`)에서 시작했다. 기존 녹색/밝은 배경을 유지하며
Token·전역 기본값·Cascade만 정리했다. API/State/Route/Component 업무 코드는 변경하지 않았다.
UI Framework, 외부 Font, Dark Mode, 환경변수, Dependency, 실행 명령과 CI 설정도 추가하지 않았다.

```text
main.tsx / scripts/ui-audit/entry.tsx
  → src/index.css
    → @import './styles/tokens.css'
    → 전역 기본값
    → 기존 Layout / 화면별 규칙
```

[tokens.css](../../frontend/src/styles/tokens.css)가 변수의 유일한 선언 위치다.
[index.css](../../frontend/src/index.css)는 의미별 변수를 소비하며 색상 직접값을 갖지 않는다.
기존 `--accent/--ink/--line`은 저장소 내 외부 소비자가 없어 새 역할 이름으로 교체했다.
같은 값이어도 `on-primary`와 `surface`, `success`와 `cancelled`처럼 의미가 다르면 별도 역할을 유지한다.
변수 이름의 중복 선언이나 화면별 재정의는 하지 않는다.

## 기준과 사용 규칙

| 역할 | Token / 값 | 적용 기준 |
| --- | --- | --- |
| Primary | `--color-primary` #17675f / hover #124e48 / on-primary #fff | 기존 강조 Link·예약/인증 Submit, 새 업무 Action을 추가하지 않음 |
| Secondary | `--color-secondary` #edf2eb / hover #dce5df / on-secondary #173a39 | 선택된 Navigation·Table Header 등 보조 Surface. 모든 보조 Button을 이번에 재디자인한 것은 아님 |
| 배경·Surface | background #f7f8f4 / surface #fff / surface-hover #f3f6f1 | 페이지·카드·중립 Hover를 구분 |
| Text | text #173a39 / muted #4b5563 / subtle #536760 | 본문·보조 문단·Footer/메타. `#172033`, `#52675f`의 유사 역할 통합 |
| Border·Focus | border #dce5df / border-control #9ba8b9 / focus=primary | 장식선과 입력 경계를 분리. 기존 #dbe2ec 장식선을 border로 통합 |
| Success·Error·Warning | success #205c4d/#e2f3ed, error #b42318/#fff1ef, warning #854d0e/#fef3c7 | 앞/뒤는 text/surface. CONFIRMED와 Field Error는 기존 의미 유지. Warning과 Error Surface는 후속 공통 Feedback용 기준만 정의했으며 새 경고 UI를 만들지 않음 |
| 취소 상태 | cancelled #655044/#f2ece7 | CANCELLED는 오류·환불 완료가 아니므로 별도 상태 역할 유지 |
| 장식 | hero-highlight / catalog-pattern | 기존 Gradient 유지. 실제 숙소 사진이 있다고 오인할 새 Asset 없음 |
| Font | `--font-family-body`: system-ui, sans-serif | 외부 Font 요청 없음; root 100%, body 1rem으로 브라우저 기본 글자 크기 존중 |
| 크기 | xs .75 / sm .85 / base 1 / brand 1.1 / lg 1.2 / xl 1.5 / 2xl 2rem | h1=2xl, h2=xl, h3=lg. 기존 Home/Card의 역할별 작은 제목은 유지 |
| Display | display-min 1.7rem / display-max 3rem | 기존 Hero clamp의 양 끝값, 화면 너비 보간 유지 |
| Weight | regular 400 / semibold 600 / strong 650 / bold 700 / display 750 | 본문·Label/Action·Link·Heading·Hero 역할 |
| Line Height | heading 1.25 / display 1.35 / body 1.5 / description 1.6 / long 1.7 / guide 1.8 | 기본 normal 대신 명시. 기존 긴 설명의 별도 행간 유지, 모든 문단을 같은 높이로 강제하지 않음 |
| Spacing | space-1/2/3/4/5/6/8/12/16 = .25/.5/.75/1/1.25/1.5/2/3/4rem | gap·margin·padding 재사용. 음수 Card Margin도 같은 변수 기준 |
| Control 예외 | inset-control .65 / auth-action .7 / action-inline 1.1 / badge .4rem | 기존 치수 보존용 역할값. #226에서 공통 Control 디자인을 정할 때 함께 검토 |
| Radius | sm .35 / control .6 / card 1 / hero 1.5rem | 기존 크기 보존, 모든 요소를 동일 Radius로 강제하지 않음 |
| Shadow | none / raised `0 12px 35px #173a3910` | 기본 카드의 Border 유지, raised는 기존 Home 검색 Surface 한 곳. 모든 카드에 Shadow를 추가하지 않음 |
| Content Width | auth 28 / form 32 / result 45 / reservation 60 / wide 70rem | Auth·대표 투숙객 Form·완료·예약·Catalog/Admin의 역할별 최대 폭 유지 |

Media Query 40/48/60rem은 그대로다. CSS 변수로 Media Query 조건을 치환하지 않는다.
Grid Track, Calendar 최소 폭 36rem, textarea 높이, Gradient 패턴 간격 등 개별 기하 값은
전역 Spacing Token과 혼동하지 않고 기존 규칙에 남겼다. 새 Token은 기존 역할 재사용을 먼저 검토한다.

## Cascade 정리와 의도된 차이

- 전역 box-sizing/body/Heading/Link/Button/Focus 기본값을 파일 앞에 모았다.
  구체적인 Admin/인증/검색 Control 규칙이 뒤에 오며 기존 specificity를 유지한다.
- `.site-brand`, `.home-link`, 인증 Container/Button/Hover, Card Heading/Link의 떨어진 선언을 합쳤다.
  인증 Button의 과거 어두운 기본값과 뒤쪽 녹색 덮어쓰기를 하나의 선언으로 정리했다.
- Focus의 2px 어두운색/3px 녹색 중복을 **3px 녹색 + 3px Offset** 한 규칙으로 통일했다.
  textarea도 포함하며 Focus를 제거하지 않는다. 40rem Navigation 규칙도 기존 같은 경계 블록에 합쳤다.
- 기본 본문 행간 1.5와 Heading 행간 1.25를 명시하므로 일부 문서 높이는 의도적으로 달라진다.
  화면의 폭·배치 전략·예약 확인 문구/명시적 동의·disabled/쓰기 잠금 규칙은 바꾸지 않는다.
- 보조 회색/테두리/Hover의 유사 색을 역할별로 통합했다. Native Input/Select/Button의 모든 UA 표현을
  제거한 것은 아니다. 특히 Admin Button/예약 fieldset 상세 모습은 #226/#229/#230 범위다.

## 검증 (2026-10-19, Asia/Tokyo)

[측정 원본](evidence/225/measurements.json)은 최종 CSS의 **33개 Fixture 렌더링**과 Focus 기록이다.
1440×1000 / 390×844에서 Home/Auth/Search/Detail/완료/본인 예약/Admin 홈·객실·가격·재고를
점검하고, Mobile CANCELLED/Error/Empty/Forbidden, 320px Home/재고, 768px Home/Admin을 샘플로 확인했다.
대표 가시 영역 이미지 7장을 남겼다. 이미지 출력 크기는 스크롤바 제외/도구 축소로 달라질 수 있어
폭 비교는 DOM 값을 사용한다. 전체 Route·모든 Control의 픽셀 승인 완료를 뜻하지 않는다.

- Desktop 폭은 Auth448 / 완료720 / 예약960 / Catalog·Admin1120px로 기존 역할별 기준 유지.
- root는 기본 설정에서 16px / line-height24px, 로그인 h1은 32px / 40px.
  로그인 Input 약46.8px, 로그인/Google Button 모두 약48.4px로 기존 Control 높이 유지.
- 측정한 390px/768px 주요 문서의 `scrollWidth == clientWidth`. Mobile Calendar는
  309px 안에서 576px 내부 스크롤 유지. 미생성 날짜와 점유/CLOSED 표시는 그대로다.
- 이메일에서 Tab으로 이동한 비밀번호 Input에 3px 녹색 Focus와 3px Offset 확인.
  CANCELLED Fixture는 저장 상태의 중립 색을 유지한다.
- `designTokens.test.ts` 6개: 단일 선언/Import, 참조 누락·순환, 색 직접값 방지,
  역할별 폭, 공통 기준·Focus, 중복 Cascade 회귀 검사. CSS Stub을 사용하는 기존 Vitest 설정을 바꾸지 않고
  설치된 Node 타입과 fs로 소스만 검사한다. 실제 CSS Layout은 이 테스트가 아닌 Browser 기록으로 구분한다.
- `pnpm install --frozen-lockfile --offline`, lint, format:check, typecheck, test, build 통과.
  **71 files / 981 tests**, 운영 빌드132개 Module. Dependency/Lockfile/Vite/CI 설정 변경 없음.
  로컬 Node24.14.0/pnpm11.19.0이며 원격 Ubuntu/Node24.19.0 환경과 동일하지는 않다.

대표 화면: [Desktop Login](evidence/225/login-desktop.jpg), [Mobile 예약](evidence/225/reservation-mobile.jpg),
[Mobile Focus](evidence/225/focus-mobile.jpg), [Calendar](evidence/225/inventory-mobile.jpg).

## 남은 범위

#224의 D01(320px에서 문서 15px 넘침)은 여전히 재현되며 #231, D02(완료 Link 간격)는 #228에 남긴다.
공통 UI의 세부 모양은 #226, 화면별 정보 계층·배치는 #227–#230, 전체 대비·Keyboard·Zoom·실기기·
반응형/상태 횡단 검증은 #231, 최종 회귀는 #232다. 이번 녹색 Token 적용은 최종 디자인 승인이 아니다.

브라우저 검증은 기존 읽기 전용 Audit 서버/합성 역할 Hint와 Fixture이며 실제 Backend 인증·Google·쓰기·
DB 동시성/E2E를 입증하지 않는다. Backend/개발 DB/Volume은 사용·변경하지 않았고 Backend 테스트는 실행하지 않았다.
이번 요청은 로컬 커밋까지이므로 원격 CI 성공은 주장하지 않는다. f0.6.0 실제 연동과 사용자 직접 최종 검수도 남는다.
