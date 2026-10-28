import { expect } from 'vitest'

// Narrow DOM regression guard, not a screen-reader, contrast or layout audit.
// Reused at checkpoints in existing flows; never sends a request or changes focus/state.
export function expectUiSemantics() {
  expect(document.querySelectorAll('main')).toHaveLength(1)
  // A header nested inside a section/main is not the global banner. Keep this DOM-only
  // guard cheap enough to reuse through the existing full lifecycle; Browser AX is separate.
  expect(
    [...document.querySelectorAll('header')].filter(
      (element) => !element.closest('main, section, article, aside, nav'),
    ),
  ).toHaveLength(1)
  expect(document.querySelectorAll('h1')).toHaveLength(1)
  const ids = [...document.querySelectorAll('[id]')].map((element) => element.id)
  expect(new Set(ids).size).toBe(ids.length)
  for (const element of document.querySelectorAll('[aria-labelledby], [aria-describedby]')) {
    for (const attribute of ['aria-labelledby', 'aria-describedby']) {
      for (const id of (element.getAttribute(attribute) ?? '').split(/\s+/).filter(Boolean)) {
        expect(document.getElementById(id), `Missing ${attribute}: ${id}`).not.toBeNull()
      }
    }
  }
  for (const element of document.querySelectorAll<
    HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
  >('input:not([type="hidden"]), select, textarea')) {
    expect(
      element.labels?.length ||
        element.getAttribute('aria-label') ||
        element.getAttribute('aria-labelledby'),
      `Unnamed control: ${element.id}`,
    ).toBeTruthy()
  }
  for (const button of document.querySelectorAll('button')) {
    expect(
      button.textContent?.trim() ||
        button.getAttribute('aria-label') ||
        button.getAttribute('aria-labelledby'),
      'Unnamed button',
    ).toBeTruthy()
  }
  for (const image of document.querySelectorAll('img')) expect(image.hasAttribute('alt')).toBe(true)
}
