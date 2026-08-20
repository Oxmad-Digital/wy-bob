'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import ChevronIcon from '@/components/icons/ChevronIcon'
import { useCart } from '@/components/panier-context'
import { useLanguage } from '@/contexts/LanguageContext'
import './page.css'

interface Variant {
  _id: string
  colorName: string
  colorCode: string
  textColor: string
  description?: string
  image: string
  stock?: number
}

const EDITION_SIZE = 50

interface ProductData {
  _id: string
  name: string
  price: number
  pricePromo: number | null
  stock: number
  visible: boolean
  variants: Variant[]
}

const FALLBACK_VARIANTS: Variant[] = [
  { _id: '4', colorName: 'Rouge', colorCode: '#c0392b', textColor: '#ffffff', image: '/images/wybob_rouge.webp' },
  { _id: '1', colorName: 'Bleu',  colorCode: '#1B2D5E', textColor: '#ffffff', image: '/images/wybob_bleu.webp'  },
  { _id: '2', colorName: 'Blanc', colorCode: '#f5f5f0', textColor: '#1B1843', image: '/images/wybob_blanc.webp' },
  { _id: '3', colorName: 'Jaune', colorCode: '#e6a817', textColor: '#1B1843', image: '/images/wybob_jaune.webp' },
]

type ColorKey = 'Red' | 'Blue' | 'White' | 'Yellow'
const FR_TO_COLOR_KEY: Record<string, ColorKey> = {
  Rouge: 'Red',
  Bleu:  'Blue',
  Blanc: 'White',
  Jaune: 'Yellow',
  Red:   'Red',
  Blue:  'Blue',
  White: 'White',
  Yellow:'Yellow',
}

interface Props {
  product: ProductData | null
}

export default function HomeClient({ product }: Props) {
  const variants      = product?.variants?.length ? product.variants : FALLBACK_VARIANTS
  const productName   = product?.name  ?? 'WYBOB Essentials'
  const productPrice  = product?.pricePromo ?? product?.price ?? 85

  const [selectedVariant, setSelectedVariant] = useState<Variant>(variants[0])
  const [openSection,     setOpenSection]     = useState<string | null>(null)
  const [quantity,        setQuantity]        = useState(1)
  const [isFading,        setIsFading]        = useState(false)
  const [lightboxIndex,   setLightboxIndex]   = useState<number | null>(null)

  const { addToCart } = useCart()
  const { t }        = useLanguage()
  const router       = useRouter()
  const scrollRef    = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (!el || window.innerWidth <= 1024) return
    el.style.maxHeight = el.getBoundingClientRect().height + 'px'
  }, [])

  const toggleSection = (section: string) => {
    setOpenSection(prev => prev === section ? null : section)
  }

  const closeLightbox  = useCallback(() => setLightboxIndex(null), [])
  const goPrevLightbox = useCallback(() => setLightboxIndex(i => i !== null ? (i - 1 + variants.length) % variants.length : null), [variants])
  const goNextLightbox = useCallback(() => setLightboxIndex(i => i !== null ? (i + 1) % variants.length : null), [variants])

  useEffect(() => {
    if (lightboxIndex === null) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape')        closeLightbox()
      else if (e.key === 'ArrowLeft')  goPrevLightbox()
      else if (e.key === 'ArrowRight') goNextLightbox()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [lightboxIndex, closeLightbox, goPrevLightbox, goNextLightbox])

  const handleVariantChange = (variant: Variant) => {
    setIsFading(true)
    setTimeout(() => {
      setSelectedVariant(variant)
      setIsFading(false)
    }, 150)
  }

  const colorStory  = t.home.colorStories[selectedVariant.colorName as keyof typeof t.home.colorStories]
  const stockLeft   = Math.max(0, Math.min(EDITION_SIZE, selectedVariant.stock ?? EDITION_SIZE))
  const stockLevel  = stockLeft <= 5 ? 'critical' : stockLeft <= 15 ? 'low' : 'normal'

  const handleCommander = () => {
    if (!product?._id) return
    addToCart({
      _id:       'wybob-' + selectedVariant._id,
      productId: product._id,
      name:      productName,
      price:     productPrice,
      image:     selectedVariant.image,
      color:     selectedVariant.colorName,
    }, quantity)
    router.push('/panier')
  }

  return (
    <div className="container">
      <Navbar />

      <div className="mainZone">

        {/* GAUCHE — image */}
        <div className="imageCol">
          <Image
            src={selectedVariant.image}
            alt="Chapeau WYBOB"
            width={500}
            height={500}
            priority
            sizes="(max-width: 767px) 100vw, 50vw"
            className={`hatImage${isFading ? ' fading' : ''}`}
            onClick={() => setLightboxIndex(variants.findIndex(v => v._id === selectedVariant._id))}
            style={{ cursor: 'zoom-in' }}
          />
        </div>

        {/* DROITE — fiche produit */}
        <div className="contentCol">
        <div className="contentScrollInner" ref={scrollRef}>

          <h2 className="productName">{productName}</h2>

          <p className="productTagline">{t.home.tagline}</p>

          <div className="priceRow">
            {product?.pricePromo ? (
              <>
                <p className="priceTag">{product.pricePromo}€</p>
                <p className="priceOriginal">{product.price}€</p>
              </>
            ) : (
              <p className="priceTag">{product?.price ?? 85}€</p>
            )}
          </div>

          <div className="stockBadgeRow">
            <div className={`stockGauge ${stockLevel}`}>
              <span className="stockGaugeTrack">
                <span className="stockGaugeFill" style={{ width: `${(stockLeft / EDITION_SIZE) * 100}%` }} />
              </span>
              <span className="stockGaugeLabel">
                <b>{stockLeft}</b> / {EDITION_SIZE} {t.home.stockLabel}
              </span>
            </div>
          </div>

          <div className="productFeature" onClick={() => toggleSection('description')}>
            <span>{t.home.sectionDescription}</span>
            <span className={`featureToggle ${openSection === 'description' ? 'open' : ''}`}>+</span>
          </div>
          {openSection === 'description' && (
            <p className="productDesc">{t.home.description}</p>
          )}

          <hr className="productDivider" />

          <div className="productFeature" onClick={() => toggleSection('color')}>
            <span>{t.home.colorLabel} <span className="colorNameInline">{t.home.colors[FR_TO_COLOR_KEY[selectedVariant.colorName]] ?? selectedVariant.colorName}</span></span>
            <span className={`featureToggle ${openSection === 'color' ? 'open' : ''}`}>+</span>
          </div>
          {openSection === 'color' && (
            <>
              <div className="swatches">
                {variants.map((v) => (
                  <button
                    key={v._id}
                    className={`swatchDot ${selectedVariant._id === v._id ? 'active' : ''}`}
                    onClick={(e) => { e.stopPropagation(); handleVariantChange(v) }}
                    aria-label={v.colorName}
                    style={{
                      backgroundColor: v.colorCode,
                      boxShadow: selectedVariant._id === v._id
                        ? `0 0 0 1.5px rgba(255,255,255,0.9), 0 0 0 3.5px ${v.colorCode}`
                        : '0 2px 6px rgba(0,0,0,0.18)'
                    }}
                  />
                ))}
              </div>
              {colorStory ? (
                <p className="colorStory">
                  {colorStory.name && <span className="colorStoryName">{colorStory.name} — </span>}
                  {colorStory.text}
                </p>
              ) : selectedVariant.description && (
                <p className="colorStory">{selectedVariant.description}</p>
              )}
            </>
          )}

          <hr className="productDivider" />

          <div className="productFeature" onClick={() => toggleSection('features')}>
            <span>{t.home.sectionFeatures}</span>
            <span className={`featureToggle ${openSection === 'features' ? 'open' : ''}`}>+</span>
          </div>
          {openSection === 'features' && (
            <ul className="featureList">
              {t.home.features.map((f, i) => <li key={i}>{f}</li>)}
            </ul>
          )}

          <hr className="productDivider" />

          <div className="productFeature" onClick={() => toggleSection('care')}>
            <span>{t.home.sectionCare}</span>
            <span className={`featureToggle ${openSection === 'care' ? 'open' : ''}`}>+</span>
          </div>
          {openSection === 'care' && (
            <ul className="featureList">
              {t.home.care.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          )}

          <div className="ctaRow">
            <div className="quantitySelector">
              <button className="qtyBtn" onClick={() => setQuantity(q => Math.max(1, q - 1))} aria-label="Diminuer la quantité">−</button>
              <span className="qtyValue">{quantity}</span>
              <button className="qtyBtn" onClick={() => setQuantity(q => q + 1)} aria-label="Augmenter la quantité">+</button>
            </div>
            <button
              className="commanderBtn"
              onClick={handleCommander}
              style={{ backgroundColor: selectedVariant.colorCode, color: selectedVariant.textColor }}
            >{t.home.order}</button>
          </div>

        </div>
        </div>

      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <div className="lightboxOverlay" onClick={closeLightbox}>
          <button className="lightboxClose" onClick={closeLightbox} aria-label="Fermer">×</button>
          <button className="lightboxPrev" onClick={(e) => { e.stopPropagation(); goPrevLightbox() }} aria-label="Précédent">
            <ChevronIcon direction="left" color="#ffffff" />
          </button>
          <div className="lightboxContent" onClick={(e) => e.stopPropagation()}>
            <Image
              src={variants[lightboxIndex].image}
              alt={`Chapeau WYBOB — ${variants[lightboxIndex].colorName}`}
              width={1200}
              height={1200}
              sizes="88vw"
              style={{ objectFit: 'contain', width: 'auto', height: 'auto', maxWidth: '88vw', maxHeight: '82vh' }}
            />
          </div>
          <button className="lightboxNext" onClick={(e) => { e.stopPropagation(); goNextLightbox() }} aria-label="Suivant">
            <ChevronIcon direction="right" color="#ffffff" />
          </button>
        </div>
      )}

      <Footer />
    </div>
  )
}
