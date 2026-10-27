/// <reference types="node" />
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Vitest's default CSS stub is intentional; inspect source without enabling CSS for every UI suite.
const readCss = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url).href), 'utf8')
const tokensSource = readCss('../styles/tokens.css')
const globalSource = readCss('../index.css')

const withoutComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '')
const tokensCss = withoutComments(tokensSource)
const globalCss = withoutComments(globalSource)
const declarations = [...tokensCss.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)]
const tokens = new Map(declarations.map(([, name, value]) => [name, value.trim()]))
const references = (value: string) => [...value.matchAll(/var\((--[\w-]+)\)/g)].map((m) => m[1])

// Source contracts only: jsdom does not prove actual CSS variable layout or focus rendering.
describe('design token and global stylesheet contracts', () => {
  it('loads a single token source before global rules without local redefinitions', () => {
    expect(globalCss.trimStart().startsWith("@import './styles/tokens.css';")).toBe(true)
    expect(tokensCss.match(/:root\s*\{/g)).toHaveLength(1)
    expect(declarations.length).toBe(tokens.size)
    expect(globalCss).not.toMatch(/--[\w-]+\s*:/)
  })

  it('resolves every variable with no missing or circular dependency', () => {
    function visit(name: string, chain: string[] = []) {
      expect(tokens.has(name), `Missing ${name}`).toBe(true)
      expect(chain, `Circular token ${name}`).not.toContain(name)
      for (const child of references(tokens.get(name)!)) visit(child, [...chain, name])
    }
    for (const name of references(tokensCss + globalCss)) visit(name)
  })

  it('keeps color literals in tokens, not page rules', () => {
    expect(globalCss).not.toMatch(/#[\da-f]{3,8}\b|\b(?:rgb|hsl)a?\(/i)
    for (const role of [
      'primary',
      'secondary',
      'background',
      'surface',
      'text',
      'border',
      'success',
      'error',
      'warning',
    ]) {
      expect(tokens.has(`--color-${role}`)).toBe(true)
    }
    expect(tokens.get('--color-primary')).toBe('#253b59')
    expect(tokens.get('--color-cancelled')).not.toBe(tokens.get('--color-error'))
  })

  it('maps the approved Navy and Ivory palette without turning Coral into text, CTA or status', () => {
    for (const [role, value] of Object.entries({
      primary: '#253b59',
      background: '#f7f4ee',
      surface: '#fffefa',
      text: '#2c3038',
      'text-muted': '#65676a',
      border: '#ddd9d1',
      accent: '#b96f55',
      focus: 'var(--color-primary)',
    })) {
      expect(tokens.get(`--color-${role}`)).toBe(value)
    }
    expect(globalCss.match(/var\(--color-accent\)/g)).toHaveLength(1)
    expect(globalCss).toMatch(/\.eyebrow\s*\{[^}]*border-inline-start:[^;]*var\(--color-accent\);/)
    for (const [role, color] of Object.entries({
      success: '#205c4d',
      error: '#b42318',
      warning: '#854d0e',
      cancelled: '#655044',
    })) {
      expect(tokens.get(`--color-${role}`)).toBe(color)
      expect(tokens.get(`--color-${role}`)).not.toBe(tokens.get('--color-primary'))
      expect(tokens.get(`--color-${role}`)).not.toBe(tokens.get('--color-accent'))
    }
  })

  it('uses local display serif with Korean UI sans fallback without loading a remote font', () => {
    expect(tokens.get('--font-family-display')).toBe(
      "Georgia, 'Times New Roman', var(--font-family-body)",
    )
    expect(tokens.get('--font-family-body')).toContain("'Malgun Gothic'")
    expect(tokens.get('--font-family-body')).toContain('sans-serif')
    expect(globalCss.match(/font-family: var\(--font-family-display\)/g)).toHaveLength(4)
    expect(tokensCss + globalCss).not.toMatch(/@font-face|https?:\/\/|url\(/)
    expect(tokens.get('--leading-body')).toBe('1.6')
    expect(tokens.get('--control-min-height')).toBe('2.75rem')
    expect(tokens.get('--space-4')).toBe('1rem')
  })

  it('preserves role-based content widths rather than forcing a single page width', () => {
    expect(
      Object.fromEntries([...tokens].filter(([name]) => name.startsWith('--content-'))),
    ).toEqual({
      '--content-auth': '28rem',
      '--content-form': '32rem',
      '--content-result': '45rem',
      '--content-reservation': '60rem',
      '--content-wide': '70rem',
      '--content-catalog': '80rem',
    })
    for (const name of ['auth', 'form', 'result', 'reservation', 'wide', 'catalog']) {
      expect(globalCss).toContain(`var(--content-${name})`)
    }
  })

  it('scopes the Search comparison layout with two-column cards, a native filter disclosure and bounded media slots', () => {
    expect(globalCss).toMatch(/\.accommodation-search-page\s*\{[^}]*var\(--content-catalog\)/)
    expect(globalCss).toMatch(/\.accommodation-list\s*\{[^}]*repeat\(2, minmax\(0, 1fr\)\)/)
    expect(globalCss).toMatch(
      /\.search-comparison-layout\s*\{[^}]*minmax\(0, 15rem\) minmax\(0, 1fr\)/,
    )
    expect(globalCss).toMatch(/\.catalog-card-visual\s*\{[^}]*aspect-ratio: 16 \/ 10;/)
    expect(globalCss).toContain('.accommodation-search-form.catalog-search-form')
    expect(globalCss).toMatch(
      /@media \(max-width: 48rem\)\s*\{\s*\.accommodation-list\s*\{\s*grid-template-columns: minmax\(0, 1fr\);/,
    )
    expect(globalCss).not.toContain('overflow-x: hidden')
  })

  it('keeps cinematic imagery local and bounded while isolating the Home layout and inverse focus', () => {
    expect(globalCss).toMatch(/\.site-main:has\(> \.home-page\)\s*\{[^}]*padding: 0;/)
    expect(globalCss).toMatch(/\.home-hero\s*\{[^}]*min-height: 40rem;/)
    expect(globalCss).toMatch(/\.home-hero-image\s*\{[^}]*object-fit: cover;/)
    expect(globalCss).toContain('var(--color-hero-scrim) 60%')
    expect(globalCss).toMatch(/\.home-hero-copy\s*\{[^}]*max-width: min\(42rem, 60%\);/)
    expect(globalCss).toContain('background: var(--color-hero-scrim-mobile)')
    // Provenance/failure text must grow in flow rather than overlap the copy at 200% text scale.
    expect(globalCss).toMatch(/\.home-image-note\s*\{[^}]*order: -1;/)
    expect(globalCss).not.toMatch(/\.home-image-note\s*\{[^}]*position: absolute;/)
    for (const [size, maxBytes] of [
      [800, 80 * 1024],
      [1600, 256 * 1024],
    ]) {
      const assetPath = `../assets/brand/coast-hero-${size}.webp`
      const bytes = readFileSync(fileURLToPath(new URL(assetPath, import.meta.url).href))
      expect(bytes.subarray(0, 4).toString()).toBe('RIFF')
      expect(bytes.subarray(8, 12).toString()).toBe('WEBP')
      expect(bytes.length).toBeLessThanOrEqual(maxBytes)
    }
  })

  it('defines shared typography, spacing, radius, shadow and focus roles', () => {
    for (const name of [
      'font-family-body',
      'font-size-base',
      'font-weight-regular',
      'leading-body',
      'space-4',
      'radius-card',
      'shadow-none',
      'shadow-raised',
      'focus-ring-width',
    ]) {
      expect(tokens.has(`--${name}`)).toBe(true)
    }
    expect(globalCss.match(/:focus-visible/g)).toHaveLength(3)
    expect(globalCss).toMatch(
      /\.home-search-jump:focus-visible\s*\{[^}]*outline-color: var\(--color-on-primary\);/,
    )
    expect(globalCss).toContain(
      ':is(a, button, input, select, textarea, summary, [tabindex]):focus-visible',
    )
    expect(globalCss).toContain('outline: var(--focus-ring-width) solid var(--color-focus)')
  })

  it('does not reintroduce the overwritten brand or authentication cascade', () => {
    expect(globalCss.match(/\.site-brand\s*\{/g)).toHaveLength(1)
    expect(globalCss.match(/\.home-link\s*\{/g)).toHaveLength(1)
    expect(globalCss.match(/\.signup-form button,\s*\.login-form button\s*\{/g)).toHaveLength(1)
    // Authentication now inherits the common submit/hover appearance, not a private duplicate.
    expect(globalCss).not.toContain('.signup-form button:hover')
    expect(globalCss.match(/button\[type='submit'\]:hover:enabled/g)).toHaveLength(1)
    expect(globalCss).not.toContain('var(--accent)')
  })

  it('scopes Auth branding and content panels with form-first mobile reflow and visible inverse focus', () => {
    expect(globalCss).toMatch(/\.auth-page\s*\{[^}]*grid-template-areas: 'introduction form';/)
    expect(globalCss).toMatch(/\.auth-panel\s*\{[^}]*var\(--content-auth\)/)
    expect(globalCss).toContain("grid-template-areas: 'form' 'introduction'")
    expect(globalCss).toMatch(
      /\.auth-introduction a:focus-visible\s*\{[^}]*outline-color: var\(--color-on-primary\);/,
    )
    expect(globalCss).not.toContain('overflow-x: hidden')
  })

  it('shares a single scoped alert skin and removes only the retired empty-state selector', () => {
    const skins = [...globalCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(
      ([, selector, body]) =>
        selector.includes("[role='alert']") &&
        body.includes('background: var(--color-error-surface)'),
    )
    expect(skins).toHaveLength(1)
    for (const scope of [
      'auth-page',
      'home-page',
      'accommodation-search-page',
      'accommodation-detail-page',
      'booking-complete-page',
      'my-reservations-page',
      'reservation-detail-page',
      'admin-content',
    ]) {
      expect(skins[0][1]).toContain(`.${scope}`)
    }
    expect(globalCss).not.toContain('.admin-empty-state')
    // These are rendered via dynamic status class names, not unused literal selectors.
    for (const state of [
      'booking-result-cancelled',
      'reservation-status-confirmed',
      'reservation-status-cancelled',
      'reservation-summary-cancelled',
    ]) {
      expect(globalCss).toContain(`.${state}`)
    }
  })

  it('styles the shared brand and navigation without hiding role-dependent menus', () => {
    expect(globalCss).toMatch(/\.site-brand-mark\s*\{[^}]*border: 1px solid currentColor;/)
    expect(globalCss).toMatch(/\.site-brand-name\s*\{[^}]*font-family: var\(--font-family-body\);/)
    expect(globalCss).toMatch(
      /\.nav-link\[aria-current='page'\]\s*\{[^}]*text-decoration: underline;/,
    )
    expect(globalCss).toMatch(
      /\.admin-sidebar \.nav-link-active\s*\{[^}]*color: var\(--color-on-primary\);/,
    )
    expect(globalCss).toContain(
      'grid-template-columns: repeat(auto-fit, minmax(min(100%, 5.5rem), 1fr))',
    )
    expect(globalCss).not.toMatch(/\.site-nav\s*\{[^}]*display: none/)
    expect(globalCss).toMatch(/\.site-footer\s*\{[^}]*flex-wrap: wrap;/)
  })

  it('makes disabled, loading and empty presentation distinct without opacity-only signalling', () => {
    expect(globalCss).toMatch(/button:disabled\s*\{[^}]*opacity: 1;[^}]*border-style: dashed;/)
    expect(globalCss).toMatch(/\.ui-state\.ui-loading\s*\{[^}]*border-inline-start:[^;]*dashed/)
    expect(globalCss).toMatch(/\.ui-state\.ui-empty\s*\{[^}]*border-style: dashed;/)
    expect(globalCss).toContain(".room-availability > p[role='status']:not(.ui-state)")
    expect(globalCss).toContain(".reservation-detail-page > p[role='status']:not(.ui-state)")
    expect(globalCss).toContain(':hover:enabled:not(')
    expect(globalCss).toMatch(/\.stay-calendar\s*\{[^}]*background: var\(--color-surface\);/)
    expect(globalCss).toMatch(/\.stay-calendar-grid \.stay-date-boundary\s*\{[^}]*box-shadow:/)
    expect(globalCss).toMatch(/\.stay-calendar-scroll\s*\{[^}]*overflow-x: auto;/)
    expect(globalCss).toMatch(/\.stay-calendar-grid\s*\{[^}]*min-width: 14rem;/)
    expect(globalCss).toMatch(/\.room-detail-header\s*\{[^}]*background: var\(--color-secondary\);/)
  })

  it('shares controls without suppressing native disabled or confirmation semantics', () => {
    expect(globalCss).toContain(".nav-link[aria-current='page']")
    expect(globalCss).toContain("button[aria-busy='true']")
    expect(globalCss).toContain("input:is([type='checkbox'], [type='radio'])")
    expect(globalCss).toContain("[aria-invalid='true']")
    expect(globalCss).toContain('.confirmation-panel {')
    expect(globalCss).not.toContain('pointer-events: none')
    expect(globalCss).not.toContain('appearance: none')
    expect(globalCss).not.toContain('.admin-content button {')
  })

  it('scopes booking price overflow and result actions without clipping the document', () => {
    expect(globalCss).toMatch(/\.booking-price-scroll\s*\{[^}]*overflow-x: auto;/)
    expect(globalCss).toMatch(
      /\.booking-summary \.booking-price-table\s*\{[^}]*table-layout: auto;/,
    )
    expect(globalCss).toMatch(/\.booking-result-actions\s*\{[^}]*gap: var\(--space-3\);/)
    expect(globalCss).toContain(
      '.availability-room-item.availability-room-selected .accommodation-card',
    )
    expect(globalCss).not.toContain('overflow-x: hidden')
  })
  it('keeps Detail introduction, selection panels and media scoped without overlaying mobile or keyboard content', () => {
    expect(globalCss).toMatch(/\.accommodation-detail-page\s*\{[^}]*var\(--content-catalog\)/)
    expect(globalCss).toMatch(
      /\.accommodation-overview-grid\s*\{[^}]*minmax\(0, 1\.5fr\) minmax\(0, 1fr\)/,
    )
    expect(globalCss).toMatch(
      /\.availability-results-layout\s*\{[^}]*minmax\(0, 1\.7fr\) minmax\(0, 1fr\)/,
    )
    expect(globalCss).toMatch(/\.room-selection-panel\s*\{[^}]*position: static;/)
    expect(globalCss).toMatch(/\.detail-section-nav\s*\{[^}]*position: static;/)
    expect(globalCss).toMatch(/\.catalog-media-accommodation\s*\{[^}]*aspect-ratio: 16 \/ 5;/)
    expect(globalCss).toMatch(
      /\.catalog-media-placeholder\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\);[^}]*width: 100%;[^}]*max-width: 100%;/,
    )
    expect(globalCss).toContain('@media (max-width: 24rem), (max-height: 36rem)')
    expect(globalCss).toContain(
      '.catalog-room-card-exploration .room-card-content > :is(h3, p, ul)',
    )
    expect(globalCss).toContain('.catalog-room-card-exploration > .catalog-media-room')
    expect(globalCss).not.toContain('overflow-x: hidden')
  })

  it('separates Booking steps, expected prices and saved result panels with normal-flow CTAs', () => {
    expect(globalCss).toMatch(/\.booking-input-layout\s*\{[^}]*minmax\(0, 1fr\) minmax\(0, 1fr\)/)
    expect(globalCss).toContain('.availability-results-layout:has(.booking-flow)')
    expect(globalCss).toMatch(/\.booking-steps\s*\{[^}]*repeat\(2, minmax\(0, 1fr\)\)/)
    expect(globalCss).toContain(".booking-steps > [aria-current='step']")
    expect(globalCss).toMatch(/\.booking-submit-actions\s*\{[^}]*position: static;/)
    expect(globalCss).toMatch(/\.booking-result-grid\s*\{[^}]*minmax\(0, 1\.2fr\) minmax\(0, 1fr\)/)
    expect(globalCss).toMatch(/\.booking-result-grid > section\s*\{[^}]*min-width: 0;/)
    expect(globalCss).toContain('@media (max-width: 48rem)')
    expect(globalCss).not.toContain('overflow-x: hidden')
  })

  it('keeps reservation money tables scrollable and cancellation warnings separate from saved results', () => {
    expect(globalCss).toMatch(/\.reservation-price-scroll\s*\{[^}]*overflow-x: auto;/)
    expect(globalCss).toMatch(
      /\.reservation-price-scroll \.booking-price-table\s*\{[^}]*table-layout: auto;/,
    )
    expect(globalCss).toMatch(
      /\.reservation-cancel-confirmation\s*\{[^}]*border-color: var\(--color-error\);/,
    )
    expect(globalCss).toMatch(
      /\.reservation-operation-result\s*\{[^}]*border-color: var\(--color-success\);/,
    )
    expect(globalCss).toContain('.reservation-quote-unavailable')
  })

  it('scopes owner reservation snapshots and schedule comparisons without moving mutation CTAs over content', () => {
    expect(globalCss).toMatch(
      /\.reservation-snapshot-grid\s*\{[^}]*minmax\(0, 1fr\) minmax\(0, 1fr\)/,
    )
    expect(globalCss).toMatch(/\.reservation-snapshot-wide\s*\{[^}]*grid-column: 1 \/ -1;/)
    expect(globalCss).toMatch(
      /\.reservation-schedule-comparison\s*\{[^}]*minmax\(0, 1fr\) minmax\(0, 1fr\)/,
    )
    expect(globalCss).toMatch(/\.reservation-mutation-actions\s*\{[^}]*position: static;/)
    expect(globalCss).toContain('.reservation-result-disclaimer')
    expect(globalCss).not.toContain('overflow-x: hidden')
  })

  it('keeps Admin layout, status, recovery and Calendar styles scoped without clipping tables', () => {
    expect(globalCss).toMatch(/\.admin-sidebar ul\s*\{[^}]*grid-template-columns: repeat\(3,/)
    expect(globalCss).toMatch(/\.admin-query-form\s*\{[^}]*align-items: end;/)
    expect(globalCss).toMatch(/\.inventory-calendar\s*\{[^}]*overflow-x: auto;/)
    expect(globalCss).toMatch(/\.inventory-calendar table\s*\{[^}]*table-layout: auto;/)
    expect(globalCss).toContain(".inventory-calendar button[aria-pressed='true']")
    expect(globalCss).toContain(
      ".admin-status-badge:is([data-status='INACTIVE'], [data-status='CLOSED'])",
    )
    expect(globalCss).toMatch(
      /\.admin-recovery-panel\s*\{[^}]*border-color: var\(--color-warning\);/,
    )
    expect(globalCss).toMatch(
      /\.admin-content \.admin-save-success\s*\{[^}]*border-color: var\(--color-success\);/,
    )
  })

  it('allows scrollbar-width reflow, wraps long text and keeps focus on scroll regions visible', () => {
    expect(globalCss).toMatch(/body\s*\{[^}]*min-width: 0;[^}]*overflow-wrap: anywhere;/)
    expect(globalCss).not.toMatch(/min-width:\s*320px/)
    expect(globalCss).toMatch(/\.site-main\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\);/)
    expect(globalCss).toMatch(/\.skip-link\s*\{[^}]*z-index: 3;/)
    expect(globalCss).toMatch(/\.form-field\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\);/)
    expect(globalCss).toMatch(/\.guest-count-controls\s*\{[^}]*flex-wrap: wrap;/)
    expect(globalCss).toMatch(/\.room-detail-header\s*\{[^}]*flex-wrap: wrap;/)
    expect(globalCss).toMatch(
      /:is\(\.confirmation-check, \.admin-check, \.amenity-option\)\s*\{[^}]*min-height: var\(--control-min-height\);/,
    )
  })

  it('meets semantic text/control contrast thresholds with Navy focus and decorative Coral', () => {
    function resolve(name: string): string {
      const value = tokens.get(`--color-${name}`)!
      const variable = references(value)[0]
      return variable ? resolve(variable.slice('--color-'.length)) : value
    }
    function luminance(value: string) {
      const hex = value.slice(1)
      const full =
        hex.length === 3
          ? hex
              .split('')
              .map((c) => c + c)
              .join('')
          : hex
      const [r, g, b] = [0, 2, 4]
        .map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
        .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    function contrast(foreground: string, background: string) {
      const a = luminance(resolve(foreground)),
        b = luminance(resolve(background))
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
    }
    for (const surface of ['surface', 'background', 'secondary']) {
      for (const text of ['text', 'text-muted', 'text-subtle', 'primary']) {
        expect(contrast(text, surface), `${text}/${surface}`).toBeGreaterThanOrEqual(4.5)
      }
      expect(contrast('border-control', surface), `border/${surface}`).toBeGreaterThanOrEqual(3)
      expect(contrast('focus', surface), `focus/${surface}`).toBeGreaterThanOrEqual(3)
    }
    for (const state of ['success', 'error', 'warning', 'cancelled']) {
      expect(contrast(state, `${state}-surface`), state).toBeGreaterThanOrEqual(4.5)
    }
    expect(contrast('on-primary', 'primary')).toBeGreaterThanOrEqual(4.5)
    expect(contrast('on-primary', 'primary-hover')).toBeGreaterThanOrEqual(4.5)
    for (const surface of ['surface', 'background', 'secondary']) {
      expect(contrast('accent', surface), `decorative accent/${surface}`).toBeGreaterThanOrEqual(3)
    }
    // Worst-case opaque white photo beneath the copy's minimum scrim alpha.
    for (const scrim of ['hero-scrim', 'hero-scrim-mobile']) {
      const hex = resolve(scrim).slice(1)
      const alpha = parseInt(hex.slice(6, 8), 16) / 255
      const composite =
        '#' +
        [0, 2, 4]
          .map((i) =>
            Math.round(parseInt(hex.slice(i, i + 2), 16) * alpha + 255 * (1 - alpha))
              .toString(16)
              .padStart(2, '0'),
          )
          .join('')
      expect(
        (luminance(resolve('on-primary')) + 0.05) / (luminance(composite) + 0.05),
        scrim,
      ).toBeGreaterThanOrEqual(4.5)
    }
  })
})
