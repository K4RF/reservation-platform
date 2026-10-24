import { useCallback, useEffect, useRef } from 'react'
import { getRoom, type RoomResponse } from '../../api/room'
import { ApiError } from '../../api/errors'
import { useDetailQuery } from '../../pages/useDetailQuery'
import { ErrorState } from '../ui/ErrorState'
import { LoadingState } from '../ui/LoadingState'
import type { RoomDetailContext } from './RoomDetailTrigger'

function sameRoom(left: RoomResponse, right: RoomResponse) {
  return (
    left.name === right.name &&
    left.capacity === right.capacity &&
    left.nightlyPrice === right.nightlyPrice &&
    left.status === right.status &&
    left.amenities.length === right.amenities.length &&
    left.amenities.every((item) => right.amenities.includes(item))
  )
}

export function RoomDetailDialog({
  room: snapshot,
  context,
  id,
  onClose,
}: {
  room: RoomResponse
  context: RoomDetailContext
  id: string
  onClose: (room?: RoomResponse) => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const load = useCallback(
    async (signal: AbortSignal) => {
      const room = await getRoom(snapshot.roomId, signal)
      if (room.accommodationId !== snapshot.accommodationId) {
        throw new ApiError('객실의 숙소 정보가 일치하지 않습니다.', { kind: 'unexpected_response' })
      }
      return room
    },
    [snapshot.roomId, snapshot.accommodationId],
  )
  const { state, retry } = useDetailQuery(load)

  useEffect(() => {
    const element = dialog.current!
    const bodyOverflow = document.body.style.overflow
    const rootOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    element.showModal()
    closeButton.current?.focus({ preventScroll: true })
    return () => {
      if (element.open) element.close()
      document.body.style.overflow = bodyOverflow
      document.documentElement.style.overflow = rootOverflow
    }
  }, [])

  const room = state.status === 'success' ? state.data : null
  const canSelect =
    room &&
    context.onSelect &&
    context.request &&
    room.status === 'ACTIVE' &&
    room.capacity >= context.request.guestCount &&
    sameRoom(room, snapshot)

  return (
    <dialog
      className="room-detail-dialog"
      ref={dialog}
      aria-modal="true"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-notice`}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return
        const controls =
          event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')
        const first = controls[0]
        const last = controls[controls.length - 1]
        const target = event.shiftKey ? last : first
        if (
          (event.shiftKey && document.activeElement === first) ||
          (!event.shiftKey && document.activeElement === last)
        ) {
          event.preventDefault()
          target?.focus()
        }
      }}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <div className="room-detail-header">
        <h2 id={`${id}-title`}>객실 상세</h2>
        <button type="button" ref={closeButton} onClick={() => onClose()}>
          객실 상세 닫기
        </button>
      </div>
      <p id={`${id}-notice`}>객실 정보 조회는 예약 가능 여부 확인이나 예약 확정이 아닙니다.</p>
      {state.status === 'loading' && <LoadingState message="객실 상세를 불러오고 있습니다." />}
      {state.status === 'error' && (
        <ErrorState
          message={
            state.notFound
              ? '객실을 찾을 수 없습니다. 목록을 다시 확인하세요.'
              : '객실 상세를 확인하지 못했습니다. 다시 시도하세요.'
          }
          onRetry={retry}
        />
      )}
      {room && (
        <>
          <h3 className="room-detail-name">{room.name}</h3>
          <dl className="room-detail-facts">
            <div>
              <dt>객실 ID</dt>
              <dd>{room.roomId}</dd>
            </div>
            <div>
              <dt>숙소 ID</dt>
              <dd>{room.accommodationId}</dd>
            </div>
            <div>
              <dt>총 수용 인원</dt>
              <dd>최대 {room.capacity}명</dd>
            </div>
            <div>
              <dt>운영 상태</dt>
              <dd>{room.status === 'ACTIVE' ? '운영 중' : '운영 중지'}</dd>
            </div>
            <div>
              <dt>기본 1박 가격</dt>
              <dd>{room.nightlyPrice.toLocaleString('ko-KR', { maximumFractionDigits: 20 })}</dd>
            </div>
          </dl>
          <p>
            기본 가격은 날짜별 적용 가격·투숙 총액·예약 금액 스냅샷이 아닙니다. API에 통화 정보는
            없습니다.
          </p>
          <h4>객실 편의시설</h4>
          {room.amenities.length ? (
            <ul className="catalog-amenities" aria-label="상세 객실 편의시설">
              {room.amenities.map((item) => (
                <li key={item}>{item === 'WIFI' ? '와이파이' : '에어컨'}</li>
              ))}
            </ul>
          ) : (
            <p>등록된 편의시설이 없습니다.</p>
          )}
          <p className="room-detail-unavailable">
            현재 API는 객실 사진·설명·침대·면적·전망을 제공하지 않습니다.
          </p>
          {context.request && (
            <p>
              {context.request.checkInDate} ~ {context.request.checkOutDate} ·{' '}
              {context.request.guestCount}명 기준으로 조회한 가용 객실입니다. 조회 이후 재고·가격은
              달라질 수 있으며 최종 판단은 Backend가 합니다.
            </p>
          )}
          {context.onSelect && context.request ? (
            <>
              {!canSelect && (
                <p role="status">
                  객실 정보 또는 수용 조건이 변경되었습니다. 닫고 가용성을 다시 조회하세요.
                </p>
              )}
              <button
                className="primary-action"
                type="button"
                disabled={!canSelect}
                onClick={() => onClose(room)}
              >
                이 객실 선택
              </button>
            </>
          ) : (
            <p>객실 선택은 날짜와 인원을 입력하고 가용 객실을 조회한 후 진행하세요.</p>
          )}
        </>
      )}
    </dialog>
  )
}
