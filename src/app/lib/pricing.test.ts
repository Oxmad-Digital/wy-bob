import { describe, it, expect } from 'vitest'
import { round2, computeOrderTotals } from './pricing'

describe('round2', () => {
  it('rounds to 2 decimal places', () => {
    expect(round2(19.995)).toBe(20)
    expect(round2(19.994)).toBe(19.99)
    expect(round2(10)).toBe(10)
  })
})

describe('computeOrderTotals', () => {
  it('sums subtotal and shipping (no insurance by default)', () => {
    expect(computeOrderTotals(49.9, 6.9)).toEqual({ subtotal: 49.9, shipping: 6.9, insurance: 0, total: 56.8 })
  })

  it('never lets a negative discounted subtotal go below zero', () => {
    expect(computeOrderTotals(-10, 6.9)).toEqual({ subtotal: 0, shipping: 6.9, insurance: 0, total: 6.9 })
  })

  it('rounds floating point drift away', () => {
    // 0.1 + 0.2 style drift must not leak into the total
    expect(computeOrderTotals(19.1, 0.2)).toEqual({ subtotal: 19.1, shipping: 0.2, insurance: 0, total: 19.3 })
  })

  it('adds the optional insurance fee into the total', () => {
    expect(computeOrderTotals(49.9, 6.9, 5)).toEqual({ subtotal: 49.9, shipping: 6.9, insurance: 5, total: 61.8 })
  })
})
