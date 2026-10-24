import { describe, expect, it, vi } from 'vitest'
import { captureExplorationPosition, restoreExplorationPosition } from './explorationPosition'

describe('transient exploration return position (room disclosure contract)', () => {
  it('captures only coordinates and trigger identity and restores after close without scrolling focus', () => {
    const trigger = document.createElement('button')
    trigger.id = 'room-trigger-3'
    document.body.append(trigger)
    vi.stubGlobal('scrollY', 731)
    vi.stubGlobal('scrollX', 0)
    const position = captureExplorationPosition(trigger)
    expect(position).toEqual({ x: 0, y: 731, triggerId: 'room-trigger-3' })
    const focus = vi.spyOn(trigger, 'focus')
    restoreExplorationPosition(position)
    expect(focus).toHaveBeenCalledWith({ preventScroll: true })
    expect(document.activeElement).toBe(trigger)
    expect(window.scrollTo).toHaveBeenCalledWith({ left: 0, top: 731, behavior: 'instant' })
    trigger.remove()
  })
  it('uses an explicit fallback if the trigger disappeared, without inventing another room selection', () => {
    const fallback = document.createElement('h2')
    fallback.tabIndex = -1
    document.body.append(fallback)
    restoreExplorationPosition({ x: 0, y: 400, triggerId: 'removed-room-trigger' }, fallback)
    expect(document.activeElement).toBe(fallback)
    expect(window.scrollTo).toHaveBeenCalledWith({ left: 0, top: 400, behavior: 'instant' })
    fallback.remove()
  })
})
