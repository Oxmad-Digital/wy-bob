import { Resend } from 'resend'

let resend

function getResendClient() {
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY)
  }
  return resend
}

function isResendQuotaError(error) {
  const status = error?.statusCode || error?.status
  const name = error?.name || ''
  return status === 429 || /quota|rate_limit/i.test(name)
}

async function sendViaPlunk({ to, subject, html, replyTo, attachments }) {
  const res = await fetch('https://api.useplunk.com/v1/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.PLUNK_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to,
      subject,
      body: html,
      from: process.env.EMAIL_FROM,
      name: process.env.EMAIL_FROM_NAME,
      ...(replyTo ? { reply: replyTo } : {}),
      ...(attachments && attachments.length
        ? {
            attachments: attachments.map((a) => ({
              filename: a.filename,
              content: Buffer.isBuffer(a.content) ? a.content.toString('base64') : a.content,
            })),
          }
        : {}),
    }),
  })

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const err = new Error(data?.message || `Erreur Plunk (${res.status})`)
    err.statusCode = res.status
    err.details = data
    throw err
  }
  return data
}

// Garde-fou pour les environnements de test (tous les envois passent par sendEmail,
// y compris le repli Plunk). Sans ces variables, le comportement est inchangé.
//   EMAIL_DISABLED=1          -> aucun envoi, une ligne de log à la place
//   EMAIL_REDIRECT_TO=a@b.fr  -> tous les emails partent vers cette adresse, le destinataire
//                                d'origine est indiqué en tête du sujet
const isTruthyEnv = (v) => /^(1|true|yes|on)$/i.test(String(v ?? '').trim())

function applyEmailGuard({ to, subject }) {
  const original = Array.isArray(to) ? to.join(', ') : String(to ?? '')
  if (isTruthyEnv(process.env.EMAIL_DISABLED)) {
    return { disabled: true, original }
  }
  const redirectTo = process.env.EMAIL_REDIRECT_TO?.trim()
  if (redirectTo) {
    return { to: redirectTo, subject: `[→ ${original}] ${subject}`, original }
  }
  return { to, subject, original }
}

export async function sendEmail({ to: requestedTo, subject: requestedSubject, html, replyTo, attachments }) {
  const guard = applyEmailGuard({ to: requestedTo, subject: requestedSubject })
  if (guard.disabled) {
    console.log(`✉️  Email NON envoyé (EMAIL_DISABLED) — à: ${guard.original} — sujet: ${requestedSubject}`)
    return { id: 'email-disabled' }
  }
  const { to, subject } = guard
  if (to !== requestedTo) console.log(`✉️  Email redirigé (EMAIL_REDIRECT_TO) — destinataire d'origine: ${guard.original}`)

  try {
    const { data, error } = await getResendClient().emails.send({
      from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM}>`,
      to,
      subject,
      html,
      ...(replyTo ? { replyTo } : {}),
      ...(attachments && attachments.length ? { attachments } : {}),
    })
    if (error) throw error
    console.log('✅ Email envoyé (Resend):', data.id)
    return data
  } catch (err) {
    if (!process.env.PLUNK_API_KEY || !isResendQuotaError(err)) {
      console.error('❌ Erreur email (Resend):', err)
      throw err
    }
    console.warn('⚠️ Quota Resend dépassé, bascule sur Plunk:', err?.name || err?.message)
    const data = await sendViaPlunk({ to, subject, html, replyTo, attachments })
    console.log('✅ Email envoyé (Plunk, fallback quota Resend)')
    return data
  }
}
