# Obaid Taxi — Instructions pour Claude

## Vue d'ensemble du projet

Monorepo **npm workspaces + Turborepo** pour un service de taxi privé (VTC) basé à Mantes-la-Jolie (78).
Propriétaire : Obaid (kyzen78200@gmail.com). Développeur : Youssef (zebreyn@gmail.com).

```
obaid-taxi/
├── apps/
│   ├── admin/          # Next.js 14 — dashboard admin (Vercel → otaxi.fr)
│   └── mobile/         # Expo SDK 54 / React Native 0.81.5 — app client iOS + Android
├── packages/
│   └── shared/         # Types TypeScript + logique tarifaire partagés
├── package.json        # root — npm workspaces
├── turbo.json
└── .npmrc              # legacy-peer-deps=true (conflit React 18 vs 19)
```

---

## Stack technique

### Admin (`apps/admin`)
- **Next.js 14** + **React 18.3.1** (explicite dans package.json — ne pas changer)
- **Supabase** (auth + BDD + storage) via `@supabase/ssr`
- **Resend** pour les emails
- **Web Push** (VAPID) pour les notifications admin
- **Vercel Hobby** — cron limité à 1/jour → `"0 8 * * *"` dans `vercel.json`
- URL prod : `https://otaxi.fr` (custom domain Vercel)

### Mobile (`apps/mobile`)
- **Expo SDK 54** + **React Native 0.81.5** + **React 19.1.0** (ne pas downgrader)
- **expo-router** v6 (file-based routing)
- **Supabase** via `@supabase/supabase-js`
- **react-native-maps** + **Google Places Autocomplete** + **Google Directions API**
- **expo-notifications** (push via Expo Push Service)
- **EAS Build** pour les builds cloud (Android APK + iOS IPA)
- **zustand** pour le state (auth, booking, guestHistory)
- **NativeWind** + StyleSheet (pas de styled-jsx)

### Shared (`packages/shared`)
- Types TypeScript : `Booking`, `Profile`, `BookingStatus`, `TariffCode`, `TripType`...
- Logique tarifaire : `calculateFare()`, `getTariffCode()`
- Doit être **build avant tout** → `postinstall` dans root package.json

---

## Services externes

| Service | Compte | Usage |
|---------|--------|-------|
| Supabase | kyzen78200@gmail.com | BDD, auth, storage, RLS |
| Vercel | kyzen78200 (via GitHub OAuth) | Hébergement admin |
| Resend | kyzen78200@gmail.com | Emails transactionnels |
| EAS / Expo | zebreyn (kyzen78200@gmail.com) | Builds mobiles |
| Google Cloud | — | Maps SDK, Places, Directions, Geocoding |
| Apple Developer | — | iOS builds + TestFlight (99€/an) |
| Google Play | — | Android store |
| OVH | — | Domaine otaxi.fr |

---

## Règles tarifaires

```
BASE_CHARGE = 2.94€
MIN_FARE    = 8.00€
MARGIN      = 1.35 (±35% → fourchette min/max)

Tarif A : Aller-retour Jour  → 0.99€/km
Tarif B : Aller-retour Nuit  → 1.49€/km
Tarif C : Aller simple Jour  → 1.98€/km
Tarif D : Aller simple Nuit  → 2.97€/km

Nuit = 19h-8h
```

---

## Points critiques — NE PAS TOUCHER

### Conflit React 18 vs 19
- `apps/admin/package.json` doit avoir `"react": "18.3.1"` et `"react-dom": "18.3.1"` explicitement
- `apps/mobile/package.json` doit avoir `"react": "19.1.0"` explicitement
- `.npmrc` à la racine : `legacy-peer-deps=true`
- `apps/mobile/metro.config.js` utilise `resolveRequest` pour forcer React 19 → ne pas supprimer ni simplifier

### EAS Build
- `eas.json` est dans `apps/mobile/` (pas à la racine)
- `app.config.js` (pas `app.json`) → permet la substitution de `process.env.GOOGLE_MAPS_API_KEY` au build
- Variable EAS : `GOOGLE_MAPS_API_KEY` (sensitive) dans l'environnement `preview`
- La clé Google Maps doit être **sans restriction d'application** (type "unrestricted") mais avec restriction API

### Supabase RLS — policies importantes
- `bookings` : les invités peuvent INSERT (`client_id IS NULL`) et SELECT leurs propres réservations
- `push_tokens` : policy `Users manage own push tokens` (ALL)
- `profiles` : colonne `role` TEXT avec default `'client'`

---

## Architecture clés

### Auth mobile
- `store/auth.ts` : session Supabase, user, profile, `isGuest` flag
- Mode invité : `setGuest()` → bypass auth, réservations avec `client_id = null`
- `store/guestHistory.ts` : historique local AsyncStorage pour les invités (zustand + persist)
- Email obligatoire pour les invités → permet de lier au compte plus tard

### Notifications push
- Enregistrement dans `app/(app)/_layout.tsx` → `registerPushToken(userId)`
- Nécessite `projectId` de `Constants.expoConfig.extra.eas.projectId` (Expo SDK 54)
- Token stocké dans table `push_tokens` via upsert

### Routing mobile (expo-router)
```
app/
├── _layout.tsx          # root layout — initialise auth session
├── (auth)/              # welcome, login, register
│   └── welcome.tsx      # point d'entrée si non connecté
└── (app)/               # app principale (tabs)
    ├── _layout.tsx      # tab bar + notifications setup
    ├── index.tsx        # écran réservation (carte + formulaire)
    ├── estimate.tsx     # estimation tarifaire
    ├── confirm.tsx      # confirmation course (guest ou user)
    ├── history.tsx      # historique (Supabase si connecté, AsyncStorage si invité)
    ├── profile.tsx
    └── booking/[id].tsx # détail course (realtime Supabase si connecté)
```

### Routes API admin
```
app/api/
├── notify/
│   ├── booking-created/   # POST — email client + notif admin
│   ├── driver-status/     # POST — email chauffeur (approuvé/refusé)
│   └── booking-status/    # POST — notif push client
├── push/subscribe/        # POST — enregistre token push admin
├── create-driver/         # POST — crée compte auth chauffeur
├── register-driver/       # POST — envoie email welcome chauffeur
└── cron/reminders/        # GET — rappels journaliers (déclenché à 8h)
```

---

## Commandes utiles

```bash
# Développement
npm run dev:admin          # Next.js admin sur :3001
npm run dev:mobile         # Expo Go (attention au conflit React)

# Builds EAS (depuis apps/mobile/)
npx eas build --profile preview --platform android --non-interactive
npx eas build --profile preview --platform ios   # interactif (certificats Apple)

# Vérifier un build
npx eas build:view <build-id>

# Variables d'env EAS
npx eas env:list --environment preview
npx eas env:create --environment preview --name GOOGLE_MAPS_API_KEY --type sensitive --value "..."
```

---

## Roadmap post-V1 (ne pas implémenter avant le lancement)

1. **Migration npm → Yarn workspaces** — résoudre proprement le conflit React 18/19 sans patch metro
2. **App chauffeur** — nouvelle app React Native dans le monorepo (pas PWA — Apple App Store refuse les PWA)
3. Ces deux points sont à faire en parallèle lors du développement de l'app chauffeur
