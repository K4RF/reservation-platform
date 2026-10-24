import type { RoomResponse } from '../../api/room'
import { RoomCard } from './RoomCard'
import type { RoomDetailContext } from './RoomDetailTrigger'

export function RoomList({ rooms, detail }: { rooms: RoomResponse[]; detail?: RoomDetailContext }) {
  if (!rooms.length) return <p role="status">등록된 객실이 없습니다.</p>
  return (
    <ul className="accommodation-list" aria-label="객실 목록">
      {rooms.map((room) => (
        <li key={room.roomId}>
          <RoomCard room={room} detail={detail} />
        </li>
      ))}
    </ul>
  )
}
