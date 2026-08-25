import { describe, it, expect } from 'vitest'
import { computeInsuranceFee, computeInsurableValue, MAX_INSURED_VALUE_EUR } from './insurance'

describe('computeInsurableValue', () => {
  it('caps at the contract maximum', () => {
    expect(computeInsurableValue(8000)).toBe(MAX_INSURED_VALUE_EUR)
  })

  it('never goes negative', () => {
    expect(computeInsurableValue(-10)).toBe(0)
  })
})

describe('computeInsuranceFee', () => {
  it('applies the 0.9% rate above the minimum threshold', () => {
    // 1000 * 0.9% = 9, above the 5€ minimum
    expect(computeInsuranceFee(1000)).toBe(9)
  })

  it('applies the 5€ minimum for low cart values', () => {
    // 100 * 0.9% = 0.9, below the 5€ minimum
    expect(computeInsuranceFee(100)).toBe(5)
  })

  it('caps the fee at the maximum insurable value (5000€)', () => {
    // Beyond 5000€, the fee never grows further
    expect(computeInsuranceFee(9000)).toBe(computeInsuranceFee(5000))
    expect(computeInsuranceFee(5000)).toBe(45)
  })

  it('returns 0 for an empty cart', () => {
    expect(computeInsuranceFee(0)).toBe(0)
  })
})
