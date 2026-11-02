# #276 Browser evidence

2026-11-03(Asia/Tokyo), base develop `e12df39`. API-origin PNG 파일 로딩까지 실제 Browser에서
확인했지만 데이터는 `frontend/scripts/ui-audit` fixture다. Production bundle/개발 DB에 시안
사진을 넣지 않았다. `media=present|missing|failed|partial` 사용, 업로드/쓰기 요청은405로 차단한다.

- `home/search/detail-present-{1440,390}.jpg`: 정상 사진 viewport, scroll top.
- `*-present-full-*.jpg`: 같은 실제 React route의 full-page. Home 하단은 lazy 사진을
  가시화한 뒤 Header로 돌아와 캡처했다. Search는 city만, Detail은 Nov12–14/전체2명이다.
- `gallery-*.jpg`, `room-*.jpg`: 실제 native Dialog/모바일 Sheet 또는 기존 Room Dialog.
  trigger 자동 가시화로 배경 scrollY는 top 캡처와 다르다. 열기/닫기 전후 동일 scrollY와
  trigger 초점 복귀를 확인했다(Desktop Gallery 샘플 scrollY372).
- `detail-missing/failed/partial-*.jpg`, 해당 `full` 파일: 없으면 짧은 fallback,
  실패한 저장 파일은 원래 frame을 유지한다. 다른 대표로 자동 전환하지 않는다.
- `gallery-partial-390.jpg`: 둘째 파일404에서도 순서/닫기/다른 사진 탐색 가능.
- `gallery-partial-longalt-text200-320.jpg`: 320×568, root font200%, 긴 alt와 파일404.
  내부 스크롤 footer에서 사용 가능한 이전 버튼 초점을 확인한 장면이다.
- `admin-media(-full)-*.jpg`: ADMIN album GET/ETag fixture를 연 사진 관리 화면.
  실제 업로드/쓰기 성공 증거는 아니다. 새 폼은 JPEG/PNG 파일·metadata·동의 후 제출한다.
- `admin-room-text200-320.jpg`: 검증된 Room3/Accommodation7, 긴 alt와200% 글자,
  320×568에서 metadata 입력의 초점·문서 넘침 없음(305/305px)을 확인했다.
- `prototype-detail(-full)-*.jpg`: 원본 Studio 54/72px를 뺀 비교 clip이다.
  원본 자체의 demo note는 남아 있으며 제품 비교 시 제외해야 한다.
  [기존 Home/Search 원본 캡처](../275/README.md)도 함께 사용했다.

표기 폭은1440×900/390×844 CSS viewport, 스크롤바 제외 app client 폭은 대체로1425/375다.
원본 cropped viewport 높이는846/772로 제품 viewport900/844와 다르다.
원점은 Studio를 뺀 app top이며 전체페이지 길이/소수 좌표/서체는 golden test가 아니다.

AI 사진 두 장은 ASSETS.md의 콘셉트 이미지다. 서울 호텔/스탠다드 등은 테스트 이름이며
이미지가 그 시설/객실을 입증하지 않는다. 실제 HTTP4 tests와 사진 권리·Browser 업로드 E2E
및 원격 CI 한계는 [보고서](../../frontend-media-integration-276.md)에 구분했다.
