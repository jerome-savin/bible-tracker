# Au fil des pages — Bible Tracker, phase 1

Application personnelle React + TypeScript + Vite, Tailwind CSS 4, React Router, Lucide et Recharts. Aucun compte externe, secret ou connexion Supabase. Aucun déploiement effectué.

## Démarrage

Node.js 22 ou ultérieur et pnpm : `pnpm install`, puis `pnpm dev`. Vérification : `pnpm test` et `pnpm build`. Le dossier `dist` est le résultat statique du build, pas un déploiement.

## Organisation

- `src/domain/models.ts` : livres, passages, événements UUID/ISO, utilisateur et contrat ReadingRepository.
- `src/domain/reading.ts` : sélection, corrections, progression dédupliquée, activité et projection.
- `src/data/books.json` : nombres de versets sourcés, 66 livres et 1 189 chapitres.
- `src/data/demo.ts` : démonstration identifiée et structure des parcours.
- `src/services/repository.ts` : adaptateur IndexedDB, sauvegarde atomique de l’état et fermeture des connexions.
- `src/services/jw.ts` : génération centralisée des liens HTTPS.
- `src/pages/App.tsx` : navigation et cinq espaces, priorité Accueil et Ma lecture.
- `src/style.css` : thème clair violet, navigation latérale puis inférieure sur smartphone.
- `public` : manifeste, icône et service worker de première phase.

## Comportements

Au premier démarrage, des données fictives sont affichées et identifiées. Elles restent en mode démonstration après une modification. Paramètres permet de créer un carnet personnel vide et d’exporter le JSON. Une première modification est persistée dans IndexedDB ; les erreurs ne sont pas masquées. La création d’un carnet remplace uniquement la démonstration.

Ma lecture propose les 66 livres, leurs chapitres, la sélection individuelle ou par plage, la validation complète et la correction des versets sélectionnés. Les lectures répétées restent dans l’historique et ne doublent pas la progression. Une correction enregistre l’ensemble des versets conservés dans le chapitre. Le lien JW ouvre une plage continue englobant les versets sélectionnés. Le texte biblique reste dans JW Library.

Les statistiques comptent les journées locales avec au moins une lecture non vide ; les événements utilisent ISO UTC. La moyenne porte sur 30 jours calendaires, relectures comprises. La projection utilise cette moyenne et reste indicative. Aucun retard n’est affiché comme une faute. Les objectifs annuels utilisent 365 jours comme repère.

## Provenance et limites du référentiel

Source téléchargée le 15 octobre 2026 : https://github.com/bkuhl/bible-verse-counts-per-chapter/blob/master/bible.json

Empreinte Git blob de la source : `2cbb2c0e2a00db458bf3af8636a725a65c8cc3fe`. Les données numériques sont recopiées automatiquement sans invention ; seuls les noms des livres sont traduits. Totaux : 66 livres, 1 189 chapitres, 31 102 versets. Les tests contrôlent ces totaux, les identifiants, les bornes et des chapitres repères.

Ce référentiel suit la numérotation traditionnelle de type KJV, et **n’est pas un référentiel NWT validé**. Les éditions peuvent différer, notamment sur les versets omis, les fins de Marc ou le nombre de versets de 3 Jean. L’interface le signale dans Paramètres. Avant utilisation personnelle définitive, comparer la numérotation à l’édition NWT française et décider comment gérer les numéros omis ; ne pas assimiler les 31 102 numéros à autant de versets présents dans cette édition. Vérifier également les conditions de réutilisation du jeu de données avant diffusion publique.

Le format de lien JW reprend l’exemple Android fourni. Son comportement sur iPad et les passages présentant des variantes restent à tester sur appareils réels.

## PWA et suite

Le manifeste et le service worker amorcent le mode autonome. En production HTTPS, les ressources visitées sont mises en cache ; le premier accès nécessite le réseau. L’installation et le démarrage hors ligne doivent être testés sur Android et iPad. Une icône PNG 192/512 et Apple touch icon restent à ajouter pour une compatibilité d’installation complète. Le service worker ne s’enregistre pas en développement.

Étapes suivantes : validation NWT du référentiel, tests tactiles et accessibilité sur appareils réels, extraction des pages et composants lorsque les écrans évolueront, import JSON avec validation de schéma et politique de fusion, modèle de synchronisation Supabase avec migrations et gestion des conflits, puis référentiel chronologique sourcé. Le contrat ReadingRepository permet d’ajouter un autre adaptateur sans changer les calculs métier. L’état local ne constitue pas encore une stratégie de synchronisation multiappareils.

Pour Apache, une future mise en ligne devra servir `dist`, activer HTTPS et renvoyer les routes applicatives vers `index.html`. Ces changements ne sont pas appliqués au VPS dans cette phase.
