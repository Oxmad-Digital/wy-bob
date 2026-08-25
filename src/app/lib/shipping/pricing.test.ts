import { describe, it, expect } from 'vitest'
import { computeShippingFee } from './pricing'
import { resolveCountryShipping } from './zones'

describe('resolveCountryShipping', () => {
  it('resolves known countries to their product/zone', () => {
    expect(resolveCountryShipping('FR')).toEqual({ product: 'national', zone: 0, delayDays: 1, relay: { zone: 0 } })
    expect(resolveCountryShipping('de').product).toBe('classic') // case-insensitive
    expect(resolveCountryShipping('CH').product).toBe('classic')
    expect(resolveCountryShipping('US').product).toBe('express')
  })

  it('falls back to a safe express zone for unknown/empty countries', () => {
    expect(resolveCountryShipping('ZZ').product).toBe('express')
    expect(resolveCountryShipping('').product).toBe('express')
  })
})

describe('computeShippingFee', () => {
  it('picks the correct weight bracket for a France home delivery', () => {
    expect(computeShippingFee({ country: 'FR', weightKg: 0.3, deliveryMethod: 'home' })).toBe(10.9)
    expect(computeShippingFee({ country: 'FR', weightKg: 1, deliveryMethod: 'home' })).toBe(10.9)
    expect(computeShippingFee({ country: 'FR', weightKg: 1.1, deliveryMethod: 'home' })).toBe(11.34)
  })

  it('caps at the 30kg bracket for very heavy parcels', () => {
    expect(computeShippingFee({ country: 'FR', weightKg: 50, deliveryMethod: 'home' })).toBe(26.65)
  })

  it('charges relay delivery less than home delivery for the same zone/weight', () => {
    const home = computeShippingFee({ country: 'FR', weightKg: 1, deliveryMethod: 'home' })
    const relay = computeShippingFee({ country: 'FR', weightKg: 1, deliveryMethod: 'relay' })
    expect(relay).toBeLessThan(home)
  })

  it('falls back to home pricing when relay is requested beyond the 20kg relay cap', () => {
    const relayHeavy = computeShippingFee({ country: 'FR', weightKg: 25, deliveryMethod: 'relay' })
    const homeHeavy = computeShippingFee({ country: 'FR', weightKg: 25, deliveryMethod: 'home' })
    expect(relayHeavy).toBe(homeHeavy)
  })

  it('charges more for farther zones at the same weight/mode', () => {
    // À 1kg, le tarif Chrono Classic zone 1 (Allemagne) est quasi identique au tarif
    // domestique (grille contractuelle réelle) — l'écart se creuse à partir de quelques kg.
    const fr = computeShippingFee({ country: 'FR', weightKg: 5, deliveryMethod: 'home' })
    const classicEu = computeShippingFee({ country: 'DE', weightKg: 5, deliveryMethod: 'home' })
    const express = computeShippingFee({ country: 'US', weightKg: 5, deliveryMethod: 'home' })
    expect(classicEu).toBeGreaterThan(fr)
    expect(express).toBeGreaterThan(classicEu)
  })

  it('has no relay pricing for Chrono Express-only countries (falls back to home)', () => {
    const relay = computeShippingFee({ country: 'US', weightKg: 1, deliveryMethod: 'relay' })
    const home = computeShippingFee({ country: 'US', weightKg: 1, deliveryMethod: 'home' })
    expect(relay).toBe(home)
  })
})
