# Accommodation Integrated Search

## API Contract

`GET /api/v1/accommodations`는 다음 조건을 모두 선택적으로 조합합니다.

| Parameter | Meaning |
| --- | --- |
| `name` | 숙소명의 대소문자 구분 없는 부분 일치 |
| `city` | 구조화된 도시의 정확 일치(MySQL 문자열 Collation 적용) |
| `region` | 구조화된 지역의 정확 일치(MySQL 문자열 Collation 적용). 구조화 이전 행은 기존 주소 부분 일치 |
| `destination` | 도시·지역 자유 검색. 공백으로 나눈 모든 토큰이 동일 숙소의 `city` 또는 `region`에 부분 일치해야 함 |
| `accommodationAmenities` | 숙소가 모두 보유해야 하는 공용 편의시설(AND) |
| `roomAmenities` | 한 활성 객실이 모두 보유해야 하는 객실 편의시설(AND) |
| `checkInDate`, `checkOutDate` | `[check-in, check-out)` 기간의 날짜별 재고 확인 |
| `guestCount` | 요청 인원 이상을 수용하는 활성 객실 존재 여부 |
| `minPrice`, `maxPrice` | 활성 객실 기본 1박 가격의 포함 범위 |
| `status` | 숙소의 `ACTIVE` 또는 `INACTIVE` 상태 |
| `available` | 해당 기간과 객실 조건에 맞는 예약 가능 숙소 여부 |
| `page`, `size` | 0 기반 Pagination, 크기 1~100 |
| `sortBy`, `direction` | `ID`·`NAME`과 `ASC`·`DESC`만 허용 |

`destination`은 입력 원문 기준 최대 100자입니다(초과 시 `400 COMMON_001`).
생략·빈 문자열·공백만 입력하면 이 조건은 적용하지 않습니다. 유니코드 공백으로 토큰을
나누므로 앞뒤·연속 공백과 토큰 순서는 결과에 영향을 주지 않습니다. 대소문자를 구분하지 않고
`%`, `_`, 역슬래시(`\`)는 와일드카드가 아닌 문자 그대로 찾습니다.
`서울`/ `부산`/ `강남`/ `해운대`는 저장된 전체 이름의 부분 문자열로 찾으며,
`서울특별시 강남구`는 두 토큰이 동일 숙소의 구조화된 필드에 일치해야 합니다.
별칭 사전·음역·오타 보정이나 국가·상세 주소 자유 검색은 제공하지 않습니다.

동명 지역은 도시 토큰 또는 기존 정확 필터를 추가해 구분합니다. `destination`과
`city`·`region`을 같이 보내면 **AND**이고 충돌 시 빈 결과를 반환합니다.
관리자 목록과 기존 호출의 `city`·`region` 동작은 그대로입니다.
구조화 값 하나가 NULL이면 나머지 값만 자유 검색에 사용합니다. 둘 다 NULL이면 자유 검색으로
찾을 수 없습니다. 기존 `region`의 상세 주소 fallback은 **`region IS NULL`인 행에만** 유지되며,
상세 주소로 구조화된 값을 추정하거나 채우지 않습니다. #317은 Backend 계약만 변경하며,
현재 Home/Search의 자유 입력을 이 파라미터로 보내는 UI 연결은 별도 작업입니다.

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
Predicate로 적용하고, 자유 목적지 토큰도 같은 숙소의 Predicate로 추가합니다.
객실·재고 조건은 상관 `EXISTS` Subquery로 적용합니다.
따라서 조건에 맞는 객실이 여러 개여도 한 숙소가 중복 반환되지 않고 Pagination의
전체 개수도 숙소 수를 유지합니다. 이름이 같은 숙소의 정렬은 ID 오름차순으로 안정화합니다.

가용성은 각 후보 객실에 대해 기간 내 `total_quantity > reserved_quantity`인 재고
행 수가 숙박 일수와 같은지 비교합니다. 재고 행이 하루라도 없거나 품절이면 해당
객실은 예약 가능 후보에서 제외됩니다. 조회 결과와 실제 예약 사이에는 Lock이
없으므로 동시 요청의 최종 가용성은 예약 생성 Transaction에서 다시 검증합니다.

## Index and Execution Plan Review

MySQL 8.4의 현재 Schema와 조회 조건을 기준으로 다음 접근 경로를 사용합니다.

- 숙소명과 레거시 주소의 `LIKE '%keyword%'`는 선행 wildcard 때문에 일반 B-tree
  텍스트 인덱스를 활용하기 어렵습니다. 구조화된 도시·지역 정확 일치는
  `idx_accommodations_city_region_status_id`, 지역 단독 검색은
  `idx_accommodations_region`을 후보 접근 경로로 사용합니다. 자유 목적지의
  `LOWER(city/region) LIKE '%token%'`는 컬럼 함수와 선행 wildcard 때문에 같은 인덱스의
  동등/범위 탐색으로 대체되지 않습니다. [#317 실행 계획](../performance/search-query-execution-plan.md#자유-목적지-검색-317)을 참고합니다.
- 숙소별 객실과 가용 객실 조회는
  `idx_rooms_accommodation_status_id(accommodation_id,status,id)`로 숙소와 운영 상태
  후보를 줄이고 기본 ID 정렬을 지원합니다.
- 기간 재고는 UNIQUE 인덱스
  `uk_room_inventories_room_date(room_id, inventory_date)`의 `room_id` 동등 조건과
  `inventory_date` 범위 조건을 사용합니다.
- 선택적인 Range인 `capacity`, `nightly_price`와 동적 정렬 조합별 Index는 쓰기
  비용을 고려해 추가하지 않았습니다.

격리된 MySQL 8.4 Testcontainer에서 적용 전후 `EXPLAIN`과 `EXPLAIN ANALYZE`를
실행해 숙소·객실 후보 감소와 재고 room/date UNIQUE 인덱스 범위 조회를 검증합니다.
데이터셋, Plan과 Trade-off는
[`Search Query Execution Plan`](../performance/search-query-execution-plan.md)에
기록했습니다.

## Examples

자유 검색어는 URL 인코딩해서 전달합니다(예: `destination=서울특별시 강남구`).

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
