# Lot D — Simplification et stabilisation

## Périmètre

Travail local sur `feature/phase-1-5-consolidation`, à partir de `eb10b92`. État Git propre avant modification ; documents LOT-A, LOT-B et LOT-C et interfaces existantes relus. Aucun push, déploiement, changement du VPS, Apache ou des secrets. Aucun travail Supabase ou chronologique.

Les modèles, le moteur métier A, le repository B, la base IndexedDB v2, le format des sauvegardes et le service worker C sont conservés sans modification. Les événements et les copies de sauvegarde ne sont ni supprimés ni réinitialisés. Les essais navigateur utilisent uniquement les données fictives d'une origine locale distincte.

## Simplifications

- **Accueil** : pourcentage, barre, prochain segment et deux actions « Ouvrir JW Library » / « Marquer comme lu », plus accès au passage dans la Bible. Enregistrement du segment suggéré en un clic, sans récapitulatif. Fin de Bible traitée. Les statistiques, calendrier, objectif annuel, illustration et textes d'accompagnement ont quitté cet écran. La démonstration reste clairement identifiée.
- **Lecture** : livre/chapitre, précédent/suivant, lien JW, grille de numéros et actions de chapitre. Un clic non lu enregistre une lecture ; un clic lu applique la correction ciblant la validation active la plus récente, comme au lot A. La coche et `aria-pressed` représentent uniquement l'état sauvegardé.
- Si une autre validation maintient le verset lu, il reste coché et un message l'explique. Un nouveau clic peut retirer la validation restante. Aucune neutralisation globale inventée pour contourner les règles A.
- « Tout marquer comme lu » ajoute seulement les versets manquants : aucune relecture implicite. « Relire ce chapitre », disponible quand le chapitre est entièrement lu, est une action explicite en un clic ; elle crée la relecture sans gonfler la progression ou le rythme de première lecture.
- Suppression de la sélection temporaire, des formulaires de plage, de la grille de chapitres secondaire, des récapitulatifs, du panneau de corrections et de l'historique à l'écran. Leurs fonctions métier et l'historique stocké restent disponibles dans le code et les sauvegardes.
- **Navigation** : Accueil, Lecture et Statistiques seulement. Parcours/Paramètres sont dans « Menu » en haut de page, utilisable au toucher et au clavier. Les routes et liens directs existants sont maintenus. Un verset d'URL conserve un repère visuel, sans sélection temporaire ni écriture de lecture. Dernière consultation et premier segment non lu restent distincts.
- **Statistiques** : progression, chapitres terminés, jours sur 7/30 et estimation de fin. Rythme et objectif annuel restent sous un détail replié. Graphique secondaire retiré ; les calculs et historiques ne changent pas.
- **Paramètres** : sauvegarde/restauration dans « Avancé », fermé par défaut. Le composant BackupPanel et toutes ses protections B sont inchangés : validation, aperçu, confirmation, copie préalable et compatibilité.
- Les informations PWA ordinaires sont discrètes : préparation et recherche manuelle dans Paramètres ; hors connexion, erreur et mise à jour restent signalés sur les autres pages. Mise à jour toujours explicite, désactivée pendant une écriture de lecture. Le texte parlant de sélection non validée a disparu puisque cette sélection n'existe plus.

## Fiabilité des actions immédiates

`readingActions.ts` est un adaptateur entre intentions de l'interface et fonctions du lot A. Il n'introduit pas de nouvelle règle de lecture. `createReadingWriter` traite dans l'ordre les intentions reçues et calcule chacune sur le dernier état effectivement sauvegardé. Il n'actualise React et sa référence d'état qu'après réussite du repository. La file continue après un refus sans reprendre un état fictivement validé.

Les boutons de lecture sont temporairement désactivés pendant l'écriture ; les clics sur un contrôle désactivé ne sont pas comptés. Les intentions déjà reçues sont sérialisées, même avant le rendu de cet état occupé. Le repository conserve sa protection transactionnelle contre les onglets périmés. Aucune fusion silencieuse inter-onglets. L'erreur invite à réessayer ou à recharger si un autre onglet est ouvert ; aucune coche optimiste ou annonce de réussite après refus.

Le segment de l'Accueil est capturé au clic, puis filtré contre les versets déjà lus à l'exécution : une répétition de la même intention ne crée pas une relecture implicite ni ne valide automatiquement le chapitre suivant.

## Fichiers concernés et performance

- Pages : App, Dashboard, Reading, Statistics, Settings.
- Composants : Navigation et présentation de PwaStatus.
- Services : nouvel adaptateur readingActions et tests ; tests de rendu/navigation adaptés.
- Styles : complément du thème existant dans ui.css.
- Documentation : LOT-D et README actualisé.

Aucune nouvelle dépendance, aucun changement du lockfile. Recharts reste installé pour préserver les dépendances existantes, mais n'est plus importé ; il n'entre donc plus dans le build. Les pages restent différées et précachées par le plugin C.

Mesures du build final : 305,50 ko initiaux (98,39 gzip), Lecture 4,01 ko et Statistiques 1,52 ko, contre 312,54 ko initiaux et 378,60 ko pour Statistiques au lot C. La réduction principale concerne le téléchargement total, puisque C précachait aussi le graphique en arrière-plan.

## Vérifications

Les **132 tests précédents sont conservés**, avec adaptation de 5 tests de rendu devenus obsolètes (noms de navigation, props d'action, bouton Accueil et absence de sélection temporaire). Aucun test métier, stockage ou service worker n'a été retiré. Douze tests nouveaux portent le total à **144 tests dans 7 fichiers**.

Les nouveaux tests vérifient :
- clic lecture, clic correction et réouverture du stockage ;
- rafale de dix actions, UUID distincts, absence de perte, deux intentions sur le même verset ;
- marquage de chapitre sans relecture implicite et relecture explicite sans accélération du rythme ;
- correction avec couverture restante et correction d'une progression héritée sans inventer d'historique ;
- référence invalide, erreur de stockage, nouvelle tentative et poursuite de la file après échec ;
- refus d'un onglet périmé sans écriture partielle ;
- boutons directs désactivés pendant l'écriture, absence des anciens formulaires et Avancé fermé.

Ces tests d'actions utilisent le véritable repository avec fake-indexeddb ; les tests de composants utilisent le rendu serveur. Ils ne constituent pas une suite automatisée de clics dans un DOM de navigateur. Ils sont complétés par les interactions navigateur ci-dessous.

Commandes utilisées :

```text
node node_modules/vitest/vitest.mjs run --configLoader runner --no-cache
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/vite/bin/vite.js build --configLoader runner
git diff --check
```

Résultat final : 144 tests réussis, TypeScript sans émission réussi, build Vite de production réussi, aucun avertissement de chunk volumineux.

Essais dans le navigateur intégré, build de production, origine de test `127.0.0.1:5176` :
- Accueil minimal, enregistrement sans écran intermédiaire, passage suivant proposé.
- Verset non lu cliqué puis coché avec confirmation ; rechargement et coche conservée ; nouveau clic et retrait immédiat.
- Marquage du chapitre, relecture explicite, correction d'un verset encore couvert : coche conservée et explication cohérente.
- Écriture depuis un second onglet périmé : message d'échec, verset non coché, aucune fausse réussite.
- Menu secondaire, Paramètres et section Avancé fermée ; retour au passage Exode 2 par Lecture.
- Formats smartphone 390, tablette 768/1024 et ordinateur : contrôles de navigation et de débordement ; ces formats simulés ne valident pas de matériel physique.
- PWA : préparation confirmée dans Paramètres, nouvelle version appliquée explicitement sans perte ; après arrêt du serveur, ouverture et rechargement des Statistiques, lien direct Exode 3 puis verset enregistré et conservé après rechargement.

## Limites et vérifications réelles

- Tester encore Android et iPad : confort des boutons, texte agrandi, orientation, VoiceOver/TalkBack et clavier. Vérifier qu'un seul toucher donne une coche sans dialogue, qu'un échec n'en donne pas, et qu'une relecture suivie d'une correction conserve correctement une autre lecture.
- Vérifier installation, mode avion, fermeture/réouverture de la PWA et mise à jour sur appareils physiques selon le protocole du LOT-C. Le texte biblique et le lancement de JW Library, notamment sur iPad, ne sont pas garantis par notre PWA.
- Le téléchargement réel des sauvegardes reste à vérifier dans Fichiers/Téléchargements sur ces appareils, avec restauration de test et copie préalable ; protections B maintenues.
- Les écritures inter-onglets périmées demandent un rechargement. Pas de synchronisation ni de fusion automatique. Une coupure physique pendant une transaction n'a pas été réalisée ; les tests d'abandon transactionnel B restent en place.
- Relecture simplifiée au chapitre complet ; pas de nouvelle interface de relecture par plage. Les fonctions sous-jacentes ne sont pas retirées.
- Référentiel NWT non certifié, stockage local exposé à l'éviction, rétention des copies et cache de deux builds : limites A/B/C inchangées. Ni migration de données ni purge ajoutée.
