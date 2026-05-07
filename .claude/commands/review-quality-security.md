# Agent B — Qualité du code & Sécurité

Tu es un Senior Developer et Security Reviewer qui effectue une revue complète de la qualité du code et de la sécurité du projet Obaid Taxi.

## Contexte du projet
- App taxi avec données GPS, comptes utilisateurs, et future facturation en ligne
- Stack : React Native/Expo (mobile), Next.js 14 (admin/drivers/web), Supabase (auth + BDD + Realtime)
- TypeScript strict mode activé globalement (tsconfig.base.json)
- Lis `CLAUDE.md` en premier pour le contexte complet

## Ta mission

### 1. TypeScript — Types et sécurité
Parcours tous les fichiers `.ts` et `.tsx` et recense :
- Tous les `any` explicites (cibles connues : `apps/mobile/app/(app)/index.tsx:84`, `booking/[id].tsx:87+`, `confirm.tsx:207`)
- Les cast forcés `as X` sans garde-fous
- Les interfaces manquantes (ex : booking avec relations chauffeur non typé dans `packages/shared/src/types.ts`)
- Les retours de fonction non typés

### 2. Duplication de code
Identifie les patterns répétés qui devraient être extraits :
- `MAP_STYLE` : défini identiquement dans `apps/mobile/app/(app)/index.tsx:35-49` ET `booking/[id].tsx:9-23`
- Fonctions `formatDate`/`formatTime` dispersées (date-fns sans centralisation)
- Pattern `Alert.alert('Erreur', message)` éparpillé dans tous les screens mobile
- Styles de boutons et inputs refaits dans chaque composant

### 3. Composants surchargés
- `apps/mobile/app/(app)/index.tsx` fait ~865 lignes — identifie ce qui devrait être extrait (BottomSheet, FormulaireRéservation, SélecteurDate, etc.)
- Y a-t-il d'autres fichiers > 300 lignes qui devraient être découpés ?

### 4. Sécurité API
Examine les routes API dans `apps/admin/app/api/` et `apps/drivers/app/api/` :
- Les routes sont-elles protégées par `lib/api-auth.ts` ?
- Le rate limiting (`lib/rate-limit.ts`) est-il appliqué sur toutes les routes sensibles ?
- Les CORS sont-ils correctement configurés ?
- Les tokens et secrets ne sont-ils jamais loggués ou exposés dans les réponses ?

### 5. Sécurité Supabase
Examine `supabase/migrations/` :
- Les politiques RLS sont-elles présentes sur TOUTES les tables ?
- Un utilisateur peut-il accéder aux données d'un autre utilisateur ?
- Les Edge Functions dans `supabase/functions/` vérifient-elles l'authenticité des webhooks ?

### 6. Gestion des erreurs
- Recense les `catch` silencieux (erreur ignorée sans log ni feedback utilisateur)
- Cible connue : `apps/mobile/app/(app)/booking/[id].tsx:143`
- Y a-t-il des `Promise` non gérées (`.then()` sans `.catch()`) ?
- Les Error Boundaries couvrent-ils bien toutes les zones critiques ?

### 7. Conventions et cohérence
- Les conventions de nommage sont-elles respectées partout (PascalCase composants, camelCase variables, UPPER_SNAKE_CASE constantes) ?
- Le mélange français/anglais dans le code est-il cohérent (UI en français, logique en anglais) ?

## Format du rapport

Écris le rapport dans `.claude/reports/quality-security.md` avec ce plan :

```
# Rapport Qualité & Sécurité — [date du jour]

## Résumé exécutif
[État global, niveau de risque sécurité]

## 🔐 Sécurité
### Critique
[Problèmes à corriger immédiatement]
### À surveiller
[Risques potentiels]

## 🐛 Qualité du code
### Types TypeScript manquants ou incorrects
[Liste avec fichier:ligne]
### Duplication identifiée
[Quoi dupliquer, où, solution proposée]
### Composants à refactoriser
[Fichier, taille actuelle, découpage suggéré]

## ⚠️ Gestion des erreurs
[Catch silencieux, promesses non gérées]

## Recommandations prioritaires
[Liste ordonnée par sévérité]
```

Sois précis : cite les chemins de fichiers et les lignes. Ne modifie aucun fichier source.
