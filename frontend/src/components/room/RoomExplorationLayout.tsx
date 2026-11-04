import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

export function RoomExplorationLayout({
  introduction,
  information,
  controls,
  rooms,
  summary,
  booking,
  selectedName,
  onContinue,
}: {
  introduction?: ReactNode
  information?: ReactNode
  controls: ReactNode
  rooms?: ReactNode
  summary?: ReactNode
  booking?: ReactNode
  selectedName?: string
  onContinue?: () => void
}) {
  const action = useRef<HTMLDivElement>(null)
  const [actionHeight, setActionHeight] = useState(0)
  useEffect(() => {
    const element = action.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() =>
      setActionHeight(element.getBoundingClientRect().height),
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  function reveal(id: string) {
    document.getElementById(id)?.focus()
    document.getElementById(id)?.scrollIntoView({ block: 'start' })
  }
  return (
    <div
      className="room-exploration"
      style={{ '--detail-action-height': `${actionHeight}px` } as CSSProperties}
      onFocusCapture={(event) => {
        if (event.target.closest('dialog, .detail-mobile-action')) return
        const bar = action.current
        if (
          bar &&
          getComputedStyle(bar).position === 'fixed' &&
          getComputedStyle(bar).visibility !== 'hidden' &&
          event.target.getBoundingClientRect().bottom > bar.getBoundingClientRect().top
        )
          event.target.scrollIntoView({ block: 'center' })
      }}
    >
      <div className="detail-body-layout">
        <div className="detail-main-content">
          <nav className="detail-section-nav" aria-label="숙소 상세 탐색">
            <a href="#accommodation-introduction">숙소 소개</a>
            <a href="#room-list-title">객실 선택</a>
            <a href="#accommodation-operating-info">이용 안내</a>
          </nav>
          {introduction}
          {rooms}
          {information}
        </div>
        <aside
          className="room-selection-panel detail-booking-rail"
          aria-labelledby="room-selection-panel-title"
          tabIndex={0}
        >
          <h3 id="room-selection-panel-title" tabIndex={-1}>
            선택한 객실 확인
          </h3>
          {controls}
          {summary ?? (
            <p className="selection-panel-empty">일정과 인원을 적용한 뒤 객실을 선택해 주세요.</p>
          )}
        </aside>
      </div>
      {booking}
      <div className="detail-mobile-action" ref={action} aria-label="예약 다음 행동">
        <p>{selectedName ?? '나에게 맞는 객실을 찾아보세요.'}</p>
        <button
          className="primary-action"
          type="button"
          aria-label={
            onContinue ? '선택 객실로 계속하기' : booking ? '예약 입력 계속' : '일정·객실 확인'
          }
          onClick={
            onContinue ?? (() => reveal(booking ? 'booking-stage-title' : 'availability-title'))
          }
        >
          {onContinue ? '계속하기' : booking ? '입력 계속' : '객실 확인'}
        </button>
      </div>
    </div>
  )
}
