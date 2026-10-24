# Premium Travel — 승인 디자인 참조 시안

[승인 디자인 기준](../../approved-design.md)을 먼저 읽는다.
2026-10-22 독립 시안을 2026-10-24 저장소에 인계한 파일이며 Production 앱이 아니다.

- **Home A1 + Navy & Ivory**가 승인 방향이다.
- Search는 검색, Detail은 숙소 상세에 함께 사용한다.
- A2와 Blue/Charcoal 배색은 비교 보관안이며 선택된 목표가 아니다.
- 개별 폰트/카피/달력 조작·Modal/Sheet까지 최종 승인된 것은 아니다.
- 사용자 직접 최종 검수는 f0.6.0이다.

## 실행

`index.html`을 Chrome/Edge에서 직접 연다. 상단 도구로 화면을 전환한다.
`review.html`은 Desktop/Mobile·팔레트·달력·객실 상세 캡처 비교 보드다.

서버가 필요하면 이 디렉터리에서 실행한다. 서비스 앱·DB는 필요 없다.

```shell
node serve.cjs
```

`http://127.0.0.1:4381`로 접속하고 Ctrl+C로 종료한다.
다른 포트는 `PROTOTYPE_PORT` 환경변수로 지정한다.

## 범위

Home → 날짜 선택 → 인원 −/+ → Search → Detail → 객실 상세 → 선택 → 예약 확인.
실제 인증/예약 API는 연결하지 않으며 CSP `connect-src 'none'`으로 통신을 차단한다.
모든 사진·숙소명·정원·가격·가용성·운영시간은 가상이다.
수영장 필터·상태 전환은 시연용이며 기타 필터/정렬/Pagination은 시각 예시다.
여러 가상 숙소의 상세 링크는 대표 Detail 하나로 연결된다.

Prototype 코드/데이터를 Production으로 통째 복사하지 않는다. 간략한 날짜·가격·상태 관리가
기존 Auth/Booking/Reservation 로직을 대체하지 않는다. 정책·미디어 API 구현 증거가 아니다.
사진·스크린샷 출처는 [ASSETS.md](ASSETS.md)를 따른다.
캡처는 실제 Edge 렌더링이지만 Production 회귀·전체 접근성·사용자 최종 승인 근거가 아니다.
