# Obaid Taxi — Guide de démarrage

## Prérequis

1. **Node.js 20+** — [nodejs.org/fr](https://nodejs.org/fr) → Télécharger LTS
2. **Compte Supabase** — [supabase.com](https://supabase.com) (gratuit)
3. **Compte Google Cloud** — Pour la clé API Google Maps
4. **Expo Go** (optionnel) — App mobile pour tester sur téléphone

---

## Étape 1 — Installer Node.js

Télécharge et installe Node.js LTS depuis https://nodejs.org/fr

Vérifie l'installation :
```bash
node --version  # doit afficher v20.x.x ou supérieur
npm --version
```

---

## Étape 2 — Installer les dépendances

```bash
cd "C:/Users/Youssef/Documents/Obaid Taxi/obaid-taxi"
npm install
```

Le script `postinstall` compile automatiquement `packages/shared` — c'est normal.

---

## Étape 3 — Configurer Supabase

1. Va sur [supabase.com](https://supabase.com) → Créer un nouveau projet
2. Dans le projet Supabase :
   - **Settings → API** : copie l'URL et les clés `anon` et `service_role`
   - **SQL Editor** : exécute les fichiers de migration dans l'ordre numérique :
     ```
     supabase/migrations/001_initial.sql
     supabase/migrations/002_loyalty_function.sql
     supabase/migrations/003_...
     ...jusqu'à la dernière migration disponible
     ```

3. Active le **Realtime** sur la table `bookings` :
   - Database → Replication → activer `bookings`

4. Déploie la Edge Function :
   ```bash
   supabase functions deploy on-booking-status-changed
   ```

---

## Étape 4 — Configurer Google Maps

1. Va sur [console.cloud.google.com](https://console.cloud.google.com)
2. Activer les APIs :
   - **Maps SDK for Android**
   - **Maps SDK for iOS**
   - **Places API**
   - **Directions API**
   - **Geocoding API**
3. Créer une clé API **sans restriction d'application** mais avec restriction par API (les 5 APIs ci-dessus)

---

## Étape 5 — Variables d'environnement

### App mobile (`apps/mobile/.env`)

```env
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaXXX...
```

### App admin (`apps/admin/.env.local`)

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
RESEND_API_KEY=re_xxx...
ADMIN_EMAIL=kyzen78200@gmail.com
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_EMAIL=mailto:kyzen78200@gmail.com
CRON_SECRET=un_secret_aleatoire
```

### App drivers (`apps/drivers/.env.local`) — mêmes variables Supabase que admin

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_EMAIL=mailto:kyzen78200@gmail.com
```

---

## Étape 6 — Lancer les applications

```bash
# Depuis la racine du monorepo

# Back-office gestionnaire (port 3001)
npm run dev:admin

# Dashboard chauffeur (port 3002)
npm run dev:drivers

# App web client (port 3000)
npm run dev:web

# App mobile Expo (attention au conflit React 18/19 en local)
npm run dev:mobile
```

Pour l'app mobile en local :
- Scanne le QR code avec **Expo Go** (iOS / Android)
- Ou appuie `i` pour le simulateur iOS, `a` pour l'émulateur Android

---

## Étape 7 — Tests du moteur tarifaire

```bash
cd packages/shared
npm test
```

---

## Structure des dossiers

```
obaid-taxi/
├── apps/
│   ├── admin/          # Next.js 14 — dashboard gestionnaire (port 3001)
│   ├── drivers/        # Next.js 14 — dashboard chauffeur (port 3002)
│   ├── web/            # Next.js 14 — app web client (port 3000)
│   └── mobile/         # Expo SDK 54 — app client iOS + Android
├── packages/
│   └── shared/         # Types TypeScript + logique tarifaire (compilé via postinstall)
└── supabase/
    ├── migrations/      # Schéma SQL (001 → 013+) à exécuter dans Supabase
    └── functions/       # Edge Functions (on-booking-status-changed)
```

---

## Déploiement mobile (EAS Build)

La clé Google Maps doit être configurée comme variable d'env EAS (pas dans le code) :

```bash
# Depuis apps/mobile/
npm install -g eas-cli
eas login

# Configurer la clé Google Maps comme variable sensible
npx eas env:create --environment preview --name GOOGLE_MAPS_API_KEY --type sensitive --value "AIzaXXX..."

# Lancer un build
npx eas build --profile preview --platform android --non-interactive
npx eas build --profile preview --platform ios   # interactif (certificats Apple)
```

> Note : `eas.json` est dans `apps/mobile/`, pas à la racine du monorepo.

---

## Points d'attention

- **Conflit React 18/19** : `apps/admin` utilise React 18.3.1, `apps/mobile` utilise React 19.1.0. Ne pas modifier ces versions. Le fichier `.npmrc` à la racine contient `legacy-peer-deps=true` qui est requis.
- **`packages/shared` doit être compilé** avant de lancer les apps — c'est automatique via `postinstall`.
- **Cron Vercel** : limité à 1 exécution/jour sur le plan Hobby (`"0 8 * * *"` dans `apps/admin/vercel.json`).
