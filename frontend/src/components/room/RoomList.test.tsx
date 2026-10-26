import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RoomList } from './RoomList'
import { room } from '../../test/room'
import { MemoryRouter } from 'react-router'

describe('RoomList', () => {
  it('adds a truthful media slot and detail entry only in public exploration context', () => {
    const view = render(
      <RoomList rooms={[room]} detail={{ scope: 'catalog:7:0', fallbackId: 'room-list-title' }} />,
      { wrapper: MemoryRouter },
    )
    expect(screen.getByText('객실 사진 미제공')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: '스탠다드 상세 보기' }).getAttribute('aria-haspopup'),
    ).toBe('dialog')
    expect(view.container.querySelector('img')).toBeNull()
    view.rerender(<RoomList rooms={[room]} />)
    expect(screen.queryByText('객실 사진 미제공')).toBeNull()
    expect(screen.queryByRole('button', { name: '스탠다드 상세 보기' })).toBeNull()
    expect(screen.getByText('기본 1박 가격: 123,456.78')).toBeTruthy()
  })
  it('displays capacity, base nightly price and only supported amenities without claiming availability/currency', () => {
    render(
      <RoomList
        rooms={[room, { ...room, roomId: 4, name: '운영 중지 객실', status: 'INACTIVE' }]}
      />,
    )
    expect(screen.getByRole('heading', { name: '스탠다드' })).toBeTruthy()
    expect(screen.getAllByText('최대 2명')).toHaveLength(2)
    expect(screen.getAllByText('기본 1박 가격: 123,456.78')).toHaveLength(2)
    expect(screen.getAllByText('와이파이')).toHaveLength(2)
    expect(screen.getByText('운영 중지')).toBeTruthy()
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.queryByRole('button', { name: '예약' })).toBeNull()
  })
  it('shows an accessible empty list', () => {
    render(<RoomList rooms={[]} />)
    expect(screen.getByRole('status').textContent).toBe('등록된 객실이 없습니다.')
  })
})
