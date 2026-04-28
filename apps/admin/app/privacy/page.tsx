import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Politique de confidentialité — O Taxi',
  description: 'Politique de confidentialité de l\'application O Taxi',
}

export default function PrivacyPage() {
  const lastUpdated = '17 avril 2026'

  return (
    <main style={{
      maxWidth: 760,
      margin: '0 auto',
      padding: '48px 24px 80px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      color: '#111827',
      lineHeight: 1.7,
    }}>
      {/* Header */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ fontSize: 28, fontWeight: 700, color: '#1D4ED8', marginBottom: 4 }}>
          O Taxi
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 8px' }}>
          Politique de confidentialité
        </h1>
        <p style={{ color: '#6B7280', margin: 0, fontSize: 14 }}>
          Dernière mise à jour : {lastUpdated}
        </p>
      </div>

      <Section title="1. Qui sommes-nous ?">
        <p>
          O Taxi est un service de transport avec chauffeur (VTC) basé à Mantes-la-Jolie (78).
          L'application mobile O Taxi vous permet de réserver des courses, de suivre leur statut
          et de gérer votre historique de transport.
        </p>
        <p>
          Responsable du traitement : Obaid (kyzen78200@gmail.com)
        </p>
      </Section>

      <Section title="2. Données collectées">
        <p>Lors de l'utilisation de l'application, nous collectons les données suivantes :</p>
        <ul>
          <li><strong>Données d'identité :</strong> nom complet, numéro de téléphone, adresse email</li>
          <li><strong>Données de localisation :</strong> adresse de départ et d'arrivée saisies lors d'une réservation</li>
          <li><strong>Données de réservation :</strong> date, heure, type de course, tarif estimé, statut</li>
          <li><strong>Token de notification push :</strong> identifiant technique pour l'envoi de notifications sur votre appareil</li>
          <li><strong>Points de fidélité :</strong> historique des points crédités après chaque course</li>
        </ul>
        <p>
          <strong>Mode invité :</strong> si vous réservez sans créer de compte, vos nom, téléphone et email
          sont collectés uniquement pour traiter votre réservation. Votre historique est stocké
          localement sur votre appareil.
        </p>
      </Section>

      <Section title="3. Finalités du traitement">
        <p>Vos données sont utilisées pour :</p>
        <ul>
          <li>Traiter et gérer vos réservations de course</li>
          <li>Vous envoyer des confirmations et mises à jour par email et notification push</li>
          <li>Calculer et afficher votre solde de points fidélité</li>
          <li>Vous contacter en cas de besoin lié à votre course</li>
          <li>Améliorer la qualité du service</li>
        </ul>
        <p>
          Nous ne faisons <strong>aucune prospection commerciale</strong> et ne vendons
          vos données à aucun tiers.
        </p>
      </Section>

      <Section title="4. Base légale">
        <p>
          Le traitement de vos données repose sur l'<strong>exécution du contrat</strong> de transport
          que vous concluez lors de chaque réservation (Article 6.1.b du RGPD), ainsi que sur votre
          <strong> consentement</strong> pour les notifications push (révocable à tout moment dans
          les paramètres de votre appareil).
        </p>
      </Section>

      <Section title="5. Sous-traitants et tiers">
        <p>Nous utilisons les services suivants pour faire fonctionner l'application :</p>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ backgroundColor: '#F3F4F6' }}>
              <th style={thStyle}>Service</th>
              <th style={thStyle}>Fournisseur</th>
              <th style={thStyle}>Usage</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdStyle}>Base de données & authentification</td>
              <td style={tdStyle}>Supabase (USA)</td>
              <td style={tdStyle}>Stockage sécurisé des données</td>
            </tr>
            <tr style={{ backgroundColor: '#F9FAFB' }}>
              <td style={tdStyle}>Cartographie</td>
              <td style={tdStyle}>Google Maps (USA)</td>
              <td style={tdStyle}>Affichage de carte, calcul d'itinéraire</td>
            </tr>
            <tr>
              <td style={tdStyle}>Notifications push</td>
              <td style={tdStyle}>Expo / FCM (USA)</td>
              <td style={tdStyle}>Envoi de notifications sur votre appareil</td>
            </tr>
            <tr style={{ backgroundColor: '#F9FAFB' }}>
              <td style={tdStyle}>Emails transactionnels</td>
              <td style={tdStyle}>Resend (USA)</td>
              <td style={tdStyle}>Confirmations de réservation par email</td>
            </tr>
          </tbody>
        </table>
        <p style={{ fontSize: 13, color: '#6B7280', marginTop: 8 }}>
          Ces prestataires sont soumis à des clauses contractuelles types conformes au RGPD.
        </p>
      </Section>

      <Section title="6. Durée de conservation">
        <ul>
          <li><strong>Compte utilisateur :</strong> conservé tant que votre compte est actif</li>
          <li><strong>Réservations :</strong> 3 ans à compter de la date de la course</li>
          <li><strong>Tokens de notification :</strong> supprimés lors de la désinscription ou désinstallation</li>
          <li><strong>Mode invité :</strong> données stockées localement, supprimées à la désinstallation de l'app</li>
        </ul>
      </Section>

      <Section title="7. Vos droits (RGPD)">
        <p>Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez des droits suivants :</p>
        <ul>
          <li><strong>Droit d'accès</strong> à vos données personnelles</li>
          <li><strong>Droit de rectification</strong> des données inexactes</li>
          <li><strong>Droit à l'effacement</strong> (« droit à l'oubli »)</li>
          <li><strong>Droit à la portabilité</strong> de vos données</li>
          <li><strong>Droit d'opposition</strong> au traitement</li>
          <li><strong>Droit de retrait du consentement</strong> pour les notifications push</li>
        </ul>
        <p>
          Pour exercer ces droits, contactez-nous à :{' '}
          <a href="mailto:kyzen78200@gmail.com" style={{ color: '#1D4ED8' }}>
            kyzen78200@gmail.com
          </a>
        </p>
        <p>
          Vous pouvez également introduire une réclamation auprès de la{' '}
          <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" style={{ color: '#1D4ED8' }}>
            CNIL
          </a>.
        </p>
      </Section>

      <Section title="8. Sécurité">
        <p>
          Vos données sont stockées de manière sécurisée via Supabase, avec chiffrement en transit (HTTPS/TLS)
          et au repos. L'accès à votre compte est protégé par authentification email + mot de passe.
          Seul le gestionnaire autorisé a accès aux données de réservation.
        </p>
      </Section>

      <Section title="9. Mineurs">
        <p>
          L'application O Taxi n'est pas destinée aux personnes de moins de 16 ans.
          Nous ne collectons pas sciemment de données concernant des mineurs.
        </p>
      </Section>

      <Section title="10. Modifications">
        <p>
          Cette politique peut être mise à jour. En cas de modification substantielle,
          vous serez informé via l'application. La date de dernière mise à jour est
          indiquée en haut de cette page.
        </p>
      </Section>

      <Section title="11. Contact">
        <p>
          Pour toute question relative à cette politique de confidentialité :
        </p>
        <p>
          <strong>O Taxi</strong><br />
          Mantes-la-Jolie, 78200<br />
          Email : <a href="mailto:kyzen78200@gmail.com" style={{ color: '#1D4ED8' }}>kyzen78200@gmail.com</a>
        </p>
      </Section>

      <div style={{
        marginTop: 48,
        paddingTop: 24,
        borderTop: '1px solid #E5E7EB',
        fontSize: 13,
        color: '#9CA3AF',
        textAlign: 'center',
      }}>
        © {new Date().getFullYear()} O Taxi — Tous droits réservés
      </div>
    </main>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ marginBottom: 36 }}>
      <h2 style={{
        fontSize: 18,
        fontWeight: 700,
        color: '#111827',
        marginBottom: 12,
        paddingBottom: 8,
        borderBottom: '2px solid #E5E7EB',
      }}>
        {title}
      </h2>
      <div style={{ fontSize: 15, color: '#374151' }}>{children}</div>
    </section>
  )
}

const thStyle: React.CSSProperties = {
  padding: '10px 12px',
  textAlign: 'left',
  fontWeight: 600,
  fontSize: 13,
  color: '#374151',
  borderBottom: '1px solid #E5E7EB',
}

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderBottom: '1px solid #F3F4F6',
  color: '#374151',
  fontSize: 13,
}
