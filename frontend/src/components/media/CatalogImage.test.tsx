import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CatalogImage } from './CatalogImage'
import { CatalogGallery } from './CatalogGallery'
import { media } from '../../test/media'

describe('Catalog Media presentation, independent of booking state', () => {
  it('keeps source dimensions and lazy/priority policy, failure fallback and replacement identity', () => {
    const view = render(<CatalogImage image={media()} priority />)
    const image = screen.getByRole('img')
    expect(image.getAttribute('src')).toBe('/api/v1/media/1/content')
    expect(image.getAttribute('width')).toBe('1600')
    expect(image.getAttribute('height')).toBe('1000')
    expect(image.getAttribute('loading')).toBe('eager')
    expect(image.getAttribute('fetchpriority')).toBe('high')
    fireEvent.load(image)
    expect(image.parentElement?.getAttribute('data-state')).toBe('loaded')
    fireEvent.error(image)
    expect(screen.getByRole('status').textContent).toContain('불러오지 못했습니다')
    view.rerender(<CatalogImage image={media(2)} />)
    expect(screen.getByRole('img').getAttribute('src')).toContain('/2/content')
    expect(screen.getByRole('img').getAttribute('loading')).toBe('lazy')
    view.rerender(<CatalogImage image={null} label="객실 사진" />)
    expect(screen.getByText('객실 사진 미제공').closest('.catalog-image-empty')).toBeTruthy()
  })
  it('browses an ordered album without writes/selection; Escape restores focus and scroll lock', () => {
    render(<CatalogGallery images={[media(), media(2, 1)]} label="숙소 사진" />)
    const trigger = screen.getByRole('button', { name: '숙소 사진 2장 보기' })
    fireEvent.click(trigger)
    expect(screen.getByRole('dialog').getAttribute('aria-modal')).toBe('true')
    expect(document.body.style.overflow).toBe('hidden')
    fireEvent.click(screen.getByRole('button', { name: '다음 사진' }))
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '이전 사진' }))
    fireEvent.error(screen.getByRole('dialog').querySelector('img')!)
    expect(
      screen
        .getAllByRole('status')
        .map((e) => e.textContent)
        .join(' '),
    ).toContain('2 / 2')
    fireEvent.keyDown(screen.getByRole('button', { name: '이전 사진' }), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.body.style.overflow).toBe('')
    expect(document.activeElement).toBe(trigger)
    expect(screen.queryByRole('button', { name: /예약|선택/ })).toBeNull()
  })
})
