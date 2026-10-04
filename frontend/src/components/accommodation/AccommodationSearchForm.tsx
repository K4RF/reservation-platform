import { useState, type FormEvent } from 'react'
import type { AccommodationSearchRequest } from '../../api/accommodation'

export function AccommodationSearchForm({
  onSearch,
}: {
  onSearch: (request: AccommodationSearchRequest) => void
}) {
  const [error, setError] = useState('')
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const read = (key: string) => String(data.get(key) ?? '').trim()
    const checkInDate = read('checkInDate')
    const checkOutDate = read('checkOutDate')
    if (
      Boolean(checkInDate) !== Boolean(checkOutDate) ||
      (checkInDate && checkInDate >= checkOutDate)
    ) {
      setError('체크인과 체크아웃을 함께 입력하고 체크아웃을 더 늦은 날짜로 선택하세요.')
      return
    }
    if (
      read('minPrice') &&
      read('maxPrice') &&
      Number(read('minPrice')) > Number(read('maxPrice'))
    ) {
      setError('최대 가격은 최소 가격 이상이어야 합니다.')
      return
    }
    setError('')
    onSearch({
      name: read('name') || undefined,
      city: read('city') || undefined,
      region: read('region') || undefined,
      checkInDate: checkInDate || undefined,
      checkOutDate: checkOutDate || undefined,
      guestCount: read('guestCount') ? Number(read('guestCount')) : undefined,
      minPrice: read('minPrice') || undefined,
      maxPrice: read('maxPrice') || undefined,
      status: 'ACTIVE',
      sortBy: read('sortBy') === 'NAME' ? 'NAME' : 'ID',
      direction: 'ASC',
      page: 0,
      size: 20,
    })
  }
  return (
    <form className="accommodation-search-form" onSubmit={submit} aria-label="숙소 검색 조건">
      {(['name', 'city', 'region'] as const).map((name, index) => (
        <div className="form-field" key={name}>
          <label htmlFor={`search-${name}`}>
            {['숙소명', '도시 (정확한 이름)', '지역 (정확한 이름)'][index]}
          </label>
          <input id={`search-${name}`} name={name} maxLength={100} />
        </div>
      ))}
      {(['checkInDate', 'checkOutDate'] as const).map((name, index) => (
        <div className="form-field" key={name}>
          <label htmlFor={`search-${name}`}>{['체크인', '체크아웃'][index]}</label>
          <input id={`search-${name}`} name={name} type="date" />
        </div>
      ))}
      <div className="form-field">
        <label htmlFor="search-guests">인원</label>
        <input id="search-guests" name="guestCount" type="number" min="1" step="1" />
      </div>
      {(['minPrice', 'maxPrice'] as const).map((name, index) => (
        <div className="form-field" key={name}>
          <label htmlFor={`search-${name}`}>
            {['최소 기본 1박 가격', '최대 기본 1박 가격'][index]}
          </label>
          <input id={`search-${name}`} name={name} type="number" min="0" step="0.01" />
        </div>
      ))}
      <div className="form-field">
        <label htmlFor="search-sort">정렬</label>
        <select id="search-sort" name="sortBy">
          <option value="ID">등록순</option>
          <option value="NAME">이름순</option>
        </select>
      </div>
      <button type="submit">검색</button>
      {error && <p role="alert">{error}</p>}
    </form>
  )
}
