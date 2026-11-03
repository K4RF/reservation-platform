import { useCallback } from 'react'
import { searchAccommodations } from '../../api/accommodation'
import { useDetailQuery } from '../../pages/useDetailQuery'
import { Link } from 'react-router'
import { CatalogImage } from '../media/CatalogImage'
import { explorationDetailPath } from '../../app/bookingContext'
import { EmptyState } from '../ui/EmptyState'
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
  const rows = state.data.content.filter((row) => row.status === 'ACTIVE').slice(0, 2)
  if (!rows.length)
    return <EmptyState message="아직 소개할 숙소가 없습니다. 전체 숙소에서 다시 살펴보세요." />
  return (
    <ul className="home-explore-grid" aria-label="숙소 목록">
      {rows.map((row) => (
        <li key={row.accommodationId}>
          <Link
            className="home-explore-card"
            to={explorationDetailPath(row.accommodationId, '')}
            aria-labelledby={`home-stay-${row.accommodationId}`}
          >
            <CatalogImage image={row.representativeImage} label="숙소 사진" />
            <div className="home-explore-caption">
              <div>
                <h3 id={`home-stay-${row.accommodationId}`}>{row.name}</h3>
                <p>
                  {[row.city, row.region].filter((value) => value?.trim()).join(' · ') ||
                    row.address}
                </p>
              </div>
              <span aria-hidden="true">↗</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}
