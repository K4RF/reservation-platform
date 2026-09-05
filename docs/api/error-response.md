# API Validation and Error Response Policy

모든 JSON API 오류는 동일한 `ErrorResponse` 구조를 사용합니다. Spring MVC의
예외 처리와 Spring Security Filter 단계의 인증·인가 실패도 같은 Schema를
반환합니다.

## Response Schema

```json
{
  "timestamp": "2030-01-10T09:30:00Z",
  "status": 400,
  "code": "COMMON_001",
  "message": "입력값이 올바르지 않습니다.",
  "path": "/api/v1/reservations",
  "errors": [
    {
      "field": "checkInDate",
      "message": "체크인 날짜는 필수입니다."
    }
  ]
}
```

| Field | Policy |
| --- | --- |
| `timestamp` | 서버가 오류 응답을 생성한 UTC `Instant` |
| `status` | 실제 HTTP Response Status와 같은 숫자 |
| `code` | 클라이언트 분기 기준인 안정적인 도메인 오류 코드 |
| `message` | 사용자에게 노출 가능한 일반화된 메시지 |
| `path` | Query String을 제외한 요청 URI |
| `errors` | 필드·파라미터 Validation 오류. 해당하지 않으면 항상 빈 배열 |

Validation 상세는 필드명과 메시지 순으로 정렬하여 같은 입력에 안정적인 순서를
제공합니다. 한 필드가 여러 제약을 동시에 위반하면 각 위반을 별도 항목으로
반환할 수 있습니다. Enum·날짜·숫자 변환 실패와 잘못된 JSON처럼 값을 Binding할
수 없는 요청은 필드를 신뢰할 수 없으므로 `COMMON_002`와 빈 `errors`를 반환합니다.

## HTTP Status Policy

| Status | Meaning | Representative cases |
| --- | --- | --- |
| `400 Bad Request` | 입력 Validation, 요청 형식 또는 비즈니스 입력 범위 오류 | 필수값 누락, 크기·ID·페이지 범위, malformed JSON, 잘못된 예약 기간 |
| `401 Unauthorized` | 인증 정보가 없거나 자격 증명·Token이 유효하지 않음 | JWT 누락·만료·변조, 로그인 실패, Refresh Token 실패 |
| `403 Forbidden` | 인증은 됐지만 역할·리소스 소유권이 부족함 | USER의 관리자 API 호출, 다른 회원 예약 접근 |
| `404 Not Found` | 식별자로 지정한 리소스가 존재하지 않음 | 회원·숙소·객실·예약 미존재 |
| `409 Conflict` | 현재 리소스 또는 상태와 요청이 충돌함 | 이메일 중복, 예약 기간 중복, 비활성 리소스 예약, 잘못된 상태 전이 |
| `500 Internal Server Error` | 알려진 계약으로 변환하지 못한 서버 오류 | 예상하지 못한 Runtime Exception |

예상하지 못한 예외의 내부 메시지와 Stack Trace는 응답에 포함하지 않고 서버
로그에만 기록합니다. DB Constraint 위반을 무조건 409로 변환하지 않습니다.
클라이언트가 식별할 수 있는 중복·충돌은 Service에서 구체적인 도메인 ErrorCode로
변환하고, 분류되지 않은 DB 오류는 내부 오류로 처리합니다.

## Error Codes

### Common

| Code | Status | Meaning |
| --- | --- | --- |
| `COMMON_001` | 400 | Bean·Binding·Method Parameter 입력 Validation 실패 |
| `COMMON_002` | 400 | JSON, 타입 변환, 필수 Request Parameter 등 요청 형식 오류 |
| `COMMON_003` | 500 | 서버 내부 오류 |

### Member and Authentication

| Code | Status | Meaning |
| --- | --- | --- |
| `MEMBER_001` | 409 | 이메일 중복 |
| `MEMBER_002` | 404 | 회원 미존재 |
| `AUTH_001` | 401 | 인증 필요 또는 JWT 검증 실패 |
| `AUTH_002` | 403 | 역할 기반 접근 권한 부족 |
| `AUTH_003` | 401 | 이메일 또는 비밀번호 불일치 |
| `AUTH_004` | 401 | OAuth2 인증 실패 |
| `AUTH_005` | 401 | Refresh Token 자체가 유효하지 않거나 만료됨 |
| `AUTH_006` | 401 | Redis의 Refresh Token이 없거나 요청 Token과 불일치 |

로그인 실패는 계정 존재 여부가 드러나지 않도록 이메일 미존재와 비밀번호
불일치 모두 `AUTH_003`으로 반환합니다.

### Accommodation and Room

| Code | Status | Meaning |
| --- | --- | --- |
| `ACCOMMODATION_001` | 404 | 숙소 미존재 |
| `ACCOMMODATION_002` | 409 | 비활성 숙소에 신규 예약 시도 |
| `ROOM_001` | 404 | 객실 미존재 |
| `ROOM_002` | 400 | 예약 가능 객실 조회 기간 오류 |
| `ROOM_003` | 400 | 객실 가격 검색 범위 오류 |
| `ROOM_004` | 409 | 비활성 객실에 신규 예약 시도 |

### Reservation

| Code | Status | Meaning |
| --- | --- | --- |
| `RESERVATION_001` | 400 | 예약 생성·변경 기간 오류 |
| `RESERVATION_002` | 409 | 확정 예약 기간 중복 |
| `RESERVATION_003` | 404 | 예약 미존재 |
| `RESERVATION_004` | 403 | 예약 소유권 부족 |
| `RESERVATION_005` | 409 | 이미 취소된 예약 재취소 |
| `RESERVATION_006` | 409 | 취소된 예약 일정 변경 |
| `RESERVATION_007` | 400 | 예약 검색 From/To 범위 오류 |
| `RESERVATION_008` | 400 | 예약 인원이 객실 최대 수용 인원을 초과함 |

ErrorCode의 접두사는 도메인, 세 자리 숫자는 해당 도메인 내 안정적인 식별자입니다.
기존 코드는 의미를 바꾸거나 재사용하지 않고 새 오류가 필요하면 다음 번호를
추가합니다.

## Validation Responsibilities

- Request DTO와 Controller Parameter는 필수 여부, 형식, 길이, 양수 ID와 페이지
  범위처럼 요청 하나만으로 판단할 수 있는 규칙을 검증합니다.
- Service와 Domain은 소유권, 상태 전이, 기간 관계, 가격 계산, 중복처럼 여러 값과
  현재 상태가 필요한 규칙을 구체적인 Business/Domain Exception으로 표현합니다.
- Database Constraint는 어떤 쓰기 경로에서도 깨지면 안 되는 최종 정합성을
  보장하며, API 오류 분류를 대신하지 않습니다.

## Swagger/OpenAPI

Swagger의 각 Controller에는 실제 가능한 공통 `400`, `401`, `500` 응답과 필요한
`403`, `404`, `409` 응답을 선언했습니다. 모든 오류 응답은
`application/json`의 `ErrorResponse` Schema를 참조합니다. Swagger UI에서 Schema와
Endpoint별 응답을 확인할 수 있습니다.
