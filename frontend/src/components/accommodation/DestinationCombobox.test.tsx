import { act, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { gangnam, seoul } from '../../test/locationSuggestions'
import { DestinationCombobox } from './DestinationCombobox'
import { applyDestination, destinationDraft } from './searchLocation'
import { toSearchParams } from './searchQuery'

function renderForm() {
  const select = vi.fn()
  const search = vi.fn()
  function Form() {
    const [value, setValue] = useState(() => destinationDraft({}))
    return (
      <form
        onSubmit={(event) => {
          event.preventDefault()
          search(Object.fromEntries(toSearchParams(applyDestination({}, value))))
        }}
      >
        <DestinationCombobox
          id="test-city"
          value={value}
          onChange={(next) => {
            if (next.kind === 'selected') select(next.suggestion)
            setValue(next)
          }}
        />
        <button type="button">날짜</button>
        <button type="submit">검색</button>
      </form>
    )
  }
  render(<Form />)
  const input = screen.getByRole<HTMLInputElement>('combobox', { name: '여행지' })
  act(() => input.focus())
  return { input, select, search }
}

function change(input: HTMLInputElement, value: string) {
  fireEvent.change(input, { target: { value } })
}

const advance = (ms = 250) => act(() => vi.advanceTimersByTimeAsync(ms))

describe('DestinationCombobox', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('debounces and waits for Korean composition; cancels in-flight and ignores late responses', async () => {
    let finishOld!: (response: Response) => void
    const fetch = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            finishOld = resolve
          }),
      )
      .mockResolvedValueOnce(Response.json([gangnam]))
    vi.stubGlobal('fetch', fetch)
    const { input, select } = renderForm()
    change(input, '서')
    await advance(300)
    expect(fetch).not.toHaveBeenCalled()
    fireEvent.compositionStart(input)
    change(input, '서울')
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true })
    await advance(300)
    expect(fetch).not.toHaveBeenCalled()
    expect(select).not.toHaveBeenCalled()
    fireEvent.compositionEnd(input)
    expect(screen.getAllByText('지역 후보를 찾는 중입니다.')).toHaveLength(2)
    await advance(249)
    expect(fetch).not.toHaveBeenCalled()
    await advance(1)
    const oldSignal = fetch.mock.calls[0][1].signal as AbortSignal
    change(input, '강남')
    expect(oldSignal.aborted).toBe(true)
    await advance()
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('option', { name: /강남구/ })).toBeTruthy()
    await act(async () => finishOld(Response.json([seoul])))
    expect(screen.getAllByRole('option')).toHaveLength(1)
    expect(screen.getByRole('option', { name: /강남구/ })).toBeTruthy()
  })

  it('keeps input focus, navigates active options, and selects without submitting', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json([seoul, gangnam])))
    const { input, select, search } = renderForm()
    change(input, '서울')
    await advance()
    const list = screen.getByRole('listbox')
    expect(input.getAttribute('aria-expanded')).toBe('true')
    expect(input.getAttribute('aria-controls')).toBe(list.id)
    expect(input.hasAttribute('aria-activedescendant')).toBe(false)
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    const option = screen.getByRole('option', { name: /강남구/ })
    expect(input.getAttribute('aria-activedescendant')).toBe(option.id)
    expect(option.getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(
      screen.getByRole('option', { name: /서울특별시.*도시/ }).getAttribute('aria-selected'),
    ).toBe('true')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(fireEvent.keyDown(input, { key: 'Enter' })).toBe(false)
    expect(select).toHaveBeenCalledExactlyOnceWith(gangnam)
    expect(search).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(input)
    expect(input.value).toBe('강남구')
    expect(input.getAttribute('aria-expanded')).toBe('false')
    expect(input.hasAttribute('aria-activedescendant')).toBe(false)
    expect(screen.queryByRole('listbox')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '검색' }))
    expect(search).toHaveBeenCalledExactlyOnceWith(gangnam.searchParams)
    change(input, '부산광역시')
    fireEvent.click(screen.getByRole('button', { name: '검색' }))
    expect(search).toHaveBeenLastCalledWith({ destination: '부산광역시' })
  })

  it('dismisses on Escape, Tab focus movement and outside pointer, and accepts a pointer click', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.resolve(Response.json([seoul]))),
    )
    const { input, select } = renderForm()
    change(input, '서울')
    await advance()
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(document.activeElement).toBe(input)
    expect(input.value).toBe('서울')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    await advance()
    const date = screen.getByRole<HTMLButtonElement>('button', { name: '날짜' })
    expect(fireEvent.keyDown(input, { key: 'Tab' })).toBe(true)
    act(() => date.focus())
    expect(screen.queryByRole('listbox')).toBeNull()
    act(() => input.focus())
    await advance()
    fireEvent.pointerDown(date, { pointerType: 'touch' })
    expect(screen.queryByRole('listbox')).toBeNull()
    fireEvent.click(input)
    await advance()
    const row = screen.getByRole('option')
    fireEvent.pointerDown(row, { pointerType: 'touch' })
    expect(fireEvent.mouseDown(row)).toBe(false)
    fireEvent.click(row)
    expect(select).toHaveBeenCalledExactlyOnceWith(seoul)
    expect(input.value).toBe('서울특별시')
    expect(document.activeElement).toBe(input)
  })

  it.each(['empty', 'network error'] as const)(
    'keeps free input and search available on %s',
    async (scenario) => {
      const fetch =
        scenario === 'empty'
          ? vi.fn().mockResolvedValue(Response.json([]))
          : vi.fn().mockRejectedValue(new TypeError('offline'))
      vi.stubGlobal('fetch', fetch)
      const { input, search } = renderForm()
      change(input, '직접 입력')
      await advance()
      expect(screen.getAllByText(/직접 입력해 검색할 수 있습니다/)).toHaveLength(2)
      expect(screen.queryByRole('option')).toBeNull()
      expect(fireEvent.keyDown(input, { key: 'Enter' })).toBe(true)
      fireEvent.click(screen.getByRole('button', { name: '검색' }))
      expect(search).toHaveBeenCalledExactlyOnceWith({ destination: '직접 입력' })
    },
  )
})
