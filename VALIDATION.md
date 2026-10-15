# Vérification de la phase 1 — 15 octobre 2026

- Contrôle TypeScript : réussi (`tsc -b`).
- Build Vite de production : réussi (`vite build --configLoader runner`).
- Tests Vitest : 9 tests réussis (`vitest run --configLoader runner`).
- Aperçu de production : servi localement sur le port 5173 et ouvert dans le navigateur intégré.
- Accueil : rendu visuellement vérifié sur ordinateur.
- Ma lecture : sélection du verset 9 de Genèse 3, validation, rechargement, puis constat de 9/24 versets. Correction du verset 9, puis constat de 8/24.
- Affichage mobile : contrôle à 390 × 844, commandes de lecture et navigation inférieure visibles. Ce contrôle ne remplace pas les tests Android/iPad réels.

Limites de l’environnement : les commandes pnpm du runtime effectuent une vérification réseau additionnelle et peuvent échouer avant de lancer le script ; les vérifications ci-dessus ont été exécutées directement avec les CLI Node installées. Le chargement Vite standard de configuration est empêché par les restrictions de lecture des dossiers parents : `--configLoader runner` est configuré dans les scripts pour les éviter. L’aperçu de production a été utilisé pour le test navigateur, car la préoptimisation du serveur de développement rencontre aussi cette restriction.

Le build signale un paquet JavaScript de 671 ko (198 ko gzip), principalement lié au graphique Recharts. Un découpage différé de la page Statistiques permettra de réduire le chargement initial.

Restent non vérifiés : installation PWA réelle, comportement hors ligne sur appareils, liens JW Library iPad, conformité du référentiel à la NWT, import et synchronisation (hors phase 1).
