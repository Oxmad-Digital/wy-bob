import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendEmail({ to, subject, html }) {
  try {
    const { data, error } = await resend.emails.send({
      from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM}>`,
      to,
      subject,
      html,
    })
    if (error) throw error
    console.log('✅ Email envoyé:', data.id)
    return data
  } catch (err) {
    console.error('❌ Erreur email:', err)
    throw err
  }
}
