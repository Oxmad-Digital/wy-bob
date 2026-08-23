'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import ChevronIcon from '@/components/icons/ChevronIcon'
import { useLanguage } from '@/contexts/LanguageContext'
import type { GalleryImage } from './page'
import '../page.css'
import './galerie.css'

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

interface Props {
  images: GalleryImage[]
}

export default function GalerieClient({ images }: Props) {
  const [currentPage,   setCurrentPage]   = useState(0)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const { t } = useLanguage()

  const pages        = chunk(images, 6)
  const currentImages = pages[currentPage] ?? []

  const closeLightbox  = useCallback(() => setLightboxIndex(null), [])
  const goPrevLightbox = useCallback(() => setLightboxIndex(i => i !== null ? (i - 1 + currentImages.length) % currentImages.length : null), [currentImages])
  const goNextLightbox = useCallback(() => setLightboxIndex(i => i !== null ? (i + 1) % currentImages.length : null), [currentImages])

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

  const goNext = () => setCurrentPage(p => (p + 1) % Math.max(pages.length, 1))
  const goPrev = () => setCurrentPage(p => (p - 1 + Math.max(pages.length, 1)) % Math.max(pages.length, 1))

  return (
    <div className="container">
      <Navbar />

      <div className="galerieZone">

        {/* Colonne gauche : titre */}
        <div className="galerieTitreCol">
          <div className="galerieTitreContent">
            <h1 className="galerieTitre">{t.galerie.title}</h1>
          </div>
          <div className="galeriePagination galerieDesktopPagination">
            <div className="galerieDots">
              {pages.map((_, i) => (
                <div
                  key={i}
                  className={`galerieDot ${currentPage === i ? 'active' : ''}`}
                  onClick={() => setCurrentPage(i)}
                />
              ))}
            </div>
            <div className="galerieNav">
              <button className="galerieNavBtn" onClick={goPrev} aria-label={t.galerie.prevPage}>
                <ChevronIcon direction="left" color="#1B1843" />
              </button>
              <button className="galerieNavBtn" onClick={goNext} aria-label={t.galerie.nextPage}>
                <ChevronIcon direction="right" color="#1B1843" />
              </button>
            </div>
          </div>
        </div>

        {/* Grille photos */}
        <div
          className="galerieGrid"
          style={{ gridTemplateRows: `repeat(${Math.ceil(currentImages.length / 3)}, 1fr)` }}
        >
          {currentImages.map((photo, i) => (
            <div key={i} className="galeriePhoto" style={{ position: 'relative' }} onClick={() => setLightboxIndex(i)}>
              <Image
                src={photo.url}
                alt={photo.alt || `Bob artisanal WYBOB en coton bio — vue ${currentPage * 6 + i + 1}`}
                fill
                priority={currentPage === 0 && i < 3}
                style={{ objectFit: 'cover', objectPosition: 'center center' }}
                sizes="(max-width: 767px) 50vw, (max-width: 1024px) 30vw, 25vw"
              />
            </div>
          ))}
        </div>

        {/* Pagination mobile */}
        <div className="galeriePagination galerieMobilePagination">
          <div className="galerieDots">
            {pages.map((_, i) => (
              <div
                key={i}
                className={`galerieDot ${currentPage === i ? 'active' : ''}`}
                onClick={() => setCurrentPage(i)}
              />
            ))}
          </div>
          <div className="galerieNav">
            <button className="galerieNavBtn" onClick={goPrev} aria-label={t.galerie.prevPage}>
              <ChevronIcon direction="left" color="#1B1843" />
            </button>
            <button className="galerieNavBtn" onClick={goNext} aria-label={t.galerie.nextPage}>
              <ChevronIcon direction="right" color="#1B1843" />
            </button>
          </div>
        </div>

      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <div className="lightboxOverlay" onClick={closeLightbox}>
          <button className="lightboxClose" onClick={closeLightbox} aria-label="Fermer la galerie">×</button>
          <button className="lightboxPrev" onClick={(e) => { e.stopPropagation(); goPrevLightbox() }} aria-label={t.galerie.prev}>
            <ChevronIcon direction="left" color="#ffffff" />
          </button>
          <div className="lightboxContent" onClick={(e) => e.stopPropagation()}>
            <Image
              src={currentImages[lightboxIndex].url}
              alt={currentImages[lightboxIndex].alt || `Bob artisanal WYBOB en coton bio — vue ${currentPage * 6 + lightboxIndex + 1}`}
              width={1200}
              height={800}
              style={{ objectFit: 'contain', width: 'auto', height: 'auto', maxWidth: '88vw', maxHeight: '82vh' }}
            />
          </div>
          <button className="lightboxNext" onClick={(e) => { e.stopPropagation(); goNextLightbox() }} aria-label={t.galerie.next}>
            <ChevronIcon direction="right" color="#ffffff" />
          </button>
        </div>
      )}

      <Footer />
    </div>
  )
}
