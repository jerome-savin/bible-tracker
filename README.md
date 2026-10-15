# Au fil des pages — Bible Tracker

PWA personnelle React, TypeScript et Vite, avec Tailwind CSS, React Router et Lucide. Les lots A à D de consolidation sont locaux sur `feature/phase-1-5-consolidation`. Aucun compte ni connexion Supabase.

## Démarrage

Node.js 22 ou ultérieur et pnpm : `pnpm install`, puis `pnpm dev`. Vérifications : `pnpm test` et `pnpm build`. Le build statique complet est dans `dist`, avec un service worker généré ; le worker modèle de `public` ne doit pas être publié seul.

## Usage

Accueil montre la progression et le prochain segment non lu. « Marquer comme lu » enregistre ce segment en un clic. Dans Lecture, toucher un verset non lu le marque ; toucher un verset lu corrige sa dernière validation active. Une autre lecture peut maintenir la coche, avec un message explicite. « Tout marquer comme lu » complète le chapitre ; « Relire ce chapitre » enregistre une relecture explicite d'un chapitre terminé.

Trois entrées principales : Accueil, Lecture, Statistiques. Menu donne accès à Parcours et Paramètres. Le dernier passage consulté est mémorisé séparément de la progression. La démonstration est identifiée et n'est jamais présentée comme un carnet personnel. Le texte biblique reste dans JW Library.

Paramètres → Avancé permet de sauvegarder ou restaurer. Un import exige aperçu, confirmation et copie préalable transactionnelle. Télécharger régulièrement une sauvegarde hors du navigateur.

## Architecture

- `src/domain` : modèles, contrat ReadingRepository et moteur métier A.
- `src/data` : références et démonstration identifiée.
- `src/services/repository.ts` : stockage IndexedDB v2, écritures incrémentales, copies et migrations B.
- `src/services/backups.ts` : validation et sauvegardes versionnées compatibles phase 1.
- `src/services/readingActions.ts` : intentions de lecture immédiate et sérialisation des écritures.
- `src/services/passageNavigation.ts` et `jw.ts` : URL bibliques et liens HTTPS centralisés.
- `src/pages`, `src/components` : pages différées, navigation, sauvegardes et statut PWA.
- `public/sw.js`, `scripts/build-pwa.mjs`, `src/services/pwa.ts` : précache complet et mises à jour explicites C.
- `src/style.css`, `src/ui.css` : thème clair violet et adaptations tactiles.

Recharts reste dans les dépendances installées mais n'est plus chargé depuis la simplification D.

## Références et limites

Les 66 livres et 1 189 chapitres proviennent de la [source figée](https://github.com/bkuhl/bible-verse-counts-per-chapter/blob/996e993487e713431865e6433c42f6d84f6580de/bible.json), empreinte Git blob `2cbb2c0e2a00db458bf3af8636a725a65c8cc3fe`. Les 31 102 positions numériques ne sont **pas un total NWT certifié**. Numéros omis et conditions de redistribution restent à vérifier ; aucun changement silencieux des progressions existantes.

La projection utilise la progression nouvelle, hors relectures, avec un minimum d'observation. Les corrections conservent les traces et les UUID historiques. Voir les bilans pour les règles exactes et limites de compatibilité.

Le mode hors connexion couvre l'interface, pas le texte biblique. Android/iPad, installation, éviction du stockage et ouverture native JW Library restent à vérifier sur appareils réels. Le stockage et ses copies restent locaux, sans garantie de conservation par le système.

## Bilans et suite

- [Lot A : métier et référentiel](docs/LOT-A.md)
- [Lot B : sauvegardes et stockage](docs/LOT-B.md)
- [Lot C : navigation et PWA](docs/LOT-C.md)
- [Lot D : simplification et tests](docs/LOT-D.md)

Suite : validation sur appareils réels et du référentiel d'édition, puis synchronisation et parcours chronologique seulement sur instruction. Aucun push, déploiement ou changement serveur n'a été effectué pendant ces lots.
