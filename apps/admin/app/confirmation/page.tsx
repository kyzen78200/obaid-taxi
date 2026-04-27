export default function ConfirmationPage() {
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#F9FAFB',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Arial, sans-serif',
      padding: '24px',
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        padding: '48px 40px',
        maxWidth: '440px',
        width: '100%',
        textAlign: 'center',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
      }}>
        {/* Checkmark */}
        <div style={{
          width: '72px',
          height: '72px',
          backgroundColor: '#EFF6FF',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px',
          fontSize: '36px',
        }}>
          ✅
        </div>

        {/* Logo / nom */}
        <h1 style={{
          fontSize: '24px',
          fontWeight: '700',
          color: '#1D4ED8',
          margin: '0 0 8px',
        }}>
          O Taxi
        </h1>

        <h2 style={{
          fontSize: '18px',
          fontWeight: '600',
          color: '#111827',
          margin: '0 0 12px',
        }}>
          Email confirmé !
        </h2>

        <p style={{
          fontSize: '15px',
          color: '#6B7280',
          lineHeight: '1.6',
          margin: '0 0 32px',
        }}>
          Votre adresse email a bien été vérifiée. Vous pouvez maintenant retourner sur l&apos;application O Taxi et vous connecter.
        </p>

        {/* Bouton deep link app */}
        <a
          href="otaxi://"
          style={{
            display: 'inline-block',
            backgroundColor: '#1D4ED8',
            color: '#ffffff',
            padding: '14px 32px',
            borderRadius: '12px',
            textDecoration: 'none',
            fontWeight: '600',
            fontSize: '15px',
            marginBottom: '12px',
          }}
        >
          Ouvrir l&apos;application
        </a>

        <p style={{
          fontSize: '13px',
          color: '#9CA3AF',
          margin: '12px 0 0',
        }}>
          Si le bouton ne fonctionne pas, ouvrez manuellement l&apos;app O Taxi sur votre téléphone.
        </p>
      </div>
    </div>
  )
}
