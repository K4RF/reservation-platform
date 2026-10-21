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
    expect(tokens.get('--color-primary')).toBe('#17675f')
    expect(tokens.get('--color-cancelled')).not.toBe(tokens.get('--color-error'))
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
    })
    for (const name of ['auth', 'form', 'result', 'reservation', 'wide']) {
      expect(globalCss).toContain(`var(--content-${name})`)
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
    expect(globalCss.match(/:focus-visible/g)).toHaveLength(1)
    expect(globalCss).toContain(':is(a, button, input, select, textarea, summary):focus-visible')
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
})
