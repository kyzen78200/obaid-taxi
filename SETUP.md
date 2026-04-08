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

---

## Étape 3 — Configurer Supabase

1. Va sur [supabase.com](https://supabase.com) → Créer un nouveau projet
2. Dans le projet Supabase :
   - **Settings → API** : copie l'URL et la clé `anon` et `service_role`
   - **SQL Editor** : exécute les fichiers dans l'ordre :
     - `supabase/migrations/001_initial.sql`
     - `supabase/migrations/002_loyalty_function.sql`

3. Active le **Realtime** sur la table `bookings` :
   - Database → Replication → activer `bookings`

---

## Étape 4 — Configurer Google Maps

1. Va sur [console.cloud.google.com](https://console.cloud.google.com)
2. Activer les APIs :
   - **Maps SDK for Android**
   - **Maps SDK for iOS**
   - **Places API**
   - **Directions API**
3. Créer une clé API et la restreindre à ces APIs

---

## Étape 5 — Variables d'environnement

Copie `.env.example` en `.env` et remplis les valeurs :

```bash
cp .env.example .env
```

```env
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaXXX...
```

Dans `apps/mobile/app.json`, remplace `GOOGLE_MAPS_API_KEY` par ta vraie clé.

---

## Étape 6 — Lancer l'application mobile

```bash
# Depuis la racine du monorepo
npm run dev:mobile

# Ou depuis apps/mobile
cd apps/mobile
npx expo start
```

Puis :
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
├── apps/mobile/          ← App client iOS/Android (Expo Router)
│   ├── app/(auth)/       ← Écrans d'authentification
│   ├── app/(app)/        ← Écrans principaux (tabs)
│   ├── lib/              ← Supabase client, Google Maps
│   └── store/            ← État global (Zustand)
├── packages/shared/      ← Moteur tarifaire + types TS
└── supabase/
    ├── migrations/       ← Schéma SQL à exécuter dans Supabase
    └── functions/        ← Edge Functions (notifications)
```

---

## Prochaine étape : Admin Web

L'application admin (back-office) sera créée dans `apps/admin/` avec Next.js.
Lance `npm run dev:admin` une fois créée.

---

## Déploiement mobile (EAS Build)

```bash
npm install -g eas-cli
eas login
eas build --platform all --profile preview
```
