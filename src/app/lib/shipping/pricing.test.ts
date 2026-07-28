import { describe, it, expect } from 'vitest'
import { computeShippingFee } from './pricing'
import { resolveZone } from './zones'

describe('resolveZone', () => {
  it('resolves known countries to their zone', () => {
    expect(resolveZone('FR')).toBe('FR')
    expect(resolveZone('de')).toBe('EU_PROCHE') // case-insensitive
    expect(resolveZone('CH')).toBe('EUROPE_LARGE')
  })

  it('falls back to INTERNATIONAL for unknown/empty countries', () => {
    expect(resolveZone('ZZ')).toBe('INTERNATIONAL')
    expect(resolveZone('')).toBe('INTERNATIONAL')
  })
})

describe('computeShippingFee', () => {
  it('picks the correct weight bracket for a France home delivery', () => {
    expect(computeShippingFee({ country: 'FR', weightKg: 0.3, deliveryMethod: 'home' })).toBe(5.9)
    expect(computeShippingFee({ country: 'FR', weightKg: 0.5, deliveryMethod: 'home' })).toBe(5.9)
    expect(computeShippingFee({ country: 'FR', weightKg: 0.6, deliveryMethod: 'home' })).toBe(6.9)
  })

  it('falls onto the open-ended bracket for very heavy parcels', () => {
    expect(computeShippingFee({ country: 'FR', weightKg: 50, deliveryMethod: 'home' })).toBe(13.9)
  })

  it('charges relay delivery less than home delivery for the same zone/weight', () => {
    const home = computeShippingFee({ country: 'FR', weightKg: 1, deliveryMethod: 'home' })
    const relay = computeShippingFee({ country: 'FR', weightKg: 1, deliveryMethod: 'relay' })
    expect(relay).toBeLessThan(home)
  })

  it('charges more for farther zones at the same weight/mode', () => {
    const fr = computeShippingFee({ country: 'FR', weightKg: 1, deliveryMethod: 'home' })
    const euProche = computeShippingFee({ country: 'DE', weightKg: 1, deliveryMethod: 'home' })
    const europeLarge = computeShippingFee({ country: 'CH', weightKg: 1, deliveryMethod: 'home' })
    expect(euProche).toBeGreaterThan(fr)
    expect(europeLarge).toBeGreaterThan(euProche)
  })
})
