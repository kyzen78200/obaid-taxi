# Orchestrateur — Revue complète du projet

Lance la revue complète du projet Obaid Taxi en exécutant les 5 agents spécialisés dans le bon ordre.

## Ce que tu vas faire

Tu vas orchestrer 5 agents en 3 phases, exactement comme une équipe tech senior le ferait.

---

## Phase 1 — Analyse parallèle (Agents A, B, C simultanément)

Lance les 3 agents suivants EN PARALLÈLE (dans le même appel Agent) :

**Agent A — Architecte**
- Prompt : Lis et exécute `.claude/commands/review-architect.md`
- Focalisé sur : architecture, monorepo, scalabilité
- Produit : `.claude/reports/architecture.md`

**Agent B — Qualité & Sécurité**
- Prompt : Lis et exécute `.claude/commands/review-quality-security.md`
- Focalisé sur : TypeScript, duplication, sécurité API, RLS
- Produit : `.claude/reports/quality-security.md`

**Agent C — Performance & Tests**
- Prompt : Lis et exécute `.claude/commands/review-performance.md`
- Focalisé sur : requêtes Supabase, fuites mémoire, couverture de tests
- Produit : `.claude/reports/performance-testing.md`

Lance les 3 agents avec l'outil Agent en parallèle, puis attends que tous aient terminé.

---

## Phase 2 — Synthèse (Agent D)

Une fois les 3 rapports produits :

**Agent D — Tech Lead**
- Prompt : Lis et exécute `.claude/commands/review-synthesis.md`
- Lit les 3 rapports et produit un plan d'action priorisé
- Produit : `.claude/reports/synthesis-action-plan.md`

---

## Phase 3 — Documentation (Agent E)

Une fois la synthèse produite :

**Agent E — Documentation Writer**
- Prompt : Lis et exécute `.claude/commands/review-docs.md`
- Met à jour CLAUDE.md, ajoute les JSDoc, met à jour la mémoire
- Produit : `.claude/reports/last-review.md` + modifications de CLAUDE.md

---

## Résumé final

Une fois tous les agents terminés, fournis un récapitulatif :

```
## Revue complète terminée — [date]

### Rapports produits
- ✅ .claude/reports/architecture.md
- ✅ .claude/reports/quality-security.md
- ✅ .claude/reports/performance-testing.md
- ✅ .claude/reports/synthesis-action-plan.md
- ✅ .claude/reports/last-review.md

### Fichiers mis à jour
- ✅ CLAUDE.md
- ✅ Fichiers mémoire

### Top 5 actions prioritaires
[Liste des 5 points les plus critiques du plan de synthèse]

### Commande pour la prochaine étape
Pour implémenter les corrections : demande "Applique les actions critiques du rapport de synthèse"
```

---

## Commandes disponibles

- `/review-all` — Lance la revue complète (ce fichier)
- `/review-architect` — Lance seulement l'Agent A (architecture)
- `/review-quality-security` — Lance seulement l'Agent B (qualité + sécurité)
- `/review-performance` — Lance seulement l'Agent C (performance + tests)
- `/review-synthesis` — Lance seulement l'Agent D (synthèse, nécessite A+B+C)
- `/review-docs` — Lance seulement l'Agent E (documentation, nécessite D)
