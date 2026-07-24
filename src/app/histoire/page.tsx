'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { useLanguage } from '@/contexts/LanguageContext'
import '../page.css'
import './histoire.css'

const CDN = 'https://res.cloudinary.com/dnm9txjhm/image/upload/q_auto/f_auto'

type SectionMeta = {
  layout: 'full' | 'split'
  imageSide?: 'left' | 'right'
  imageLabel: string
  image: string
}

// Photos temporaires piochées dans la gallerie, en attendant les vraies photos de la page Histoire
const SECTIONS_META: SectionMeta[] = [
  { layout: 'full', imageLabel: 'Le chapeau du festival', image: `${CDN}/v1780486486/wybob_portrait_femme_maillot_noir_chapeau_crochet_blanc_zygujw.jpg` },
  { layout: 'split', imageSide: 'right', imageLabel: 'Pénélope Wybo', image: `${CDN}/v1780486485/wybob_portrait_femme_souriante_maillot_noir_main_chapeau_eodlwd.jpg` },
  { layout: 'split', imageSide: 'left', imageLabel: 'Crochet & tricot', image: `${CDN}/v1780486485/wybob_trois_femmes_allongees_pont_chapeaux_crochet_rerozt.jpg` },
  { layout: 'split', imageSide: 'right', imageLabel: 'Artisans à Madagascar', image: `${CDN}/v1780486484/wybob_deux_femmes_face_sous_hangar_bois_turquoise_exmm9y.jpg` },
  { layout: 'split', imageSide: 'left', imageLabel: 'Festival & voyage', image: `${CDN}/v1780486484/wybob_deux_femmes_maillots_bikinis_chapeaux_rouges_noirs_kpt1lu.jpg` },
  { layout: 'full', imageLabel: 'La famille WYBOB', image: `${CDN}/v1780486485/wybob_portrait_serre_deux_femmes_chapeaux_bikinis_iwlc3v.jpg` },
  { layout: 'split', imageSide: 'right', imageLabel: 'La collection couleurs', image: `${CDN}/v1780486485/wybob_portrait_deux_femmes_de_bout_sous_hangar_by5fse.jpg` },
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
              className={`histoireSection histoireSection--${meta.layout}`}
            >
              {meta.layout === 'full' && (
                <div className="histoirePlaceholder histoirePlaceholder--full">
                  <Image src={meta.image} alt={meta.imageLabel} fill priority={i === 0} style={{ objectFit: 'cover' }} sizes="100vw" />
                </div>
              )}
              {meta.layout === 'full' && <div className="histoireOverlay" />}

              <div className="histoireContent">
                {meta.layout === 'split' && meta.imageSide === 'left' && (
                  <div className="histoirePlaceholder histoirePlaceholder--split">
                    <Image src={meta.image} alt={meta.imageLabel} fill style={{ objectFit: 'cover' }} sizes="(max-width: 1024px) 100vw, 50vw" />
                  </div>
                )}

                <div className="histoireText">
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

                {meta.layout === 'split' && meta.imageSide === 'right' && (
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
