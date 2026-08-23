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

export async function sendEmail({ to, subject, html, replyTo, attachments }) {
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
