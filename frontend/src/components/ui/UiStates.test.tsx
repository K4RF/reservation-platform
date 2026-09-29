import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ErrorState } from './ErrorState'
import { LoadingState } from './LoadingState'

afterEach(cleanup)

describe('common UI states', () => {
  it('announces loading through a status region', () => {
    render(<LoadingState message="숙소를 불러오는 중입니다." />)

    expect(screen.getByRole('status').textContent).toBe('숙소를 불러오는 중입니다.')
  })

  it('announces errors and offers an optional retry callback', () => {
    const onRetry = vi.fn()
    render(<ErrorState message="숙소를 불러오지 못했습니다." onRetry={onRetry} />)

    expect(screen.getByRole('alert').textContent).toContain('숙소를 불러오지 못했습니다.')
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('does not show retry when no action was supplied', () => {
    render(<ErrorState />)

    expect(screen.getByRole('alert').textContent).toContain('문제가 발생했습니다.')
    expect(screen.queryByRole('button', { name: '다시 시도' })).toBeNull()
  })
})
