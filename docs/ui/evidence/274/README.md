# #274 프레임 Browser 증거

2026-10-30, IAB, 실제 AppRoutes/AuthProvider/CSS + UI Audit Fixture GET.
모든 저장 이미지는 브라우저가 반환한 JPEG다. 사진/가격/상태는 실제 운영 데이터가 아니다.
원본은 `docs/ui/prototypes/premium-travel/`의 A1/Navy & Ivory다.

## 상단 같은 위치 비교

원본 Mobile은 Studio 도구 72px을 제외한 375×772px Clip이다.
앱 Mobile 비교본도 같은 375×772px 영역이다. Desktop 비교본은 1400×800px이며,
원본은 Studio 54px을 제외하고 앱은 문서 상단부터 시작한다.
Viewport 자체는 각각 390×844 / 1440×900으로 유지했다.

| 화면 | 원본 1440 | 앱 1440 | 원본 390 | 앱 390 | 앱 390 메뉴 |
| --- | --- | --- | --- | --- | --- |
| Home | [원본](reference-home-1440.jpg) | [구현](home-1440-comparison.jpg) | [원본](reference-home-390.jpg) | [구현](home-390-comparison.jpg) | [메뉴](home-390-menu.jpg) |
| Search | [원본](reference-search-1440.jpg) | [구현](search-1440-comparison.jpg) | [원본](reference-search-390.jpg) | [구현](search-390-comparison.jpg) | [메뉴](search-390-menu.jpg) |
| Detail | [원본](reference-detail-1440.jpg) | [구현](detail-1440-comparison.jpg) | [원본](reference-detail-390.jpg) | [구현](detail-390-comparison.jpg) | [메뉴](detail-390-menu.jpg) |
| Login | 독립 원본 없음 (#271 구성안) | [구현](login-1440-comparison.jpg) | 독립 원본 없음 | [구현](login-390-comparison.jpg) | [메뉴](login-390-menu.jpg) |

가상 Gallery와 현재 Placeholder의 차이는 Frame 오류가 아니라 #276/#279의 남은 범위다.

## 전체 Viewport와 Footer

각 `home`, `search`, `detail`, `login`에 대해 다음 파일이 있다.

- `{화면}-1440-viewport.jpg`, `{화면}-390-viewport.jpg`: 자르지 않은 상단 Viewport.
- `{화면}-1440-footer.jpg`, `{화면}-390-footer.jpg`: Footer 문구까지 실제 스크롤한 Viewport.
  Mobile Footer top은 약 744–745px, bottom은 약 844px이었다.
- `admin-role-390-menu.jpg`: 가상 ADMIN 역할에서 실제 링크·현재 위치.
- `home-390-text200.jpg`, `home-390-text200-menu.jpg`: 루트 글자 200%, Header 144px,
  Menu 높이 780px 제한과 내부 스크롤. Native Browser Zoom 결과가 아니다.
- `home-390-skip-focus.jpg`: Tab으로 Skip Link에 도달한 화면.

전체 페이지 캡처 API/문서 높이 Clip은 실패했다. 위 Footer 사진을 전체 페이지 사진으로
표현하거나 중간 모든 상태가 촬영되었다고 해석하지 않는다. 1440px은 직접 Navigation을
사용하므로 Menu-open 사진이 없고, 390→1440 전환의 메뉴 해제/Brand Focus를 검증했다.

## 재현

```shell
# 저장소 루트에서 원본
node docs/ui/prototypes/premium-travel/serve.cjs
# 별도 터미널, frontend/에서 실제 UI 읽기 전용 점검
node scripts/ui-audit/server.mjs
```

원본은 `http://127.0.0.1:4381/index.html`, 앱은 `http://127.0.0.1:5174/`다.
`path` Query에는 다음 경로를 URL 인코딩해서 사용했다.

- Home `/`
- Search `/accommodations?city=서울특별시`
- Detail `/accommodations/7?checkInDate=2030-01-01&checkOutDate=2030-01-03&guestCount=2`
- Login `/login`

기본 익명/ready Fixture, 역할 메뉴는 `role=ADMIN`, 확대는 `textScale=200`이다.
실제 비밀번호/Guest/Token/DB를 사용하지 않았고 업무 쓰기는 시도하지 않았다.
원본 Studio/가상 데이터는 앱으로 복사하지 않았다.
[변경·검증 보고서](../../frontend-consumer-frame-274.md)의 미확인 범위를 함께 읽는다.
