# Accommodation Location and Amenity Catalog

## Location Model

숙소 위치는 `country`, `city`, `region`, `address` 네 필드로 관리합니다. 기존
`address` 컬럼과 API 필드는 상세 주소로 계속 사용하여 기존 데이터와 Client의
필드명을 보존합니다. 신규 등록·수정 API는 네 값을 모두 요구합니다.

업그레이드 전 숙소의 `country`, `city`, `region`은 정확한 값을 원본 주소에서
안전하게 분리할 수 없으므로 `NULL`로 유지합니다. 구조화된 행의 도시와 지역 검색은
trim 후 대소문자를 구분하지 않는 정확 일치입니다. 레거시 행은 `region IS NULL`일
때에만 기존 `address` 부분 검색을 적용합니다. 정확 일치는 MySQL의 설정된 문자열
Collation을 따릅니다. 지도 좌표와 GIS 반경 검색은 이
단계의 범위가 아닙니다.

## Amenity Ownership

편의시설은 고정 enum과 Entity별 Element Collection으로 관리합니다.

- 숙소 공용 편의시설: `PARKING`, `BREAKFAST`, `POOL`, `GYM`, `PET_FRIENDLY`
- 객실 전용 편의시설: `WIFI`, `AIR_CONDITIONER`

숙소와 객실의 편의시설은 각각 `accommodation_amenities`, `room_amenities`에
저장합니다. Entity와 편의시설 조합에는 UNIQUE 제약을 두며, 부모가 삭제될 때
Collection 행도 함께 제거됩니다. 별도 편의시설 관리 API 대신 기존 숙소·객실
등록 및 전체 정보 수정 요청에서 목록 전체를 교체합니다.

## Search Policy

`GET /api/v1/accommodations`는 `city`, `region`, `accommodationAmenities`,
`roomAmenities`를 지원합니다. `GET /api/v1/accommodations/{id}/rooms`는
`amenities`를 지원합니다. 복수 편의시설은 모두 `AND`로 처리합니다.

숙소 통합 검색의 객실 편의시설, 인원, 가격, 상태와 재고 조건은 서로 다른 객실에
나뉘어 만족해도 안 됩니다. 하나의 `ACTIVE` 객실이 요청한 객실 조건 전체를
만족해야 해당 숙소를 반환합니다.
