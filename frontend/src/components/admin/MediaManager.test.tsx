import { useState } from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getMediaAlbum, writeMedia } from '../../api/adminMedia'
import { ApiError } from '../../api/errors'
import { album, media } from '../../test/media'
import { MediaManager } from './MediaManager'
import { useAdminMutation } from './useAdminMutation'

vi.mock('../../api/adminMedia', async (original) => ({
  ...(await original<typeof import('../../api/adminMedia')>()),
  getMediaAlbum: vi.fn(),
  writeMedia: vi.fn(),
}))
const owner = { type: 'ACCOMMODATION', id: 7 } as const
const current = album(owner, [media()])
beforeEach(() => {
  vi.mocked(getMediaAlbum).mockReset().mockResolvedValue(current)
  vi.mocked(writeMedia).mockReset().mockResolvedValue(current)
})
function Harness({ id = 7, verified = true }: { id?: number; verified?: boolean }) {
  const mutation = useAdminMutation(),
    [blocked, setBlocked] = useState(false)
  return (
    <>
      <button disabled={mutation.disabled || blocked}>다른 정보 저장</button>
      <MediaManager
        key={id}
        owner={{ type: 'ACCOMMODATION', id }}
        verified={verified}
        mutation={mutation}
        setBlocked={setBlocked}
      />
    </>
  )
}
async function prepare() {
  fireEvent.click(screen.getByRole('button', { name: '사진 관리 목록 새로 조회' }))
  await screen.findByRole('form', { name: '사진 작업' })
  fireEvent.change(screen.getByLabelText('사진 작업 종류'), { target: { value: 'metadata' } })
  fireEvent.change(screen.getByLabelText('사진 대체 텍스트'), { target: { value: '수정된 설명' } })
  fireEvent.click(screen.getByLabelText('대상·작업·사진 사용권을 확인했으며 한 번 제출합니다.'))
}
const submit = () => fireEvent.submit(screen.getByRole('form', { name: '사진 작업' }))

describe('Media management shared gate and review recovery', () => {
  it('does not fetch/write before a verified owner and an explicit read', async () => {
    const view = render(<Harness verified={false} />)
    expect(screen.getByRole('button', { name: '사진 관리 목록 새로 조회' })).toHaveProperty(
      'disabled',
      true,
    )
    expect(getMediaAlbum).not.toHaveBeenCalled()
    view.rerender(<Harness />)
    await prepare()
    expect(writeMedia).not.toHaveBeenCalled()
    expect(getMediaAlbum).toHaveBeenCalledOnce()
  })
  it('blocks duplicate/other writes through upload and fresh GET; keeps editing separate from mutations', async () => {
    let finish!: (value: typeof current) => void
    vi.mocked(writeMedia).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    render(<Harness />)
    await prepare()
    submit()
    submit()
    expect(writeMedia).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: '다른 정보 저장' })).toHaveProperty('disabled', true)
    expect(screen.getByRole('progressbar')).toBeTruthy()
    await act(async () => finish(current))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '다른 정보 저장' })).toHaveProperty(
        'disabled',
        false,
      ),
    )
    expect(getMediaAlbum).toHaveBeenCalledTimes(2)
  })
  it.each([409, 500])(
    'keeps all writes locked after %s until fresh GET and explicit review, never replays',
    async (status) => {
      vi.mocked(writeMedia).mockRejectedValue(new ApiError('실패', { kind: 'http', status }))
      render(<Harness />)
      await prepare()
      submit()
      await screen.findByRole('region', { name: '사진 작업 결과 확인' })
      expect(screen.getByLabelText('사진 대체 텍스트')).toHaveProperty('value', '수정된 설명')
      const unlock = screen.getByRole('button', { name: '사진 결과 확인 후 새 작업 준비' })
      expect(unlock).toHaveProperty('disabled', true)
      fireEvent.click(screen.getByRole('button', { name: '사진 관리 목록 새로 조회' }))
      await waitFor(() =>
        expect(screen.getByLabelText('새로 조회한 사진 작업 결과를 확인했습니다.')).toHaveProperty(
          'disabled',
          false,
        ),
      )
      expect(unlock).toHaveProperty('disabled', true)
      expect(screen.getByRole('button', { name: '다른 정보 저장' })).toHaveProperty(
        'disabled',
        true,
      )
      fireEvent.click(screen.getByLabelText('새로 조회한 사진 작업 결과를 확인했습니다.'))
      fireEvent.click(unlock)
      expect(writeMedia).toHaveBeenCalledOnce()
      expect(screen.getByRole('button', { name: '다른 정보 저장' })).toHaveProperty(
        'disabled',
        false,
      )
      expect(screen.queryByRole('region', { name: '사진 작업 결과 확인' })).toBeNull()
    },
  )
  it('retains a successful write as uncertain if follow-up GET fails and ignores a stale owner read', async () => {
    vi.mocked(getMediaAlbum)
      .mockResolvedValueOnce(current)
      .mockRejectedValueOnce(new TypeError('offline'))
    const view = render(<Harness />)
    await prepare()
    submit()
    await screen.findByRole('region', { name: '사진 작업 결과 확인' })
    expect(screen.getByRole('button', { name: '다른 정보 저장' })).toHaveProperty('disabled', true)
    let finish!: (value: typeof current) => void
    vi.mocked(getMediaAlbum).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: '사진 관리 목록 새로 조회' }))
    view.rerender(<Harness id={8} />)
    await act(async () => finish(current))
    expect(screen.queryByRole('form', { name: '사진 작업' })).toBeNull()
    expect(within(screen.getByRole('region', { name: '사진 관리' })).getByText(/#8/)).toBeTruthy()
  })
})
