import { useState, type ReactNode } from 'react'
import type { ReservationDetail } from '../../api/reservationDetail'
import { formatMinorUnits, toMinorUnits } from '../../utils/money'
import { ReservationChangeAvailabilitySection } from './ReservationChangeAvailabilitySection'
import {
  ReservationCancellationPolicy,
  ReservationCancellationResult,
} from './ReservationCancellationSummary'
import { ReservationCancellationSection } from './ReservationCancellationSection'
import type { ReservationCancellationResponse } from '../../api/reservationCancellation'

const amountLabel = (amount: number | null) =>
  amount === null ? '저장된 정보 없음' : formatMinorUnits(toMinorUnits(amount, 19))

export function ReservationSnapshots({
  reservation,
  accommodationId,
  summary,
  onCatalogRetry,
  onRefresh,
  onRefreshDetail,
  onCancelled,
}: {
  reservation: ReservationDetail
  accommodationId: number | null
  summary?: ReactNode
  onCatalogRetry?: () => void
  onRefresh?: (changed?: ReservationDetail) => void
  onRefreshDetail?: () => void
  onCancelled?: (result: ReservationCancellationResponse) => void
}) {
  const [changeLocked, setChangeLocked] = useState(false)
  const [cancelLocked, setCancelLocked] = useState(false)
  const [active, setActive] = useState<'change' | 'cancel' | null>(null)
  const { representativeGuest: guest } = reservation
  return (
    <div className="reservation-management-layout">
      <aside className="reservation-management-rail" aria-label="저장된 여행 요약">
        {summary}
        <p className="reservation-note">
          금액·일정·인원은 저장된 예약 기록입니다. 결제 완료를 의미하지 않습니다.
        </p>
        {onCatalogRetry && (
          <button type="button" disabled={changeLocked || cancelLocked} onClick={onCatalogRetry}>
            현재 숙소·객실 정보 다시 조회
          </button>
        )}
      </aside>
      <div className="reservation-management-main">
        {reservation.status === 'CANCELLED' ? (
          <section
            className="reservation-card reservation-snapshot-wide"
            aria-labelledby="cancellation-result-heading"
          >
            <h2 id="cancellation-result-heading">저장된 취소 결과</h2>
            <ReservationCancellationResult reservation={reservation} />
          </section>
        ) : (
          <section
            className="reservation-card reservation-management-actions"
            aria-labelledby="reservation-actions-heading"
          >
            <p className="reservation-eyebrow">MANAGE YOUR STAY</p>
            <h2 id="reservation-actions-heading">예약 관리</h2>
            <p className="reservation-note">
              일정을 조정하거나 취소 안내를 확인하세요. 확인만으로 예약이 바뀌지 않습니다.
            </p>
            <div className="reservation-action-entries">
              <fieldset
                className="reservation-change-fields reservation-change-action"
                disabled={cancelLocked}
              >
                <legend>일정 변경</legend>
                <ReservationChangeAvailabilitySection
                  reservation={reservation}
                  accommodationId={accommodationId}
                  open={active === 'change'}
                  onOpenChange={(open) => {
                    if (!changeLocked && !cancelLocked) setActive(open ? 'change' : null)
                  }}
                  onRefresh={onRefresh}
                  onLock={setChangeLocked}
                />
              </fieldset>
              <fieldset
                className="reservation-change-fields reservation-cancel-action"
                disabled={changeLocked}
              >
                <legend>예약 취소</legend>
                <ReservationCancellationSection
                  reservation={reservation}
                  open={active === 'cancel'}
                  onOpenChange={(open) => {
                    if (!changeLocked && !cancelLocked) setActive(open ? 'cancel' : null)
                  }}
                  onRefresh={onRefreshDetail}
                  onCancelled={onCancelled}
                  onLock={setCancelLocked}
                />
              </fieldset>
            </div>
          </section>
        )}
        <section className="reservation-card" aria-labelledby="guest-snapshot-heading">
          <p className="reservation-source-label">예약에 저장된 정보</p>
          <h2 id="guest-snapshot-heading">대표 투숙객</h2>
          {guest ? (
            <dl className="reservation-facts">
              <div>
                <dt>이름</dt>
                <dd>{guest.name}</dd>
              </div>
              <div>
                <dt>이메일</dt>
                <dd>{guest.email}</dd>
              </div>
              <div>
                <dt>연락처</dt>
                <dd>{guest.phone}</dd>
              </div>
            </dl>
          ) : (
            <p>대표 투숙객 정보가 저장되지 않은 과거 예약입니다.</p>
          )}
        </section>
        <details className="reservation-card reservation-snapshot-disclosure">
          <summary>저장된 숙박 요금</summary>
          <section aria-labelledby="price-snapshot-heading">
            <h2 id="price-snapshot-heading" className="sr-only">
              저장된 숙박 요금
            </h2>
            <p className="reservation-note">
              예약 당시 저장한 금액입니다. 현재 객실 요금으로 재계산하지 않습니다.
            </p>
            <p>첫 숙박일 저장 요금: {amountLabel(reservation.nightlyPriceSnapshot)}</p>
            {reservation.nights.length ? (
              <>
                <p className="reservation-note" id="saved-price-scroll-hint">
                  좁은 화면에서는 요금 표를 좌우로 스크롤할 수 있습니다.
                </p>
                <div
                  className="reservation-price-scroll"
                  role="region"
                  aria-label="저장된 숙박 요금 표"
                  aria-describedby="saved-price-scroll-hint"
                  tabIndex={0}
                >
                  <table className="booking-price-table">
                    <caption>숙박일별 확정 요금</caption>
                    <thead>
                      <tr>
                        <th scope="col">숙박일</th>
                        <th scope="col">저장된 요금</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...reservation.nights]
                        .sort((a, b) => a.stayDate.localeCompare(b.stayDate))
                        .map((night) => (
                          <tr key={night.stayDate}>
                            <th scope="row">
                              <time dateTime={night.stayDate}>{night.stayDate}</time>
                            </th>
                            <td>{amountLabel(night.priceSnapshot)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p>숙박일별 요금이 저장되지 않은 과거 예약입니다. 일별 금액을 추정하지 않습니다.</p>
            )}
          </section>
        </details>
        <details className="reservation-card reservation-snapshot-disclosure">
          <summary>예약에 저장된 취소 정책</summary>
          <section aria-labelledby="policy-snapshot-heading">
            <h2 id="policy-snapshot-heading" className="sr-only">
              예약에 저장된 취소 정책
            </h2>
            <ReservationCancellationPolicy policy={reservation.cancellationPolicySnapshot} />
          </section>
        </details>
      </div>
    </div>
  )
}
