# Frontend 목적지 자동완성 (#319)

이 문서는 #319의 브라우저 검증 기준입니다. 현재 제출 동작은 [#320 검색 상태](frontend-location-search-state.md)를 따릅니다.

## 동작과 범위

Home과 Search의 `CompactSearchBar`만 `DestinationCombobox`를 표시합니다. Detail의
날짜·인원 컨트롤과 기존 검색 폼의 제출 계약은 변경하지 않습니다.

- [공개 지역 후보 API](../architecture/accommodation-location-suggestions.md)를 Bearer 없이 조회합니다.
  공백을 정리한 입력이 유니코드 코드 포인트 2개 이상일 때 250ms 뒤 요청합니다(원문 최대 UTF-16
  100단위). IME 조합 중에는 요청과 후보 선택을 하지 않습니다. 입력 변경·닫기·언마운트 시
  요청을 취소하고 늦은 응답을 버립니다. 후보 데이터는 현재 조회 결과에만 보관합니다.
- 응답 배열의 상한, 후보 타입, 이름, 국가·도시·지역과 `ACTIVE` 조건을 확인합니다. 행에는
  받은 이름과 국가·부모 도시(도시 후보는 `도시` 유형)만 표시합니다. 고정 목록으로 대체하지 않습니다.
- 입력에 포커스를 유지하고 `aria-activedescendant`로 옵션을 가리킵니다. ↑/↓로 탐색,
  Enter로 활성 후보 선택, Esc·Tab·입력 밖 포인터 조작으로 닫습니다. 활성 후보가 없는 Enter는
  기존 검색을 막지 않습니다. 로딩·빈 결과·오류는 알리되 입력·제출을 막지 않습니다.
  [WAI-ARIA Combobox Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/)의 수동 선택 모델을 사용합니다.
- 선택은 표시 이름을 채우고 `onSelect`에 타입·표시 이름·`searchParams`를 전달합니다. 자동 제출은
  하지 않습니다. #319의 명시적 검색에는 기존에 입력한 도시명(`city`)이 사용되며, 선택 뒤
  이 동작을 입력 아래에 표시합니다. 편집하면 선택이 해제됩니다. 자유 입력을 `destination`에,
  후보를 정확한 검색 필터·공유 URL에 적용하는 작업은 #320의 범위입니다.

## 브라우저 재현과 검증 경계

`frontend/`에서 `node scripts/ui-audit/server.mjs`를 실행합니다. 예:
`http://127.0.0.1:5174/?path=%2Faccommodations&media=present&suggestions=ready`.
`path`를 `/` 또는 `/accommodations`, `suggestions`를 `ready`, `loading`, `empty`, `error`로 바꾸고
목적지에 `서울`을 입력합니다. 이 모드는 가상 카탈로그와 후보를 사용하며 실제 Backend에 연결하지 않습니다.

- Chromium에서 승인 원본 A1/Search(Navy & Ivory, Studio 숨김)와 제품 컴포넌트를
  1440×1000 / 390×844에서 비교했습니다. 기존 Hero/검색창 배치는 유지됩니다. 후보는 데스크톱에서
  아래, 점검한 모바일에서는 위로 펼쳐 날짜·인원 버튼을 노출합니다. 목록은 화면 높이에 맞춰
  내부 스크롤을 사용합니다. 로딩·빈 결과·오류·선택 및 Media 있음/없음/실패를 점검했습니다.
- Enter 선택 뒤 입력 포커스와 목록 닫힘, 390px 포인터 선택과 인원 레이어, Esc·Tab,
  390×470 및 320px·200% 글자 확대에서 후보 가로 넘침이 없음을 확인했습니다. 짧은 뷰포트는
  모바일 키보드 공간의 근사이며, 실기기 키보드·터치 또는 스크린리더 검증은 아닙니다.
- Vitest에서는 요청 검증, IME 이벤트, 취소·응답 역전, 키보드/포인터, 검색 미제출 및 Home/Search
  회귀를 확인합니다. 브라우저 캡처는 검토용이며 Git에 포함하지 않습니다.
