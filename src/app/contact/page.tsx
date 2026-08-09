'use client'

import { useState } from 'react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import Image from 'next/image'
import { useLanguage } from '@/contexts/LanguageContext'
import '../page.css'
import './contact.css'

const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024 // 5 Mo
const ALLOWED_ATTACHMENT_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type FieldErrors = {
  name?: string
  email?: string
  message?: string
  file?: string
}

export default function Contact() {
  const { t } = useLanguage()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [subject, setSubject] = useState<string>(t.contact.subjectOptions[0]?.value ?? '')
  const [orderNumber, setOrderNumber] = useState('')
  const [message, setMessage] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [honeypot, setHoneypot] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [feedback, setFeedback] = useState('')

  const isLoading = status === 'loading'

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null
    if (!selected) {
      setFile(null)
      setErrors(prev => ({ ...prev, file: undefined }))
      return
    }
    if (!ALLOWED_ATTACHMENT_TYPES.includes(selected.type)) {
      setErrors(prev => ({ ...prev, file: t.contact.fileInvalidType }))
      setFile(null)
      e.target.value = ''
      return
    }
    if (selected.size > MAX_ATTACHMENT_SIZE) {
      setErrors(prev => ({ ...prev, file: t.contact.fileTooLarge }))
      setFile(null)
      e.target.value = ''
      return
    }
    setErrors(prev => ({ ...prev, file: undefined }))
    setFile(selected)
  }

  function validateEmail() {
    setErrors(prev => ({
      ...prev,
      email: email.trim() && !EMAIL_REGEX.test(email.trim()) ? t.contact.emailInvalid : undefined,
    }))
  }

  function validate(): boolean {
    const next: FieldErrors = {}
    if (!name.trim()) next.name = t.contact.nameRequired
    if (!EMAIL_REGEX.test(email.trim())) next.email = t.contact.emailInvalid
    if (!message.trim()) next.message = t.contact.messageRequired
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!validate()) return

    setStatus('loading')
    setFeedback('')

    try {
      const formData = new FormData()
      formData.append('name', name)
      formData.append('email', email)
      formData.append('phone', phone)
      formData.append('subject', subject)
      formData.append('orderNumber', orderNumber)
      formData.append('message', message)
      formData.append('hp_website', honeypot)
      if (file) formData.append('attachment', file)

      const res = await fetch('/api/contact', {
        method: 'POST',
        body: formData,
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
      setSubject(t.contact.subjectOptions[0]?.value ?? '')
      setOrderNumber('')
      setMessage('')
      setFile(null)
      setErrors({})
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
          <form className="contactBloc" onSubmit={handleSubmit} noValidate>
            <h1 className="contactTitre">{t.contact.title}</h1>

            {/* Champ piège anti-bot : invisible et ignoré par les utilisateurs humains */}
            <input
              type="text"
              name="hp_website"
              value={honeypot}
              onChange={e => setHoneypot(e.target.value)}
              className="hpField"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
            />

            <div className="contactRow">
              <div className="contactField">
                <label htmlFor="contact-name" className="srOnly">{t.contact.name}</label>
                <input
                  id="contact-name"
                  className="contactInput"
                  type="text"
                  placeholder={t.contact.name}
                  value={name}
                  onChange={e => {
                    setName(e.target.value)
                    if (errors.name) setErrors(prev => ({ ...prev, name: undefined }))
                  }}
                  disabled={isLoading}
                  aria-invalid={Boolean(errors.name)}
                  aria-describedby={errors.name ? 'contact-name-error' : undefined}
                  required
                />
                {errors.name && <p id="contact-name-error" className="contactFieldError">{errors.name}</p>}
              </div>
              <div className="contactField">
                <label htmlFor="contact-email" className="srOnly">{t.contact.email}</label>
                <input
                  id="contact-email"
                  className="contactInput"
                  type="email"
                  placeholder={t.contact.email}
                  value={email}
                  onChange={e => {
                    setEmail(e.target.value)
                    if (errors.email) setErrors(prev => ({ ...prev, email: undefined }))
                  }}
                  onBlur={validateEmail}
                  disabled={isLoading}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? 'contact-email-error' : undefined}
                  required
                />
                {errors.email && <p id="contact-email-error" className="contactFieldError">{errors.email}</p>}
              </div>
            </div>

            <div className="contactRow">
              <div className="contactField">
                <label htmlFor="contact-phone" className="srOnly">{t.contact.phone}</label>
                <input
                  id="contact-phone"
                  className="contactInput"
                  type="tel"
                  placeholder={t.contact.phone}
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div className="contactField">
                <label htmlFor="contact-subject" className="srOnly">{t.contact.subject}</label>
                <select
                  id="contact-subject"
                  className="contactInput contactSelect"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  disabled={isLoading}
                >
                  {t.contact.subjectOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="contactField">
              <label htmlFor="contact-order" className="srOnly">{t.contact.orderNumber}</label>
              <input
                id="contact-order"
                className="contactInput"
                type="text"
                placeholder={t.contact.orderNumber}
                value={orderNumber}
                onChange={e => setOrderNumber(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="contactField contactFieldGrow">
              <label htmlFor="contact-message" className="srOnly">{t.contact.message}</label>
              <textarea
                id="contact-message"
                className="contactTextarea"
                placeholder={t.contact.message}
                value={message}
                onChange={e => {
                  setMessage(e.target.value)
                  if (errors.message) setErrors(prev => ({ ...prev, message: undefined }))
                }}
                disabled={isLoading}
                maxLength={2000}
                aria-invalid={Boolean(errors.message)}
                aria-describedby={errors.message ? 'contact-message-error' : undefined}
                required
              />
              {errors.message && <p id="contact-message-error" className="contactFieldError">{errors.message}</p>}
            </div>

            <div className="contactField">
              <label htmlFor="contact-file" className="contactFileLabel">
                {t.contact.attachment}
                <span className="contactFileHint">{t.contact.attachmentHint}</span>
              </label>
              <input
                id="contact-file"
                className="contactFileInput"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                disabled={isLoading}
                aria-invalid={Boolean(errors.file)}
                aria-describedby={errors.file ? 'contact-file-error' : undefined}
              />
              {file && (
                <p className="contactFileName">
                  {file.name}
                  <button
                    type="button"
                    className="contactFileRemove"
                    onClick={() => {
                      setFile(null)
                      const input = document.getElementById('contact-file') as HTMLInputElement | null
                      if (input) input.value = ''
                    }}
                    disabled={isLoading}
                  >
                    {t.contact.attachmentRemove}
                  </button>
                </p>
              )}
              {errors.file && <p id="contact-file-error" className="contactFieldError">{errors.file}</p>}
            </div>

            <p aria-live="polite" style={{ margin: 0 }}>
              {status === 'error' && (
                <span style={{ color: '#c0392b', fontSize: '13px' }}>{feedback}</span>
              )}
              {status === 'success' && (
                <span style={{ color: '#2e7d32', fontSize: '13px' }}>{feedback}</span>
              )}
            </p>

            <button
              type="submit"
              className="contactBtn"
              disabled={isLoading}
            >
              {isLoading ? t.contact.sending : t.contact.send}
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
