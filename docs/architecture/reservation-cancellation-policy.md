# Reservation Cancellation Policy

## Accommodation Policy

숙소마다 하나의 선택적 취소 정책을 등록할 수 있습니다.

| Field | Meaning |
| --- | --- |
| `freeCancellationDaysBeforeCheckIn` | 이 일수 이상 남으면 무료 취소 |
| `cancellationDeadlineDaysBeforeCheckIn` | 이 일수 미만이면 취소 불가 |
| `feeRules[].minDaysBeforeCheckIn` | 부분 수수료 구간이 시작되는 남은 일수 |
| `feeRules[].feeRatePercent` | 해당 구간의 정수 수수료율, 1~100% |

무료 취소 기준은 취소 마감 기준보다 커야 합니다. 수수료 구간 시작일은 두 기준
사이에 있어야 하고 중복될 수 없습니다. 가장 낮은 구간 시작일은 취소 마감 기준과
같아야 하므로 허용된 부분 수수료 기간에 빈 구간이 생기지 않습니다. 요청 순서와
관계없이 구간은 남은 일수 내림차순으로 저장하고 평가합니다.

관리자는 다음 API로 정책을 관리합니다.

```http
POST /api/v1/accommodations/{accommodationId}/cancellation-policy
PUT /api/v1/accommodations/{accommodationId}/cancellation-policy
Authorization: Bearer <admin-access-token>
Content-Type: application/json

{
  "freeCancellationDaysBeforeCheckIn": 7,
  "cancellationDeadlineDaysBeforeCheckIn": 1,
  "feeRules": [
    {"minDaysBeforeCheckIn": 3, "feeRatePercent": 30},
    {"minDaysBeforeCheckIn": 1, "feeRatePercent": 50}
  ]
}
```

## Reservation Snapshot

예약 생성 시 숙소의 현재 정책을 예약에 복사합니다. 정책이 없는 숙소에는 기존
고정 정책과 같은 기본값을 복사합니다. 이후 숙소 정책을 수정해도 기존 예약은
자신의 Snapshot으로 취소 수수료를 계산하고, 새 예약부터 변경된 정책을 받습니다.
예약 일정 변경도 취소 정책 Snapshot을 바꾸지 않습니다.

Snapshot 저장 방식과 대안은
[`ADR-005`](../adr/005-cancellation-policy-snapshot.md)에 정리했습니다.

## Date and Fee Calculation

취소일은 현재 서비스 기준 시간대인 `Asia/Seoul`의 달력 날짜입니다. 체크인까지
남은 일수는 `cancellationDate`부터 `checkInDate`까지 계산합니다.

1. 남은 일수가 무료 취소 기준 이상이면 수수료율은 0%입니다.
2. 남은 일수가 취소 마감 기준 미만이면 `RESERVATION_009`로 거절합니다.
3. 나머지는 남은 일수 이하인 첫 번째 수수료 구간의 요율을 적용합니다.

수수료는 Reservation의 확정 `totalAmount`에 요율을 곱하고 소수 둘째 자리까지
`HALF_UP`으로 반올림합니다. 예상 환불액은 `totalAmount - cancellationFeeAmount`입니다.

허용된 경우에만 모든 숙박일 재고를 반환하고 예약 상태를 `CANCELLED`로 바꿉니다.
응답의 수수료와 환불액은 예상값이며 실제 결제 취소·환불 및 취소 결과 영속화는
이번 범위에 포함하지 않습니다.
