// Current DTOs have no media URL. Do not model a fake gallery, loading request or property photo.
export function CatalogMediaPlaceholder({ kind }: { kind: 'accommodation' | 'room' }) {
  return (
    <div className={`catalog-media-placeholder catalog-media-${kind}`}>
      <svg aria-hidden="true" focusable="false" viewBox="0 0 48 36" fill="none">
        <rect x="1" y="1" width="46" height="34" rx="2" stroke="currentColor" />
        <path d="m2 29 13-12 9 8 8-7 14 12" stroke="currentColor" />
        <circle cx="33" cy="10" r="3" stroke="currentColor" />
      </svg>
      <span>{kind === 'accommodation' ? '숙소 사진 미제공' : '객실 사진 미제공'}</span>
    </div>
  )
}
