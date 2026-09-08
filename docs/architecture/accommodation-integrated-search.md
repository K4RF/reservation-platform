# Accommodation Integrated Search

## API Contract

`GET /api/v1/accommodations`는 다음 조건을 모두 선택적으로 조합합니다.

| Parameter | Meaning |
| --- | --- |
| `name` | 숙소명의 대소문자 구분 없는 부분 일치 |
| `city` | 구조화된 도시의 정확 일치(MySQL 문자열 Collation 적용) |
| `region` | 구조화된 지역의 정확 일치(MySQL 문자열 Collation 적용). 구조화 이전 행은 기존 주소 부분 일치 |
| `accommodationAmenities` | 숙소가 모두 보유해야 하는 공용 편의시설(AND) |
| `roomAmenities` | 한 활성 객실이 모두 보유해야 하는 객실 편의시설(AND) |
| `checkInDate`, `checkOutDate` | `[check-in, check-out)` 기간의 날짜별 재고 확인 |
| `guestCount` | 요청 인원 이상을 수용하는 활성 객실 존재 여부 |
| `minPrice`, `maxPrice` | 활성 객실 기본 1박 가격의 포함 범위 |
| `status` | 숙소의 `ACTIVE` 또는 `INACTIVE` 상태 |
| `available` | 해당 기간과 객실 조건에 맞는 예약 가능 숙소 여부 |
| `page`, `size` | 0 기반 Pagination, 크기 1~100 |
| `sortBy`, `direction` | `ID`·`NAME`과 `ASC`·`DESC`만 허용 |

체크인과 체크아웃은 반드시 함께 전달하고 체크인이 체크아웃보다 빨라야 합니다.
날짜만 전달하면 `available=true`로 처리합니다. `available`을 명시할 때도 기간은
필수입니다. `available=true`는 숙소와 객실이 모두 `ACTIVE`이며 모든 숙박일에
재고 행과 잔여 수량이 있는 객실이 하나 이상인 숙소만 반환합니다.
`available=false`는 같은 조건의 예약 가능한 객실이 없는 숙소를 반환합니다.
숙소별 예약 정책이 등록되어 있으면 요청 기간이 최소·최대 숙박일과 최소·최대
사전 예약일을 모두 만족해야 `available=true`입니다. 정책이 없는 숙소는 기존
가용성 조건만 적용합니다.

인원·가격·객실 편의시설 조건은 한 객실이 모두 만족해야 합니다. 서로 다른 객실이 각각 일부
조건만 만족하는 숙소는 결과에 포함하지 않습니다. 숙소 편의시설도 요청한 값을
모두 보유해야 합니다. 가격 범위는 기존 숙소별 객실
검색과 동일하게 객실의 기본 `nightlyPrice`를 기준으로 합니다. 날짜별 가격 또는
숙박 기간 총액을 기준으로 한 검색은 현재 계약에 포함하지 않습니다.

## Query Design

기존 Spring Data JPA Specification을 확장했습니다. 숙소명·도시·지역·공용 편의시설·상태는 숙소
Predicate로 적용하고, 객실·재고 조건은 상관 `EXISTS` Subquery로 적용합니다.
따라서 조건에 맞는 객실이 여러 개여도 한 숙소가 중복 반환되지 않고 Pagination의
전체 개수도 숙소 수를 유지합니다.

가용성은 각 후보 객실에 대해 기간 내 `total_quantity > reserved_quantity`인 재고
행 수가 숙박 일수와 같은지 비교합니다. 재고 행이 하루라도 없거나 품절이면 해당
객실은 예약 가능 후보에서 제외됩니다. 조회 결과와 실제 예약 사이에는 Lock이
없으므로 동시 요청의 최종 가용성은 예약 생성 Transaction에서 다시 검증합니다.

## Index and Execution Plan Review

MySQL 8.4의 현재 Schema와 조회 조건을 기준으로 다음 접근 경로를 사용합니다.

- 숙소명과 레거시 주소의 `LIKE '%keyword%'`는 선행 wildcard 때문에 일반 B-tree
  텍스트 인덱스를 활용하기 어렵습니다. 구조화된 도시·지역 정확 일치는
  `idx_accommodations_city_region`, 지역 단독 검색은 `idx_accommodations_region`을
  후보 접근 경로로 사용합니다.
- `rooms(accommodation_id)` 외래 키 인덱스는 존재하지만 작은 테스트 데이터의
  대표 계획에서는 Optimizer가 `EXISTS`를 Semi-join으로 바꾸고 객실을 먼저
  스캔한 뒤 숙소를 PK로 조회했습니다. 데이터 분포에 따라 외래 키 인덱스 계획을
  선택할 수 있으므로 운영 데이터의 계획을 다시 측정해야 합니다.
- 기간 재고는 UNIQUE 인덱스
  `uk_room_inventories_room_date(room_id, inventory_date)`의 `room_id` 동등 조건과
  `inventory_date` 범위 조건을 사용합니다.
- `status`, `capacity`, `nightly_price`를 위한 추가 복합 인덱스는 데이터 분포와
  대표 트래픽이 없는 현 단계에서 쓰기 비용만 늘릴 수 있어 추가하지 않았습니다.

격리된 MySQL 8.4 Testcontainer에서 대표 조건의 `EXPLAIN FORMAT=TREE`를 실행해
객실 선행 스캔과 숙소 PK 조회, 재고의 room/date UNIQUE 인덱스 범위 조회를
테스트로 확인합니다. 실제 데이터 규모와 검색 트래픽이 확보되면
`EXPLAIN ANALYZE`와 응답 시간 측정을 통해 전문 검색 또는 별도 복합 인덱스를
검토합니다.

## Examples

예약 가능한 서울 숙소를 인원과 객실 기본 가격으로 검색합니다.

```http
GET /api/v1/accommodations?city=서울특별시&region=강남구&accommodationAmenities=PARKING&accommodationAmenities=POOL&roomAmenities=WIFI&roomAmenities=AIR_CONDITIONER&checkInDate=2030-01-10&checkOutDate=2030-01-15&guestCount=2&minPrice=100000&maxPrice=200000&status=ACTIVE&available=true&sortBy=NAME&direction=ASC&page=0&size=20
Authorization: Bearer <access-token>
```

같은 기간과 인원 조건에서 예약 가능한 객실이 없는 숙소는 `available=false`로
검색합니다.

```http
GET /api/v1/accommodations?checkInDate=2030-01-10&checkOutDate=2030-01-15&guestCount=2&available=false&page=0&size=20
Authorization: Bearer <access-token>
```
