# #284 브라우저 캡처

[검증 결과와 인계](../../frontend-ui-integration-verification-284.md) ·
[승인 시안](../../approved-design.md) ·
[시안 자산 출처](../../prototypes/premium-travel/ASSETS.md)

## 승인 시안 ↔ 제품 라우트

각 셀은 **첫 Viewport / 전체 페이지**입니다. 데스크톱은 1440×900, 모바일은 390×844
CSS Viewport의 맨 위에서 시작했습니다. 시안의 검토 도구·데모 컨트롤을 숨겼고
제품은 실제 라우트를 **HTTP Fixture**에 연결했습니다. 두 쪽에서 같은 출처의 AI 사진을
사용했습니다. 브라우저 스크롤바 영역 때문에 이미지 파일 폭은 CSS Viewport보다 작을 수 있습니다.
검색 결과 건수와 일부 상품 정보의 차이는 [비교 보고서](../../frontend-ui-integration-verification-284.md#화면-비교)에서 설명합니다.

| 화면 | 1440 시안 | 1440 제품 | 390 시안 | 390 제품 |
| --- | --- | --- | --- | --- |
| Home | [Viewport](home-reference-1440.jpg) / [전체](home-reference-1440-full.jpg) | [Viewport](home-app-1440.jpg) / [전체](home-app-1440-full.jpg) | [Viewport](home-reference-390.jpg) / [전체](home-reference-390-full.jpg) | [Viewport](home-app-390.jpg) / [전체](home-app-390-full.jpg) |
| Search | [Viewport](search-reference-1440.jpg) / [전체](search-reference-1440-full.jpg) | [Viewport](search-app-1440.jpg) / [전체](search-app-1440-full.jpg) | [Viewport](search-reference-390.jpg) / [전체](search-reference-390-full.jpg) | [Viewport](search-app-390.jpg) / [전체](search-app-390-full.jpg) |
| Detail | [Viewport](detail-reference-1440.jpg) / [전체](detail-reference-1440-full.jpg) | [Viewport](detail-app-1440.jpg) / [전체](detail-app-1440-full.jpg) | [Viewport](detail-reference-390.jpg) / [전체](detail-reference-390-full.jpg) | [Viewport](detail-app-390.jpg) / [전체](detail-app-390-full.jpg) |

## 상태와 레이아웃

| 화면 | 사진 없음 (390) | 이미지 요청 실패 (390) | 긴 문구·텍스트 200% (320) |
| --- | --- | --- | --- |
| Home | [없음](home-missing-390.jpg) | [실패](home-failed-390.jpg) | [320px](home-320-text200.jpg) |
| Search | [없음](search-missing-390.jpg) | [실패](search-failed-390.jpg) | [320px](search-320-text200.jpg) |
| Detail | [없음](detail-missing-390.jpg) | [실패](detail-failed-390.jpg) | [320px](detail-320-text200.jpg) |

- Detail: [Desktop Sticky Rail](detail-sticky-1440.jpg) ·
  [Mobile에서 일정 적용 후 객실 목록으로 이동](detail-mobile-cta-focus-390.jpg) ·
  [짧은 Viewport·텍스트 200% 날짜 레이어](date-short-text200-390.jpg)

## 실제 Backend 연결

브라우저에서 Vite → 격리 Spring Boot → 일회용 MySQL·Redis/파일 저장소로 연결했습니다.
등록한 사진·숙소·사용자·예약은 검증 전용입니다. 아래 사진은 순서대로 같은 카탈로그를 보여줍니다.

1. [ADMIN 대표 사진 설정](real-admin-representative.jpg) →
   [Home](real-home.jpg) / [Search](real-search.jpg) →
   [Detail](real-detail.jpg) / [숙소 Gallery](real-gallery.jpg) / [Room Gallery](real-room-gallery.jpg)
2. [로그인 및 가용 객실 재조회 후 Booking](real-booking.jpg) →
   [서버에서 저장된 예약 완료](real-booking-complete.jpg) →
   [본인 예약 목록](real-reservations.jpg) / [본인 예약 상세](real-reservation-detail.jpg)
