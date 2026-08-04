'use client'

import Link from 'next/link'
import Image from 'next/image'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { useLanguage } from '@/contexts/LanguageContext'
import '../page.css'
import styles from './concept.module.css'

const CONCEPT_IMAGE = 'https://res.cloudinary.com/dnm9txjhm/image/upload/v1780598136/galerie/poue9ehom5m91pdrgdik.jpg'

export default function Concept() {
  const { t } = useLanguage()
  const concept = t.concept

  return (
    <div className="container">
      <Navbar />

      <div className={`${styles.conceptZone} conceptZone`}>
        <div className={styles.imageCol}>
          <Image src={CONCEPT_IMAGE} alt={concept.title} fill priority style={{ objectFit: 'cover' }} sizes="(max-width: 1024px) 100vw, 50vw" />
        </div>

        <div className={styles.textCol}>
          <h1 className={styles.title}>{concept.title}</h1>

          <div className={styles.paragraphs}>
            {concept.paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>

          {concept.sections?.map((section, i) => (
            <div key={i} className={styles.extraSection}>
              {section.title && <h2 className={styles.sectionTitle}>{section.title}</h2>}
              <div className={styles.paragraphs}>
                {section.paragraphs.map((p, pi) => (
                  <p key={pi}>{p}</p>
                ))}
                {section.closing && <p className={styles.closing}>{section.closing}</p>}
              </div>
            </div>
          ))}

          {concept.cta && (
            <Link href="/galerie" className={styles.cta}>
              {concept.cta}
            </Link>
          )}
        </div>
      </div>

      <Footer />
    </div>
  )
}
