import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router'
import type { RoomResponse } from '../../api/room'
import type { AvailabilityRequest } from '../../api/availabilityValidation'
import {
  captureExplorationPosition,
  restoreExplorationPosition,
  type ExplorationPosition,
} from '../../app/explorationPosition'
import { RoomDetailDialog } from './RoomDetailDialog'

export interface RoomDetailContext {
  scope: string
  fallbackId: string
  request?: AvailabilityRequest
  onSelect?: (room: RoomResponse) => void
}

// A same-URL history entry makes Back close the detail, without replacing search/stay context.
export function RoomDetailTrigger({
  room,
  context,
}: {
  room: RoomResponse
  context: RoomDetailContext
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const trigger = useRef<HTMLButtonElement>(null)
  const position = useRef<ExplorationPosition | null>(null)
  const wasOpen = useRef(false)
  const closing = useRef(false)
  const selection = useRef<RoomResponse | null>(null)
  const marker = location.state?.roomDetail
  const open =
    marker?.scope === context.scope &&
    marker?.roomId === room.roomId &&
    marker?.accommodationId === room.accommodationId
  const id = `room-detail-${encodeURIComponent(context.scope)}-${room.roomId}`

  useEffect(() => {
    if (open && !wasOpen.current && trigger.current) {
      position.current ??= captureExplorationPosition(trigger.current)
    }
    if (!open && wasOpen.current) {
      if (position.current) {
        restoreExplorationPosition(position.current, document.getElementById(context.fallbackId))
      }
      const chosen = selection.current
      selection.current = null
      if (chosen) context.onSelect?.(chosen)
    }
    wasOpen.current = open
    closing.current = false
  }, [open, context])

  function close(chosen?: RoomResponse) {
    if (closing.current) return
    closing.current = true
    selection.current = chosen ?? null
    void navigate(-1)
  }

  return (
    <>
      <button
        id={id}
        ref={trigger}
        type="button"
        aria-haspopup="dialog"
        onClick={() => {
          if (trigger.current) position.current = captureExplorationPosition(trigger.current)
          void navigate(
            { pathname: location.pathname, search: location.search, hash: location.hash },
            {
              state: {
                ...location.state,
                roomDetail: {
                  scope: context.scope,
                  roomId: room.roomId,
                  accommodationId: room.accommodationId,
                },
              },
              preventScrollReset: true,
            },
          )
        }}
      >
        {room.name} 상세 보기
      </button>
      {open && <RoomDetailDialog room={room} context={context} id={id} onClose={close} />}
    </>
  )
}
