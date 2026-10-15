# Lot C — Interface, navigation et PWA

## Périmètre et préservation

Réalisé le 15 octobre 2026 sur `feature/phase-1-5-consolidation`, à partir du lot B `1f24440`. Les documents A/B, les fonctions métier et le contrat du repository ont été examinés avant modification. Aucun changement des modèles, des règles métier, du schéma IndexedDB ou du format de sauvegarde. Aucun déploiement, push, changement du VPS ou des secrets. Le lot D n'est pas commencé.

Sur un stockage neuf uniquement, la démonstration explicitement identifiée est maintenant enregistrée pour permettre la mémorisation des préférences. Un carnet existant n'est jamais remplacé au démarrage. Le passage au carnet personnel et les sauvegardes utilisent toujours les protections du lot B.

## Fonctionnalités et architecture

- `Dashboard` utilise directement `nextUnread` du lot A. « Continuer ma lecture » ouvre le premier segment non lu, même au milieu d'un chapitre troué, avec mise en évidence sans validation. La fin complète a son propre message. La projection utilise le rythme de progression unique et respecte les états « données insuffisantes » et « terminé ».
- `passageNavigation.ts` centralise les URL : `/lecture?livre=1&chapitre=3&verset=9&fin=24`. Livre/chapitre sont obligatoires pour un lien explicite ; verset/fin sont optionnels. Les références hors limites, champs inconnus, paramètres dupliqués et plages inversées sont refusés sans écriture. Une URL explicite prime sur la préférence ; une URL vide reprend le dernier passage consulté ou Genèse 1.
- `Reading` propose livre, chapitre, chapitres précédent/suivant (y compris entre livres), grille repliable et liens directs. La préférence de consultation passe par `ReadingRepository`, avec écritures ordonnées et erreur visible. Elle est distincte de la reprise métier du premier passage non lu. Le dernier verset consulté est mémorisé ; la sélection de travail complète n'est pas une préférence persistante.
- Sélection individuelle, plage et chapitre entier conservés. Les versets lus portent une coche, les sélectionnés un état `aria-pressed` et un contour. Toute validation présente un récapitulatif avec nouveaux versets/relectures/corrections avant confirmation. Le moteur A reste responsable des événements. Après échec, sélection et récapitulatif restent présents ; après réussite, confirmation et remise à zéro de la sélection.
- La correction cible soit la dernière validation active de chaque verset, soit une validation précise. L'interface explique qu'une autre lecture peut maintenir le verset lu et distingue l'audit ancien des corrections modernes. Elle ne fabrique pas d'historique.
- `Statistics` sépare progression unique, activité effective (lectures et relectures), rythme unique et régularité. Recharts est importé uniquement par cette page différée. La liste des jours propose une alternative textuelle au graphique.
- `Settings` conserve `BackupPanel`, ses confirmations et copies préalables, et ajoute les indications d'installation et les limites hors connexion. `Plans` garde le parcours classique et indique que la chronologie reste à venir.
- `App.tsx` se limite à l'assemblage, au chargement via repository, aux préférences et aux routes. `Dashboard`, `Reading`, `Statistics`, `Settings`, `Plans`, `Navigation`, `JwLinks` et `PwaStatus` isolent les responsabilités sans coupler React à IndexedDB.
- Navigation inférieure mobile, latérale tablette/ordinateur, noms accessibles même lorsque les libellés sont masqués. Lien d'évitement, focus du contenu à chaque changement de page, contrôles tactiles, états textuels et réduction des animations. `ui.css` complète le thème violet existant.

## JW Library

Le générateur HTTPS `jwLink` reste centralisé et conserve le format déjà validé sur Android. Le passage sélectionné et le prochain segment non lu ont leur lien. Une sélection discontinue ouvre l'enveloppe continue entre ses extrêmes, ce qui est indiqué dans l'écran. `JwLinks` explique que le navigateur peut rester sur jw.org et propose un lien de secours vers le chapitre dans la bibliothèque en ligne WOL. Aucun mécanisme ne prétend détecter l'installation native ni forcer l'ouverture de l'application. Le fonctionnement iPad n'a pas été validé sur appareil réel.

## PWA et mises à jour

Le manifeste a un identifiant, un périmètre racine, un démarrage autonome et des icônes PNG Android 192/512, maskable 512 et Apple Touch 180. Les PNG proviennent du SVG existant ; aucune dépendance applicative supplémentaire.

`public/sw.js` est un modèle. Le plugin local `scripts/build-pwa.mjs` génère le worker de production après le build Vite : identifiant de build commun au client et au worker, liste exhaustive des ressources HTML/JS/CSS/icônes/manifeste, contrôle de présence des icônes. `dist/pwa-build.json` contient la liste et l'empreinte de diagnostic ; il n'est pas une ressource nécessaire hors connexion. Il faut publier le **dist complet issu du build**, pas copier le worker modèle seul.

L'installation précache toutes les pages, y compris les chunks différés. Un fichier manquant fait échouer l'installation ; le worker actif reste utilisable. Les navigations servent le shell du build actif pour éviter un mélange de versions. Les fichiers précachés sont servis depuis ce cache, les autres requêtes utilisent le réseau. Aucune interception des liens externes JW ou des écritures applicatives.

Une nouvelle version attend une action « Mettre à jour et recharger ». Le message prévient de la perte des sélections **non enregistrées** ; les lectures enregistrées restent dans IndexedDB. Le bouton est désactivé pendant une sauvegarde de lecture. Une activation depuis un autre onglet propose le rechargement au lieu de l'imposer. L'indication « Interface prête hors connexion » vérifie la présence de toutes les ressources du build courant. Les changements de connectivité et les erreurs de recherche sont affichés.

Le nettoyage ne concerne que les caches `bible-tracker-shell-*` et l'ancien cache connu `bible-tracker-v1`. Il garde le build actif et un précédent pour les onglets encore ouverts. **Aucun appel de suppression ou de réinitialisation IndexedDB.** Les bases, les événements et les copies de récupération ne sont pas des caches HTTP. Le texte biblique reste dans JW Library et n'est pas fourni hors connexion par cette PWA.

## Performance

Comparaison avec le build du lot B, mêmes dépendances :

| Ressource | Avant | Après |
| --- | ---: | ---: |
| JavaScript initial | 692,19 ko | 312,54 ko |
| JavaScript initial gzip | 205,35 ko | 100,27 ko |
| Statistiques/Recharts différés | inclus initialement | 378,60 ko (105,29 gzip) |
| Lecture différée | incluse initialement | 10,55 ko (3,92 gzip) |
| Paramètres différés | inclus initialement | 6,55 ko (2,82 gzip) |

Les pages hors Accueil sont chargées avec `React.lazy` et `Suspense`. Le HTML initial ne précharge pas le chunk Statistiques. Réduction du JavaScript initial d'environ 55 % (51 % gzip), aucun chunk au-dessus du seuil d'avertissement Vite de 500 ko. Le volume total JS augmente légèrement avec les fonctionnalités ; le worker télécharge les ressources différées en arrière-plan pour permettre leur utilisation hors connexion. Ces chiffres ne signifient donc pas une réduction équivalente du téléchargement total.

Aucun changement de package ou de lockfile. Les scripts de génération utilisent les modules intégrés Node et Vite déjà présent.

## Vérifications exécutées

Résultats : **132 tests réussis dans 6 fichiers**, TypeScript sans émission réussi, build Vite de production réussi. Les 94 tests A/B passent sans modification des règles métier ni du repository.

Commandes directes utilisées avec les outils installés :

```text
node node_modules/vitest/vitest.mjs run --configLoader runner --no-cache
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/vite/bin/vite.js build --configLoader runner
git diff --check
```

Les 38 tests ajoutés couvrent : navigation et priorité URL/préférence, bornes et références invalides, transitions entre livres, reprise exacte de l'Accueil et Bible terminée, rendu du segment sélectionné sans sauvegarde, noms accessibles ; worker généré, ressources différées, échec d'installation, nettoyage limité, ancienne ressource et statut de cache incomplet ; observateur client, activation explicite, notification inter-onglets, absence de rechargement automatique, connectivité et retrait des écouteurs.

Les tests de composants utilisent le rendu serveur, sans simuler des interactions complètes. Les interactions suivantes ont donc aussi été vérifiées dans le navigateur intégré, avec le build de production sur l'origine isolée `127.0.0.1:5175` et uniquement des données fictives :

1. Reprise de la démonstration en Genèse 3:9–24, 16 versets mis en évidence et progression inchangée ; lien JW exact.
2. Consultation d'Exode 2, passage par Statistiques, retour par la navigation puis rechargement : Exode 2 conservé. URL invalide refusée.
3. Création d'un carnet personnel de test, sélection, récapitulatif et validation d'un verset ; relecture puis correction de cette relecture. Le verset reste lu grâce à la première validation, comme annoncé. Audit et progression présents après rechargement.
4. Second onglet avec un état périmé : refus réel du repository ; sélection et récapitulatif conservés avec message d'erreur. Aucun remplacement silencieux.
5. Nouvelle version locale détectée puis appliquée explicitement : lecture sauvegardée conservée, statut hors connexion prêt, bannière de mise à jour retirée. Ce test a révélé une bannière d'attente périmée, corrigée et couverte par les tests client.
6. Arrêt du serveur de prévisualisation après précache : ouverture des Statistiques du nouveau build puis rechargement réussi, retour à Ma lecture et présence du verset enregistré. Cela teste une origine devenue inaccessible, pas le mode avion physique ; `navigator.onLine` peut rester vrai.
7. Largeurs smartphone 390, tablette 768/1024 et ordinateur 1280 : contrôles des débordements de la page Lecture ; navigation nommée même en mode icônes. Le contrôle responsive n'est pas une validation matérielle Android/iPad.

Les données de production, les bases de l'aperçu initial et celles des essais du lot B n'ont pas été utilisées. Une capture mobile est disponible à côté du dépôt dans les livrables. Le téléchargement physique d'une sauvegarde reste à vérifier manuellement comme indiqué au lot B.

## Protocole Android et iPad

1. Sur une prochaine version déployée **après autorisation**, exporter le carnet existant. Tester de préférence un profil/appareil distinct avec un carnet de test. Ne jamais effacer le stockage pour simuler une mise à jour.
2. Android : ouvrir dans Chrome HTTPS, vérifier les icônes et installer depuis le menu du navigateur. iPad : Safari, Partager, Ajouter à l'écran d'accueil ; vérifier icône, titre et ouverture autonome. Vérifier portrait/paysage et grandes tailles de texte.
3. Attendre « Interface prête hors connexion ». Visiter un passage, changer d'espace puis revenir ; ouvrir une URL directe, le précédent/suivant et une référence invalide. Tester le clavier et le focus, la lisibilité et le toucher.
4. Passer en mode avion, fermer puis rouvrir l'application installée. Vérifier Accueil, Ma lecture, Parcours, Statistiques et Paramètres. Valider un verset de test puis recharger et contrôler progression/historique. L'interface doit fonctionner ; les liens et le texte JW ne sont pas garantis par notre cache.
5. Revenir en ligne. Tester le passage sélectionné et le prochain segment dans JW Library ; vérifier séparément le comportement avec/sans application installée, le retour au carnet et le secours WOL. Consigner le navigateur, l'OS et la version de JW Library ; ne pas extrapoler Android à iPad.
6. Après une version suivante autorisée, ouvrir deux onglets dont un avec sélection non validée. Vérifier la notification, l'avertissement avant rechargement, l'absence de rechargement imposé dans l'autre onglet et la conservation des lectures enregistrées après acceptation.
7. Télécharger réellement une sauvegarde dans Fichiers/Téléchargements, la prévisualiser puis restaurer dans le carnet de test avec confirmation. Vérifier sa copie préalable et son rechargement. Garder la sauvegarde de départ hors du navigateur.

## Limites et risques à transmettre au lot D

- Installation, fermeture complète, mode avion, quotas/éviction du stockage et JW Library sur appareils réels restent à valider. Pas de suite automatisée de navigateur installée dans ce lot.
- Le cache peut être évincé par le système. L'indication de préparation contrôle sa présence au moment de la vérification, pas une garantie permanente. IndexedDB/copies locales ne remplacent pas un export externe.
- Seuls deux builds de cache sont conservés : un très ancien onglet après plusieurs mises à jour peut nécessiter le réseau pour ses chunks. Les sélections non enregistrées ne survivent pas à un rechargement choisi.
- Un déploiement incomplet ou une saturation du cache peut empêcher l'installation du worker suivant. Valider ultérieurement l'atomicité de publication, les en-têtes HTTP, la disponibilité des anciens assets et le rollback dans l'environnement Apache ; aucune modification CI/serveur faite ici.
- Le référentiel numérique hérité n'est toujours pas certifié comme couverture exhaustive NWT : numérotation/omissions à résoudre avec provenance avant de revendiquer cette compatibilité. Aucune omission ou chronologie inventée. Parcours chronologique et synchronisation Supabase restent hors périmètre.
- Les limites de sauvegarde, de rétention des copies et d'historiques anciens du lot B restent applicables. Le lot C ne les masque pas et n'ajoute pas de purge.
