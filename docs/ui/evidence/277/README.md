# #277 Browser evidence

2026-11-03. **격리 UI Audit Fixture**와 승인 A1 원본 비교다. 실제 매물·요금·Backend E2E가 아니다.
코드/테스트/측정 차이와 한계는 [#277 보고서](../../frontend-home-rebuild-277.md)를 따른다.

실행: frontend에서 `node scripts/ui-audit/server.mjs`. 참조 원본은
`http://127.0.0.1:5174/__reference/index.html?view=a1&palette=navy`다.
원본 파일은 그대로 읽고 외부 capture.css로 Studio만 숨긴다. CSP는 유지한다.
제품 정상은 `http://127.0.0.1:5174/?scenario=comparison&media=present`다.
사진 2001/2002는 승인 시안의 **가상 콘셉트**이며 DB/storage에 등록하지 않았다.

- `reference-*`: Studio 제외 A1 첫 Viewport/전체 페이지. 전체 페이지는 `reference-full-*`.
- `before-*`: develop c172ef3의 #276 Home. 기존 building-free Hero/일반 결과 카드 비교용 기록.
- `after-*`: #277 첫 Viewport/전체 페이지. 사진은 실제 스크롤로 lazy load 후 확인했다.
- `exploration-*`: 실제 사진 탐색과 키보드 focus. 둘째 카드의 outline은 초점 표시다.
- `hero-failed-390`: `scenario=comparison&media=partial&hero=failed`, 장식용 WebP404 fallback.
- `media-partial-390`: 같은 조건에서 첫 사진 정상, 두 번째2999파일404. 링크/제목 유지.
- `media-missing-390`: `scenario=comparison&media=missing`. 가상 fallback 없이 작은 미제공 안내.
- `catalog-empty/error/loading-390`: 해당 scenario 안내를 화면에 스크롤해 촬영했다.
  loading은 apiClient Timeout 전 관찰이며 무기한 로딩 API를 뜻하지 않는다.
- `date-dialog-390`: Hero 위 날짜 Dialog. Escape 후 focus/scroll 복구는 states.json.
- `narrow-320`: `scenario=stress&media=present`, 320px의 긴 실제 계약 필드 Fixture.
- `text-200-390`: 같은 stress, `textScale=200`, root font32px. Browser Zoom/실기기 확대와 다름.
- `text-200-search-390`: 확대 상태에서 Tab으로 검색 CTA에 진입한 실제 초점/스크롤 화면.
- `measurements.json`: 정상 Viewport 1440×900 / 390×844, scrollY=0의 DOM rect/사진 로드 상태.
- `states.json`: 표시 상태, 320/200% 폭, Escape/미적용 초안/focus/scroll-lock 관찰.

IAB export가 스크롤바를 제외하거나 이미지 크기/전체 페이지 배치를 재조정하므로
파일 canvas와 CSS Viewport 치수가 항상 같지 않다. full-page의 원본 Mobile은390px,
제품은375px 콘텐츠 canvas다. 첫 Viewport DOM 실측과 전체 흐름을 함께 비교한다.
화면은 최종 사용자 승인, 실제 API 권한/동시성/Media 업로드 또는 실기기 E2E의 증거가 아니다.
