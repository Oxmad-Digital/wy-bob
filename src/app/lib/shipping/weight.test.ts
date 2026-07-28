import { describe, it, expect } from 'vitest'
import { computeTotalWeightKg } from './weight'

describe('computeTotalWeightKg', () => {
  it('sums weight × quantity across lines, converted from grams to kg', () => {
    expect(
      computeTotalWeightKg([
        { product: { weight: 200 }, quantity: 2 },
        { product: { weight: 150 }, quantity: 1 },
      ])
    ).toBe(0.55)
  })

  it('defaults a missing product weight to 100g', () => {
    expect(computeTotalWeightKg([{ product: null, quantity: 1 }])).toBe(0.1)
  })

  it('never returns less than the 0.1kg floor', () => {
    expect(computeTotalWeightKg([])).toBe(0.1)
    expect(computeTotalWeightKg([{ product: { weight: 1 }, quantity: 1 }])).toBe(0.1)
  })

  it('treats a missing quantity as 1', () => {
    expect(computeTotalWeightKg([{ product: { weight: 300 }, quantity: 0 }])).toBe(0.3)
  })
})
