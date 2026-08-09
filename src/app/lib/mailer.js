import { Resend } from 'resend'

let resend

function getResendClient() {
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY)
  }
  return resend
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
    console.log('✅ Email envoyé:', data.id)
    return data
  } catch (err) {
    console.error('❌ Erreur email:', err)
    throw err
  }
}
