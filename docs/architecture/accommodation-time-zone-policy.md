# Accommodation TimeZone Policy

## Time Model

숙소는 `timeZone`에 Java `ZoneId`가 인식하는 IANA 지역 ID를 저장합니다. 고정 UTC
Offset이 아니라 `Asia/Seoul`, `Asia/Tokyo`, `America/New_York` 같은 지역 ID를
사용하므로 해당 지역의 DST 규칙도 Java TimeZone Database에 따라 적용됩니다.

| Value | Type and reference zone |
| --- | --- |
| 시스템 이벤트 생성·수정·취소 시각 | `Instant`, UTC |
| 예약 체크인·체크아웃 날짜 | `LocalDate`, 해당 숙소 달력 |
| 숙소 체크인·체크아웃 시간 | `LocalTime`, 해당 숙소 현지 시각 |
| 예약 가능 사전 일수 | 현재 `Instant`를 숙소 ZoneId의 `LocalDate`로 변환해 계산 |
| 취소 마감·수수료 경계 | 취소 `Instant`를 숙소 ZoneId의 `LocalDate`로 변환해 계산 |
| 공개 예약번호 날짜 구간 | 생성 `Instant`의 숙소 ZoneId 날짜 |

서버 OS의 기본 TimeZone은 비즈니스 계산에 사용하지 않습니다. 서로 다른 TimeZone의
숙소가 통합 검색에 포함될 때는 DB에 저장된 TimeZone별 현재 날짜를 각각 계산하고,
각 숙소의 Booking Policy 조건에 대응시킵니다.

## Check-in and Check-out

체크인·체크아웃 날짜는 숙소 현지 달력의 날짜이고 시간은 같은 숙소 TimeZone의
현지 시각입니다. 두 운영 시간은 서로 달라야 하지만 서로 다른 날짜에 적용되므로
`15:00` 체크인과 `11:00` 체크아웃은 정상입니다. 현재 API는 현지 날짜와 시간을
안내하고 정책 일수를 계산하며, 하나의 UTC 체크인/체크아웃 Timestamp로 결합해
저장하지는 않습니다.

## Existing Data

이 기능 이전에는 모든 예약·취소 정책 날짜가 `Asia/Seoul` 기준이었습니다. 기존
숙소는 위치 문자열에서 TimeZone을 추측하지 않고 `Asia/Seoul`로 Backfill하여 이전
동작을 보존합니다. 관리자는 이후 숙소 수정 API로 검증된 IANA ZoneId를 설정할 수
있습니다.
