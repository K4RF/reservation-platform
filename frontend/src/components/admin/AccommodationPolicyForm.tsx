import { useState } from 'react'
import {
  saveBookingPolicy,
  saveCancellationPolicy,
  validBookingPolicy,
  validCancellationPolicy,
} from '../../api/adminAccommodation'
import type {
  BookingPolicyResponse,
  CancellationPolicyResponse,
  PolicyOperation,
} from '../../api/adminAccommodation'
import type { AdminMutation } from './useAdminMutation'
import { ErrorState } from '../ui/ErrorState'

const bookingFields = [
  ['minStayNights', '최소 숙박일', 1],
  ['maxStayNights', '최대 숙박일', 1],
  ['minAdvanceBookingDays', '최소 사전 예약일', 0],
  ['maxAdvanceBookingDays', '최대 사전 예약일', 0],
] as const
const cancellationFields = [
  ['freeCancellationDaysBeforeCheckIn', '무료 취소 기준일', 1],
  ['cancellationDeadlineDaysBeforeCheckIn', '취소 마감 기준일', 0],
] as const
const number = (data: FormData, key: string) => {
  const value = String(data.get(key) ?? '')
  return value.trim() ? Number(value) : NaN
}
export function AccommodationPolicyForm({
  id,
  kind,
  mutation,
}: {
  id: number
  kind: 'booking' | 'cancellation'
  mutation: AdminMutation
}) {
  const label = kind === 'booking' ? '예약 정책' : '취소 정책'
  const [operation, setOperation] = useState<PolicyOperation | ''>('')
  const [confirmed, setConfirmed] = useState(false)
  const [rows, setRows] = useState<number[]>([0])
  const [nextRow, setNextRow] = useState(1)
  const [error, setError] = useState('')
  const [result, setResult] = useState<BookingPolicyResponse | CancellationPolicyResponse>()
  function field(name: string, text: string, min: number, max = 2147483647) {
    const key = `${kind}-${name}`
    return (
      <div className="form-field" key={key}>
        <label htmlFor={key}>{text}</label>
        <input id={key} name={name} type="number" min={min} max={max} step="1" required />
      </div>
    )
  }
  return (
    <section aria-label={`${label} 관리`}>
      <h3>{label}</h3>
      <p>
        현재 정책 GET/DELETE API가 없어 기존 값·존재 여부를 불러올 수 없습니다.
        생성(POST)/수정(PUT)을 직접 선택하고 전체 값을 입력하세요. 중복/미존재 오류로 작업이 자동
        전환되지 않습니다.
      </p>
      <form
        className="admin-form"
        aria-label={`${label} 입력`}
        noValidate
        onChange={(event) => {
          if (!(event.target instanceof HTMLInputElement) || event.target.name !== 'confirmed')
            setConfirmed(false)
        }}
        onSubmit={(event) => {
          event.preventDefault()
          if (mutation.disabled) return
          if (!operation || !confirmed) {
            setError('생성/수정 작업을 선택하고 전체 입력값을 확인해 주세요.')
            return
          }
          const data = new FormData(event.currentTarget)
          if (kind === 'booking') {
            const body = {
              minStayNights: number(data, 'minStayNights'),
              maxStayNights: number(data, 'maxStayNights'),
              minAdvanceBookingDays: number(data, 'minAdvanceBookingDays'),
              maxAdvanceBookingDays: number(data, 'maxAdvanceBookingDays'),
            }
            if (!validBookingPolicy(body)) {
              setError('숙박일은 1 이상, 사전 예약일은 0 이상인 정수이며 최소 ≤ 최대여야 합니다.')
              return
            }
            setError('')
            setConfirmed(false)
            setResult(undefined)
            void mutation.run(
              (signal) => saveBookingPolicy(id, operation, body, signal),
              setResult,
              '예약 정책 저장 응답을 받았습니다.',
            )
          } else {
            const body = {
              freeCancellationDaysBeforeCheckIn: number(data, 'freeCancellationDaysBeforeCheckIn'),
              cancellationDeadlineDaysBeforeCheckIn: number(
                data,
                'cancellationDeadlineDaysBeforeCheckIn',
              ),
              feeRules: rows.map((row) => ({
                minDaysBeforeCheckIn: number(data, `days-${row}`),
                feeRatePercent: number(data, `rate-${row}`),
              })),
            }
            if (!validCancellationPolicy(body)) {
              setError(
                '정수 기준일은 무료 > 마감 ≥ 0이어야 합니다. 구간은 마감 이상·무료 미만의 중복 없는 일수로, 마감일 구간을 포함해야 합니다. 수수료율은 1~100%입니다.',
              )
              return
            }
            // Backend also normalizes tiers in descending threshold order.
            body.feeRules.sort((a, b) => b.minDaysBeforeCheckIn - a.minDaysBeforeCheckIn)
            setError('')
            setConfirmed(false)
            setResult(undefined)
            void mutation.run(
              (signal) => saveCancellationPolicy(id, operation, body, signal),
              setResult,
              '취소 정책 저장 응답을 받았습니다.',
            )
          }
        }}
      >
        <fieldset disabled={mutation.disabled}>
          <legend>{label} 전체 입력</legend>
          <div className="form-field">
            <label htmlFor={`${kind}-operation`}>{label} 작업</label>
            <select
              id={`${kind}-operation`}
              value={operation}
              onChange={(event) => setOperation(event.target.value as PolicyOperation | '')}
              required
            >
              <option value="">작업 선택</option>
              <option value="POST">생성 (POST)</option>
              <option value="PUT">수정 (PUT)</option>
            </select>
          </div>
          {(kind === 'booking' ? bookingFields : cancellationFields).map(([name, text, min]) =>
            field(name, text, min),
          )}
          {kind === 'cancellation' && (
            <fieldset>
              <legend>부분 취소 수수료 구간</legend>
              {rows.map((row, index) => (
                <fieldset key={row}>
                  <legend>구간 {index + 1}</legend>
                  {field(`days-${row}`, `구간 ${index + 1} 시작일`, 0)}
                  {field(`rate-${row}`, `구간 ${index + 1} 수수료율 (%)`, 1, 100)}
                  <button
                    type="button"
                    disabled={rows.length === 1}
                    onClick={() => {
                      setRows(rows.filter((value) => value !== row))
                      setConfirmed(false)
                    }}
                  >
                    구간 {index + 1} 제거
                  </button>
                </fieldset>
              ))}
              <button
                type="button"
                onClick={() => {
                  setRows([...rows, nextRow])
                  setNextRow(nextRow + 1)
                  setConfirmed(false)
                }}
              >
                수수료 구간 추가
              </button>
            </fieldset>
          )}
          <label className="admin-check">
            <input
              name="confirmed"
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            {label} 생성/수정 작업과 전체 입력값을 확인했습니다.
          </label>
          {error && <ErrorState message={error} />}
          <button type="submit" disabled={!operation || !confirmed}>
            {label} 저장
          </button>
        </fieldset>
      </form>
      {result && (
        <section aria-label={`${label} 성공 응답`}>
          <h4>직전 성공 응답 — 현재 정책 재조회 결과가 아닙니다.</h4>
          <dl>
            <dt>숙소 ID</dt>
            <dd>{result.accommodationId}</dd>
            {'bookingPolicyId' in result ? (
              <>
                <dt>예약 정책 ID</dt>
                <dd>{result.bookingPolicyId}</dd>
                {bookingFields.map(([name, text]) => (
                  <div key={name}>
                    <dt>{text}</dt>
                    <dd>{result[name]}</dd>
                  </div>
                ))}
              </>
            ) : (
              <>
                <dt>취소 정책 ID</dt>
                <dd>{result.cancellationPolicyId}</dd>
                <dt>무료 취소 기준일</dt>
                <dd>{result.freeCancellationDaysBeforeCheckIn}</dd>
                <dt>취소 마감 기준일</dt>
                <dd>{result.cancellationDeadlineDaysBeforeCheckIn}</dd>
                <dt>수수료 구간</dt>
                <dd>
                  <ul>
                    {result.feeRules.map((rule) => (
                      <li key={rule.minDaysBeforeCheckIn}>
                        {rule.minDaysBeforeCheckIn}일 이상: {rule.feeRatePercent}%
                      </li>
                    ))}
                  </ul>
                </dd>
              </>
            )}
          </dl>
        </section>
      )}
    </section>
  )
}
