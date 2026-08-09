'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { useLanguage } from '@/contexts/LanguageContext'
import { cloudinaryThumb } from '@/app/lib/cloudinary'
import '../page.css'
import './histoire.css'

type SectionMeta = {
  layout: 'full' | 'split'
  imageSide?: 'left' | 'right'
  imageLabel: string
  image?: string
}

// Photos temporaires piochées dans la gallerie (mêmes URLs que /api/gallery), en attendant les vraies photos de la page Histoire
const SECTIONS_META: SectionMeta[] = [
  { layout: 'full', imageLabel: 'Le chapeau du festival' },
  { layout: 'split', imageSide: 'right', imageLabel: 'Pénélope Wybo', image: cloudinaryThumb('https://res.cloudinary.com/dnm9txjhm/image/upload/v1780598130/galerie/ntcjfrv2xyli9ilkdozp.jpg', 1920) },
  { layout: 'split', imageSide: 'left', imageLabel: 'Savoir-faire & artisanat malgache', image: cloudinaryThumb('https://res.cloudinary.com/dnm9txjhm/image/upload/v1780598144/galerie/hmxampzuyhi9roiqfftz.jpg', 1920) },
]

export default function Histoire() {
  const { t } = useLanguage()
  const scrollRef = useRef<HTMLDivElement>(null)
  const sectionRefs = useRef<(HTMLElement | null)[]>([])
  const activeIndexRef = useRef(0)
  const [activeIndex, setActiveIndex] = useState(0)

  const sections = t.histoire.sections

  useEffect(() => {
    const root = scrollRef.current
    if (!root) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const index = Number((entry.target as HTMLElement).dataset.index)
          if (entry.isIntersecting) {
            entry.target.classList.add('inView')
            activeIndexRef.current = index
            setActiveIndex(index)
          }
        })
      },
      { root, threshold: 0.5 }
    )

    sectionRefs.current.forEach((el) => el && observer.observe(el))
    return () => observer.disconnect()
  }, [sections.length])

  useEffect(() => {
    const root = scrollRef.current
    if (!root) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'PageDown' && e.key !== 'PageUp') return
      e.preventDefault()
      const goingDown = e.key === 'ArrowDown' || e.key === 'PageDown'
      const next = Math.min(Math.max(activeIndexRef.current + (goingDown ? 1 : -1), 0), sections.length - 1)
      goTo(next)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [sections.length])

  const goTo = (index: number) => {
    sectionRefs.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="container">
      <Navbar />

      <div className="histoireScroll" ref={scrollRef}>
        {sections.map((section, i) => {
          const meta = SECTIONS_META[i]
          const paragraphsAfterQuote = (section as { paragraphsAfterQuote?: string[] }).paragraphsAfterQuote ?? []

          return (
            <section
              key={i}
              data-index={i}
              ref={(el) => { sectionRefs.current[i] = el }}
              className={`histoireSection histoireSection--${meta.layout}${meta.layout === 'full' && !meta.image ? ' histoireSection--plain' : ''}`}
            >
              {meta.layout === 'full' && meta.image && (
                <div className="histoirePlaceholder histoirePlaceholder--full">
                  <Image src={meta.image} alt={meta.imageLabel} fill priority={i === 0} style={{ objectFit: 'cover' }} sizes="100vw" />
                </div>
              )}
              {meta.layout === 'full' && meta.image && <div className="histoireOverlay" />}

              {i === 0 && (
                <button
                  className="histoireScrollHint"
                  onClick={() => goTo(1)}
                  aria-label="Faire défiler vers le bas"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              )}

              <div className="histoireContent">
                {meta.layout === 'split' && meta.imageSide === 'left' && meta.image && (
                  <div className="histoirePlaceholder histoirePlaceholder--split">
                    <Image src={meta.image} alt={meta.imageLabel} fill style={{ objectFit: 'cover' }} sizes="(max-width: 1024px) 100vw, 50vw" />
                  </div>
                )}

                <div className="histoireText">
                  {i === 0 && (
                    <svg
                      className="histoireSunIcon reveal"
                      style={{ transitionDelay: '0s' }}
                      xmlns="http://www.w3.org/2000/svg"
                      width="80"
                      height="80"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="12" r="4" />
                      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                    </svg>
                  )}
                  {section.kicker && <p className="histoireKicker reveal" style={{ transitionDelay: '0s' }}>{section.kicker}</p>}
                  {section.title && <h2 className="histoireTitre reveal" style={{ transitionDelay: '0.08s' }}>{section.title}</h2>}

                  <div className="histoireTexte">
                    {section.paragraphs.map((p, pi) => (
                      <p key={pi} className="reveal" style={{ transitionDelay: `${0.16 + pi * 0.08}s` }}>{p}</p>
                    ))}
                    {section.quote && (
                      <blockquote className="histoireQuote reveal" style={{ transitionDelay: `${0.16 + section.paragraphs.length * 0.08}s` }}>
                        {section.quote}
                      </blockquote>
                    )}
                    {paragraphsAfterQuote.map((p, pi) => (
                      <p key={`aq-${pi}`} className="reveal" style={{ transitionDelay: `${0.24 + (section.paragraphs.length + pi) * 0.08}s` }}>{p}</p>
                    ))}
                    {section.closing && <p className="histoireClosing reveal" style={{ transitionDelay: '0.4s' }}>{section.closing}</p>}
                  </div>

                  {section.cta && (
                    <Link href="/galerie" className="histoireCta reveal" style={{ transitionDelay: '0.5s' }}>
                      {section.cta}
                    </Link>
                  )}
                </div>

                {meta.layout === 'split' && meta.imageSide === 'right' && meta.image && (
                  <div className="histoirePlaceholder histoirePlaceholder--split">
                    <Image src={meta.image} alt={meta.imageLabel} fill style={{ objectFit: 'cover' }} sizes="(max-width: 1024px) 100vw, 50vw" />
                  </div>
                )}
              </div>
            </section>
          )
        })}
      </div>

      <div className="histoireDots">
        {sections.map((_, i) => (
          <button
            key={i}
            aria-label={`Section ${i + 1}`}
            className={`histoireDot ${activeIndex === i ? 'active' : ''}`}
            onClick={() => goTo(i)}
          />
        ))}
      </div>

      <Footer />
    </div>
  )
}
