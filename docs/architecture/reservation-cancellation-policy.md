# Reservation Cancellation Policy

## Date Basis

취소일은 서비스 기준 시간대인 `Asia/Seoul`의 달력 날짜입니다. 체크인까지 남은
기간은 `cancellationDate`부터 `checkInDate`까지의 달력 일수로 계산하며 시각은
사용하지 않습니다.

## Fee Tiers

| 체크인까지 남은 일수 | 취소 가능 | 수수료율 |
| --- | --- | --- |
| 7일 이상 | 가능 | 0% |
| 3~6일 | 가능 | 확정 예약 금액의 30% |
| 1~2일 | 가능 | 확정 예약 금액의 50% |
| 0일 이하 | 불가 | 계산하지 않음 |

수수료는 Reservation에 보존된 확정 `totalAmount`에 요율을 곱해 계산합니다.
화폐 금액은 소수 둘째 자리에서 `HALF_UP`으로 반올림하며, 예상 환불액은
`totalAmount - cancellationFeeAmount`입니다.

## Cancellation Flow

1. 예약 존재 여부와 JWT 회원 소유권을 검증합니다.
2. `Reservation`의 현재 상태가 `CONFIRMED`인지 검증합니다.
3. 취소일과 체크인 날짜로 취소 가능 여부 및 수수료를 계산합니다.
4. 허용된 경우에만 모든 숙박일 재고를 반환합니다.
5. 예약 상태를 `CANCELLED`로 변경하고 수수료 정보를 응답합니다.

정책상 취소할 수 없는 예약은 `RESERVATION_009`로 거절하며 상태와 재고를 변경하지
않습니다. 이미 취소된 예약은 기존 상태 전이 규칙에 따라 `RESERVATION_005`로 먼저
거절합니다.

## Response and Limitations

취소 응답에는 취소일, 체크인까지 남은 일수, 확정 예약 금액, 수수료율, 수수료와
예상 환불액을 포함합니다. 현재 Payment 도메인이 없으므로 실제 승인 취소나 환불은
수행하지 않습니다. 수수료 결과도 별도 테이블에 저장하지 않으므로 향후 결제·정산
감사가 필요해지면 취소 시각과 금액 Snapshot 저장 방식을 함께 도입해야 합니다.
