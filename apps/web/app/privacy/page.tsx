import Link from 'next/link'

export const metadata = {
  title: 'Politique de confidentialité — O Taxi',
  description: 'Politique de confidentialité de l\'application O Taxi',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <Link href="/" className="text-blue-700 text-sm font-medium hover:text-blue-800">← Retour</Link>
        <h1 className="text-base font-semibold text-gray-900">Politique de confidentialité</h1>
      </header>

      <div className="flex-1 px-4 py-10">
        <div className="w-full max-w-2xl mx-auto space-y-8">

          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Politique de confidentialité</h2>
            <p className="text-sm text-gray-500">Dernière mise à jour : mai 2026</p>
          </div>

          <section className="space-y-3">
            <h3 className="text-base font-semibold text-gray-900">1. Responsable du traitement</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              O Taxi est un service de réservation de taxi privé basé à Mantes-la-Jolie (78).
              Le responsable du traitement des données est Obaid, exploitant du service O Taxi.
              Pour toute question relative à vos données personnelles, contactez-nous à :
              <a href="mailto:contact@otaxi.fr" className="text-blue-700 hover:underline ml-1">contact@otaxi.fr</a>.
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="text-base font-semibold text-gray-900">2. Données collectées</h3>
            <p className="text-sm text-gray-600 leading-relaxed">Nous collectons les données suivantes :</p>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 ml-2">
              <li>Nom et prénom</li>
              <li>Adresse e-mail</li>
              <li>Numéro de téléphone</li>
              <li>Adresses de départ et d'arrivée de vos courses</li>
              <li>Historique de vos réservations</li>
              <li>Token de notification push (si vous activez les notifications)</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h3 className="text-base font-semibold text-gray-900">3. Finalités du traitement</h3>
            <p className="text-sm text-gray-600 leading-relaxed">Vos données sont utilisées pour :</p>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 ml-2">
              <li>Gérer et confirmer vos réservations de taxi</li>
              <li>Vous envoyer des confirmations et rappels par e-mail</li>
              <li>Vous envoyer des notifications push sur l'état de votre course</li>
              <li>Gérer votre compte et votre historique de courses</li>
              <li>Calculer vos points de fidélité</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h3 className="text-base font-semibold text-gray-900">4. Base légale</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              Le traitement de vos données est fondé sur l'exécution du contrat de transport (réservation de course)
              et votre consentement pour les communications marketing et notifications push.
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="text-base font-semibold text-gray-900">5. Conservation des données</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              Vos données sont conservées pendant la durée de votre relation avec O Taxi,
              et jusqu'à 3 ans après votre dernière interaction pour les besoins comptables et légaux.
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="text-base font-semibold text-gray-900">6. Partage des données</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              Vos données ne sont jamais vendues à des tiers. Elles peuvent être transmises à nos prestataires techniques
              (hébergement, envoi d'e-mails) dans le strict cadre de la fourniture du service :
            </p>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 ml-2">
              <li>Supabase (base de données et authentification)</li>
              <li>Resend (envoi d'e-mails transactionnels)</li>
              <li>Expo (notifications push mobiles)</li>
              <li>Vercel (hébergement)</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h3 className="text-base font-semibold text-gray-900">7. Vos droits</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              Conformément au RGPD, vous disposez des droits suivants sur vos données :
            </p>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 ml-2">
              <li>Droit d'accès à vos données</li>
              <li>Droit de rectification</li>
              <li>Droit à l'effacement (« droit à l'oubli »)</li>
              <li>Droit à la portabilité</li>
              <li>Droit d'opposition au traitement</li>
            </ul>
            <p className="text-sm text-gray-600 leading-relaxed">
              Pour exercer ces droits, contactez-nous à{' '}
              <a href="mailto:contact@otaxi.fr" className="text-blue-700 hover:underline">contact@otaxi.fr</a>.
              Vous pouvez également supprimer votre compte directement depuis votre espace personnel dans l'application.
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="text-base font-semibold text-gray-900">8. Cookies</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              L'application web utilise des cookies de session strictement nécessaires au fonctionnement
              du service (authentification). Aucun cookie publicitaire ou de tracking n'est utilisé.
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="text-base font-semibold text-gray-900">9. Contact et réclamations</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              Pour toute question ou réclamation concernant vos données personnelles, contactez-nous à{' '}
              <a href="mailto:contact@otaxi.fr" className="text-blue-700 hover:underline">contact@otaxi.fr</a>.
              Vous avez également le droit d'introduire une réclamation auprès de la CNIL (
              <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">www.cnil.fr</a>
              ).
            </p>
          </section>

        </div>
      </div>
    </div>
  )
}
