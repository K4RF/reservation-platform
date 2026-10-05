import type { RoomResponse } from '../../api/room'

export function RoomCard({ room }: { room: RoomResponse }) {
  return (
    <article className="accommodation-card">
      <h3>{room.name}</h3>
      <p>최대 {room.capacity}명</p>
      <p>
        기본 1박 가격: {room.nightlyPrice.toLocaleString('ko-KR', { maximumFractionDigits: 20 })}
      </p>
      <p>{room.status === 'ACTIVE' ? '운영 중' : '운영 중지'}</p>
      {room.amenities.length > 0 && (
        <ul aria-label="객실 편의시설">
          {room.amenities.map((item) => (
            <li key={item}>{item === 'WIFI' ? '와이파이' : '에어컨'}</li>
          ))}
        </ul>
      )}
    </article>
  )
}
