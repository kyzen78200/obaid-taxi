# Obaid Taxi — Instructions pour Claude

## Contexte et objectif du projet

**Obaid Taxi** est une application de réservation de taxi privé (VTC) basée à **Mantes-la-Jolie (78)**.

**Problème résolu :** Avant l'app, les clients réservaient par appels et SMS informels — aucune transparence tarifaire, aucun suivi, gestion manuelle. L'app centralise tout.

**Principe fondamental :** MVP sans paiement en ligne. Chaque réservation est **validée manuellement par le gestionnaire** (Obaid) avant confirmation. Le client reçoit une estimation de prix, pas un prix fixe.

**Clients cibles :** Majoritairement sur **iOS**. Peuvent réserver avec ou sans compte.

**Propriétaire :** Obaid (kyzen78200@gmail.com) — gestionnaire et chauffeur.
**Développeur :** Youssef (zebreyn@gmail.com).

---

## Règles métier

### Flux de réservation
1. Client saisit départ + arrivée + date/heure + type de course
2. L'app calcule une **fourchette de prix** (estimation, pas un devis ferme)
3. Client confirme → course en statut `pending`
4. **Gestionnaire valide manuellement** dans le dashboard admin → statut `confirmed`
5. Client reçoit email + notification push de confirmation

### Types de course
- **Aller simple** (`one_way`) — tarifs C (jour) ou D (nuit)
- **Aller-retour** (`round_trip`) — tarifs A (jour) ou B (nuit)
- **Course conventionnée** (`is_conventional`) — transport médical CPAM, le client peut joindre une attestation PDF

### Règles tarifaires
```
Prise en charge fixe : 2,94€
Minimum légal        : 8,00€
Fourchette           : prix_base × 1 à prix_base × 1,35 (arrondi euro supérieur)

Tarif A — Aller-retour Jour  : 0,99€/km   (8h–19h)
Tarif B — Aller-retour Nuit  : 1,49€/km   (19h–8h)
Tarif C — Aller simple Jour  : 1,98€/km   (8h–19h)
Tarif D — Aller simple Nuit  : 2,97€/km   (19h–8h)
```
Logique dans `packages/shared/src/pricing.ts` — `calculateFare()` et `getTariffCode()`.

### Forfaits (fare_packages)
Destinations fixes (gares, aéroports) avec prix forfaitaire depuis/vers des zones définies. Stockés en base Supabase, chargés dynamiquement.

### Statuts d'une course
| Statut | Signification |
|--------|--------------|
| `pending` | En attente de validation gestionnaire |
| `confirmed` | Validée par le gestionnaire |
| `in_progress` | Course en cours |
| `completed` | Effectuée |
| `refused` | Refusée par le gestionnaire |
| `cancelled` | Annulée par le client |
| `cancellation_requested` | Demande d'annulation en attente |
| `no_show` | Client absent |

### Règles d'annulation client
- Statut `pending` → annulation libre
- Statut `confirmed` → annulation possible **uniquement si > 2h avant le départ**
- Motif obligatoire à sélectionner

### Mode invité
- Le client peut réserver **sans créer de compte**
- Nom, téléphone et **email obligatoires** (permet de lier les courses si compte créé plus tard)
- Historique sauvegardé en local (AsyncStorage via `store/guestHistory.ts`)

---

## Structure du monorepo

```
obaid-taxi/
├── apps/
│   ├── admin/          # Next.js 14 — dashboard gestionnaire (Vercel → admin.otaxi.fr)
│   ├── drivers/        # Next.js 14 — dashboard chauffeur (Vercel → drivers.otaxi.fr)
│   ├── web/            # Next.js 14 — app web client (Vercel → otaxi.fr)
│   └── mobile/         # Expo SDK 54 / React Native 0.81.5 — app client iOS + Android
├── packages/
│   └── shared/         # Types TypeScript + logique tarifaire partagés
├── CLAUDE.md
├── package.json        # root — npm workspaces
├── turbo.json
└── .npmrc              # legacy-peer-deps=true (conflit React 18 vs 19)
```

---

## Stack technique

### Admin (`apps/admin`)
- **Next.js 14** + **React 18.3.1** (explicite dans package.json — ne pas changer)
- **Supabase** (auth + BDD + storage) via `@supabase/ssr`
- **Resend** pour les emails transactionnels
- **Web Push** (VAPID) pour les notifications admin
- **Vercel Hobby** — cron limité à 1/jour → `"0 8 * * *"` dans `vercel.json`
- URL prod admin : `https://admin.otaxi.fr` — `/login` pour l'admin
- URL prod drivers : `https://drivers.otaxi.fr` — `/login` pour les chauffeurs
- URL prod web client : `https://otaxi.fr`

### Mobile (`apps/mobile`)
- **Expo SDK 54** + **React Native 0.81.5** + **React 19.1.0** (ne pas downgrader)
- **expo-router** v6 (file-based routing)
- **Supabase** via `@supabase/supabase-js`
- **react-native-maps** + **Google Places Autocomplete** + **Google Directions API**
- **expo-notifications** (push via Expo Push Service)
- **EAS Build** pour les builds cloud (Android APK + iOS IPA)
- **zustand** pour le state (auth, booking, guestHistory)

### Shared (`packages/shared`)
- Types TypeScript : `Booking`, `Profile`, `BookingStatus`, `TariffCode`, `TripType`...
- Logique tarifaire : `calculateFare()`, `getTariffCode()`
- **Doit être build avant tout** → script `postinstall` dans root `package.json`

---

## Services externes

| Service | Compte | Usage |
|---------|--------|-------|
| Supabase | kyzen78200@gmail.com | BDD, auth, storage, RLS |
| Vercel | kyzen78200 (GitHub OAuth) | Hébergement admin |
| Resend | kyzen78200@gmail.com | Emails transactionnels |
| EAS / Expo | zebreyn (kyzen78200@gmail.com) | Builds mobiles |
| Google Cloud | — | Maps SDK, Places, Directions, Geocoding |
| Apple Developer | — | iOS builds + TestFlight (99€/an) |
| Google Play | — | Android store |
| OVH | — | Domaine otaxi.fr |

---

## Points critiques — NE PAS TOUCHER

### Conflit React 18 vs 19
- `apps/admin/package.json` doit avoir `"react": "18.3.1"` et `"react-dom": "18.3.1"` explicitement
- `apps/mobile/package.json` doit avoir `"react": "19.1.0"` explicitement
- `.npmrc` à la racine : `legacy-peer-deps=true`
- `apps/mobile/metro.config.js` utilise `resolveRequest` pour forcer React 19 — ne pas supprimer ni simplifier

### EAS Build
- `eas.json` est dans `apps/mobile/` (pas à la racine)
- `app.config.js` (pas `app.json`) → permet la substitution de `process.env.GOOGLE_MAPS_API_KEY` au build
- Variable EAS : `GOOGLE_MAPS_API_KEY` (sensitive) dans l'environnement `preview`
- La clé Google Maps doit être **sans restriction d'application** mais avec restriction par API (Maps SDK Android/iOS, Places, Directions)

### Supabase RLS — policies importantes
- `bookings` INSERT : autorisé si `client_id IS NULL` (invités)
- `bookings` SELECT : autorisé si `client_id IS NULL` (invités) ou `client_id = auth.uid()` (connectés)
- `push_tokens` : policy `Users manage own push tokens` (ALL)
- `profiles` : colonne `role` TEXT — valeurs `'client'` (default) ou `'admin'`

---

## Architecture clés

### Routing mobile (expo-router)
```
app/
├── _layout.tsx           # root — initialise session Supabase
├── (auth)/               # non connecté
│   ├── welcome.tsx       # écran d'accueil (login / register / continuer en invité)
│   ├── login.tsx
│   └── register.tsx
└── (app)/                # app principale (tabs)
    ├── _layout.tsx       # tab bar + enregistrement push token
    ├── index.tsx         # réservation (carte + formulaire + bottom sheet)
    ├── estimate.tsx      # estimation tarifaire
    ├── confirm.tsx       # confirmation (infos invité ou profil connecté)
    ├── history.tsx       # historique (Supabase si connecté, AsyncStorage si invité)
    ├── profile.tsx
    └── booking/[id].tsx  # détail + statut realtime + annulation
```

### State management mobile
- `store/auth.ts` — session, user, profile, `isGuest` flag
- `store/booking.ts` — formData, estimate, routePolyline (reset après confirmation)
- `store/guestHistory.ts` — historique local persisté via AsyncStorage (zustand + persist)

### Routes API admin
```
app/api/
├── notify/
│   ├── booking-created/   # POST — email client + notif admin in-app
│   ├── driver-status/     # POST — email chauffeur (approuvé/refusé)
│   └── booking-status/    # POST — notif push client
├── push/subscribe/        # POST — enregistre token push admin (Web Push VAPID)
├── create-driver/         # POST — crée compte auth Supabase pour un chauffeur
├── register-driver/       # POST — envoie email welcome chauffeur
└── cron/reminders/        # GET — rappels journaliers (8h, Vercel cron)
```

### Libs importantes
- `apps/mobile/lib/google-maps.ts` — `getRouteInfo()` via Google Directions API
- `apps/mobile/lib/supabase.ts` — client Supabase mobile
- `apps/admin/lib/notify.ts` — `sendEmail()` + `createAdminNotification()`
- `apps/admin/lib/resend.ts` — templates HTML emails (`bookingConfirmedHtml`, `driverWelcomeHtml`...)
- `apps/admin/lib/webpush.ts` — envoi notifications push Web (VAPID)

---

## Commandes utiles

```bash
# Développement
npm run dev:admin           # Next.js admin sur :3001
npm run dev:drivers         # Next.js drivers sur :3002
npm run dev:web             # Next.js web client sur :3000
npm run dev:mobile          # Expo (attention au conflit React en local)

# Builds EAS (depuis apps/mobile/)
npx eas build --profile preview --platform android --non-interactive
npx eas build --profile preview --platform ios   # interactif (certificats Apple)
npx eas build:view <build-id>

# Variables d'env EAS
npx eas env:list --environment preview
npx eas env:create --environment preview --name GOOGLE_MAPS_API_KEY --type sensitive --value "..."
```

---

## Roadmap post-V1 (ne pas implémenter avant le lancement)

1. **Migration npm → Yarn workspaces** — résoudre proprement le conflit React 18/19 sans patch metro
2. **App chauffeur React Native** — nouvelle app dans le monorepo (pas PWA — Apple App Store refuse les PWA pures)
3. Ces deux chantiers doivent être faits **en même temps** lors du développement de l'app chauffeur
