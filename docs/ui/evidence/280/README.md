# #280 Browser 증거

2026-11-04, 기준 `develop ecb0802` + #280 작업 트리. 모든 데이터·인증은 격리 UI Audit Fixture.
AI 콘셉트 사진은 실제 시설 근거가 아니며 출처/권리는 [원본 ASSETS](../../prototypes/premium-travel/ASSETS.md)를 따른다.
실제 계정/예약/DB/토큰을 저장하거나 조작하지 않았다. 입력은 가짜 `demo@example.com` 등이다.

CSS Viewport는 파일명1440=1440×900,390=390×844,320=320×568이다.
`short-height`만390×400, `enlarged`는 root 글자200%다. Browser Zoom/실기기 키보드 검증은 아니다.
JPG export는 보통1425×891/375×812/305×541, full-page는 client 폭/전체 문서 높이다.
`failure-390.jpg`는390×844 export다. Viewport/Raster 차이는 캡처 도구의 스크롤바/내보내기 동작이며
이미지를 인위적으로 자르거나 리사이즈하지 않았다.

| 상태 | Desktop | Mobile |
| --- | --- | --- |
| 변경 전 실제 입력 | [Viewport](before-input-1440.jpg) · [전체](before-input-1440-full.jpg), scrollY1357 | 신규 변경 전 캡처 없음 |
| 원본 Detail 언어 참조 | [1440](reference-detail-1440.jpg), scrollY0 | Booking 독립 원본 없음 |
| 입력 · Media 정상 | [Viewport](input-1440.jpg) · [전체](input-1440-full.jpg) | [Viewport](input-390.jpg) · [전체](input-390-full.jpg) |
| 검토 | [Viewport](review-1440.jpg) · [전체](review-1440-full.jpg) | [원점](review-390.jpg) · [Focus](review-focus-390.jpg) · [전체](review-390-full.jpg) |
| 결과 불명 합성500 | [원점](failure-1440.jpg) · [전체](failure-1440-full.jpg) | [오류 Focus](failure-390.jpg) · [전체](failure-390-full.jpg) |
| 완료 owner GET Fixture | [Viewport](complete-1440.jpg) · [전체](complete-1440-full.jpg) | [Viewport](complete-390.jpg) · [전체](complete-390-full.jpg) |
| 입력 · Media 미제공 | [Viewport](media-missing-1440.jpg) · [전체](media-missing-1440-full.jpg) | [Viewport](media-missing-390.jpg) · [전체](media-missing-390-full.jpg) |
| 입력 · Media404 | [Viewport](media-failed-1440.jpg) · [전체](media-failed-1440-full.jpg) | [Viewport](media-failed-390.jpg) · [전체](media-failed-390-full.jpg) |
| 완료 · Media 미제공 | [1440](complete-media-missing-1440.jpg) | [390](complete-media-missing-390.jpg) |
| 완료 · Media404 | [1440](complete-media-failed-1440.jpg) | [390](complete-media-failed-390.jpg) |

보조 관찰: [대기 잠금390](pending-390.jpg), [검증 오류390](validation-390.jpg),
[오류320](validation-320.jpg), [200% 오류320](enlarged-320.jpg),
[200% 표 Focus320](price-table-enlarged-320.jpg), [짧은 높이390](short-height-390.jpg).

입력/검토/완료 Viewport는 원점scrollY0. Focus/오류 캡처는 해당 요소로 이동한 위치다.
full-page 촬영은 Viewport 밀도 비교를 대체하지 않는다. 같은 원점 Viewport와 전체를 따로 비교한다.
Booking 독립 원본이 없으므로 원본 Detail은 색·서체·사진 언어 참조이지 같은 화면 비교가 아니다.

## 재현

`frontend`에서 `node scripts/ui-audit/server.mjs`를 실행한다. 원본 비교 보드는
`docs/ui/prototypes/premium-travel`에서 `node serve.cjs` 후 `http://127.0.0.1:4381/review.html`로 열었다.

Audit 초기 URL:

```text
http://127.0.0.1:5174/?path=%2Faccommodations%2F7%3FcheckInDate%3D2030-01-01%26checkOutDate%3D2030-01-03%26guestCount%3D2&role=USER&media=present
```

스탠다드 선택 → 예약 정보 입력 → 가짜 Guest 입력 → 확인. 각 상태에서 촬영한다.
`media=missing|failed`로 새로 진입하면 사진 없음/404를 재현한다.
`booking=ambiguous`는 명시적 생성 뒤5초 대기/합성500, `booking=success`는 고정201 뒤 완료 GET이다.
기본 옵션에서는 쓰기405다. 모든 요청은 Fixture 내부에서 끝나며 실제 Backend로 전달되지 않는다.
완료 직접 읽기는 `path=%2Freservations%2F42%2Fcomplete&role=USER&media=present`로 재현한다.
초기 Query는 MemoryRouter의 현재 Route를 추적하지 않는다. 자세한 한계는 [#280 보고서](../../frontend-booking-rebuild-280.md)에 있다.
