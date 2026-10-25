import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ErrorState } from './ErrorState'
import { LoadingState } from './LoadingState'
import { EmptyState } from './EmptyState'

describe('common UI states', () => {
  it('announces loading through a status region', () => {
    render(<LoadingState message="숙소를 불러오는 중입니다." />)

    expect(screen.getByRole('status').textContent).toBe('숙소를 불러오는 중입니다.')
    expect(screen.getByRole('status').classList.contains('ui-loading')).toBe(true)
    expect(screen.getByRole('status').getAttribute('aria-atomic')).toBe('true')
  })

  it('announces errors and offers an optional retry callback', () => {
    const onRetry = vi.fn()
    render(<ErrorState message="숙소를 불러오지 못했습니다." onRetry={onRetry} />)

    expect(screen.getByRole('alert').textContent).toContain('숙소를 불러오지 못했습니다.')
    expect(screen.getByRole('alert').classList.contains('ui-error')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('does not show retry when no action was supplied', () => {
    render(<ErrorState />)

    expect(screen.getByRole('alert').textContent).toContain('문제가 발생했습니다.')
    expect(screen.queryByRole('button', { name: '다시 시도' })).toBeNull()
  })
  it('announces only the empty message, keeps caller actions outside the live region and performs no automatic recovery', () => {
    const retry = vi.fn()
    render(
      <EmptyState message="표시할 결과가 없습니다.">
        <button onClick={retry}>조건 다시 확인</button>
      </EmptyState>,
    )
    const status = screen.getByRole('status')
    expect(status.textContent).toBe('표시할 결과가 없습니다.')
    expect(status.getAttribute('aria-atomic')).toBe('true')
    expect(status.parentElement?.classList.contains('ui-empty')).toBe(true)
    expect(status.contains(screen.getByRole('button'))).toBe(false)
    expect(retry).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '조건 다시 확인' }))
    expect(retry).toHaveBeenCalledOnce()
  })
})
