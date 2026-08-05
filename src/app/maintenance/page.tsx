export const metadata = {
  title: 'Maintenance en cours — WYBOB',
  description: "Le site est actuellement en maintenance. Nous serons de retour très bientôt.",
  robots: {
    index: false,
    follow: false,
  },
}

export default function Maintenance() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '48px 20px' }}>
      <div style={{
        backdropFilter: 'blur(16px)',
        background: 'rgba(255,255,255,0.2)',
        border: '1px solid rgba(255,255,255,0.4)',
        borderRadius: '20px',
        padding: '48px',
        textAlign: 'center',
        maxWidth: '440px',
        width: '90%',
      }}>
        <p style={{ fontSize: '40px', margin: 0 }}>🛠️</p>
        <h1 style={{ color: '#1B1843', fontFamily: 'Quicksand', fontWeight: 700, fontSize: '24px', margin: '12px 0' }}>
          Maintenance du site en cours
        </h1>
        <p style={{ color: '#444', fontFamily: 'DM Sans', marginBottom: 0 }}>
          Nous améliorons WYBOB pour vous. Le site sera de retour très bientôt, merci de votre patience !
        </p>
      </div>
    </div>
  )
}
