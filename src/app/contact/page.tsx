'use client'

import { useState } from 'react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import Image from 'next/image'
import { useLanguage } from '@/contexts/LanguageContext'
import '../page.css'
import './contact.css'

export default function Contact() {
  const { t } = useLanguage()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [feedback, setFeedback] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus('loading')
    setFeedback('')

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, message }),
      })

      let data: { message?: string } = {}
      try { data = await res.json() } catch { /* réponse non-JSON */ }

      if (!res.ok) {
        setStatus('error')
        setFeedback(data.message || t.contact.error)
        return
      }

      setStatus('success')
      setFeedback(t.contact.success)
      setName('')
      setEmail('')
      setPhone('')
      setMessage('')
    } catch {
      setStatus('error')
      setFeedback(t.contact.networkError)
    }
  }

  return (
    <div className="container">

      <Navbar />

      <div className="contactZone">
        <div className="contactInner">

          {/* GAUCHE — Formulaire */}
          <form className="contactBloc" onSubmit={handleSubmit}>
            <h1 className="contactTitre">{t.contact.title}</h1>
            <div className="contactRow">
              <input
                className="contactInput"
                type="text"
                placeholder={t.contact.name}
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
              <input
                className="contactInput"
                type="email"
                placeholder={t.contact.email}
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <input
              className="contactInput"
              type="tel"
              placeholder={t.contact.phone}
              value={phone}
              onChange={e => setPhone(e.target.value)}
            />
            <textarea
              className="contactTextarea"
              placeholder={t.contact.message}
              value={message}
              onChange={e => setMessage(e.target.value)}
              required
            />
            {status === 'error' && (
              <p style={{ color: '#c0392b', fontSize: '13px', margin: 0 }}>{feedback}</p>
            )}
            {status === 'success' && (
              <p style={{ color: '#2e7d32', fontSize: '13px', margin: 0 }}>{feedback}</p>
            )}
            <button
              type="submit"
              className="contactBtn"
              disabled={status === 'loading'}
            >
              {status === 'loading' ? t.contact.sending : t.contact.send}
            </button>
          </form>

          {/* DROITE — Image */}
          <div className="contactImage">
            <Image
              src="https://res.cloudinary.com/dnm9txjhm/image/upload/q_auto/f_auto/v1780486949/wybov-portee-bob-noir-crochet-lookbook_ybglrr.jpg"
              alt="Contact WYBOB"
              fill
              priority
              sizes="(max-width: 767px) 100vw, 50vw"
              style={{ objectFit: 'cover' }}
            />
          </div>

        </div>
      </div>

      <Footer />

    </div>
  )
}
