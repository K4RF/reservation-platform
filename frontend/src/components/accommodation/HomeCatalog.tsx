import { useCallback } from 'react'
import { searchAccommodations } from '../../api/accommodation'
import { useDetailQuery } from '../../pages/useDetailQuery'
import { AccommodationList } from './AccommodationList'
import { toAccommodationCard } from './accommodationView'
import { ErrorState } from '../ui/ErrorState'
import { LoadingState } from '../ui/LoadingState'

// A bounded, ID-ordered public read, not a popularity/recommendation ranking or price aggregation.
export function HomeCatalog() {
  const load = useCallback(
    (signal: AbortSignal) =>
      searchAccommodations(
        {
          status: 'ACTIVE',
          page: 0,
          size: 2,
          sortBy: 'ID',
          direction: 'ASC',
        },
        signal,
      ),
    [],
  )
  const { state, retry } = useDetailQuery(load)
  if (state.status === 'loading') return <LoadingState message="머물 곳을 불러오고 있습니다." />
  if (state.status === 'error')
    return <ErrorState message="머물 곳을 불러오지 못했습니다." onRetry={retry} />
  return (
    <AccommodationList
      accommodations={state.data.content.map(toAccommodationCard)}
      priorityFirst={false}
    />
  )
}
