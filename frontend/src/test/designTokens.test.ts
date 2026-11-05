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

  it('uses local fonts and a visible global keyboard focus ring', () => {
    expect(tokens.get('--font-family-body')).toContain("'Malgun Gothic'")
    expect(tokens.get('--font-family-body')).toContain('sans-serif')
    expect(tokensCss + globalCss).not.toMatch(/@font-face|https?:\/\/|url\(/)
    expect(globalCss).toContain('outline: var(--focus-ring-width) solid var(--color-focus)')
  })

  it('keeps the document reflowable and scrolls wide tables inside their own regions', () => {
    expect(globalCss).not.toContain('overflow-x: hidden')
    for (const region of [
      'booking-price-scroll',
      'reservation-price-scroll',
      'inventory-calendar',
    ]) {
      expect(globalCss).toMatch(new RegExp(`\\.${region}\\s*\\{[^}]*overflow-x: auto`))
    }
  })

  it('ships both responsive Home images as bounded local WebP assets', () => {
    for (const [size, maxBytes] of [
      [800, 80 * 1024],
      [1600, 256 * 1024],
    ]) {
      const assetPath = `../assets/brand/home-a1-${size}.webp`
      const bytes = readFileSync(fileURLToPath(new URL(assetPath, import.meta.url).href))
      expect(bytes.subarray(0, 4).toString()).toBe('RIFF')
      expect(bytes.subarray(8, 12).toString()).toBe('WEBP')
      expect(bytes.length).toBeLessThanOrEqual(maxBytes)
    }
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
    for (const scrim of ['hero-scrim', 'hero-scrim-mobile', 'header-scrim']) {
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
