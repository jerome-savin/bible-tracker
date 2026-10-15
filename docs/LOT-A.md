# Phase 1.5 — Lot A : consolidation métier

## Périmètre et état initial

Branche : `feature/phase-1-5-consolidation`. Le dépôt était propre, avec le commit local `775a110` de diagnostic SSH non poussé. La vérification distante a confirmé `origin/main` à `fbc9d8e0c688767719ce6eb0ae17e8bbcde7c90b`. Les 9 tests de départ ont été relancés avec succès avant modification. Aucun push ni déploiement n'est effectué pour ce lot.

Ce lot modifie seulement les modèles, calculs métier, validation des références et tests. Il ne migre pas IndexedDB, n'ajoute pas Supabase, ne refond pas les écrans, ne touche pas la CI ni les secrets. Le README historique sera actualisé au lot D.

## Événements et corrections

Les nouveaux événements portent `modelVersion: 2`, un UUID, l'utilisateur local stable et une date ISO UTC. Les types sont `lecture`, `relecture`, `correction`. Une sélection mixte produit un événement de nouvelle lecture et un de relecture : l'activité est mesurée en versets, pas en nombre de clics ou de séances.

Une correction désigne les UUID des validations et les versets à neutraliser. `correctValidation` permet l'annulation précise d'une validation ou relecture. Aucun événement d'audit n'est effacé. Une correction répétée ne retire rien de plus ; elle ne crée pas d'activité. La progression est l'union des validations encore actives. Annuler une validation ne supprime pas les autres preuves de lecture.

Pour garder l'ancien écran compilable, `record(..., 'correction')` accepte toujours les versets à conserver. Pour chaque verset retiré, il annule la validation active la plus récente (date ISO, puis UUID en cas d'égalité). Une autre validation peut donc maintenir le verset lu. L'interface de choix d'une validation précise et ses explications relèvent du lot C.

Les annulations v2 sont appliquées après collecte des lectures, indépendamment de leur position dans le tableau. Une correction dont la cible manque temporairement reste dans l'audit et prendra effet lorsque sa cible sera disponible. Les annulations concurrentes se combinent par union ; aucune restauration implicite n'est prévue : une nouvelle lecture crée un nouvel événement. Le transport, la déduplication d'un flux multiappareils, les versions concurrentes d'un même UUID et la fusion d'identités restent à définir et implémenter au lot B/phase 2.

## Compatibilité historique sans migration physique

Les événements phase 1 sont lus dans leur ordre existant. Leurs corrections sont interprétées selon leur ancienne sémantique : instantanés de versets conservés. La partie relue de leurs validations est reconnue pour l'attribution statistique sans réécrire les événements enregistrés.

L'état phase 1 pouvait contenir de la progression sans preuve événementielle, notamment la démonstration. Cette progression est préservée comme socle hérité non daté et ne génère aucune activité ni vitesse inventée. Au premier événement v2, `legacyContext.progress` conserve un instantané de référence immuable ; les modifications suivantes dérivent la progression des contributions effectives. Ce champ est un pont de compatibilité métier, pas une migration de schéma de sauvegarde ou d'IndexedDB. Les migrations et leur récupération restent au lot B.

## Statistiques

- `verses` : nombre de versets distincts actuellement couverts.
- `activityVerses` : volume effectif sur les 30 jours calendaires, nouvelles lectures et relectures, après annulation partielle ou totale des erreurs.
- `uniqueVerses30` : nouveaux versets attribués à la première contribution effective, hors socle non daté et hors relectures.
- `pace` : rythme unique par jour calendaire d'observation, sur au plus 30 jours.
- `activityPace` : rythme d'activité totale, séparé du rythme unique.
- `days7`, `days30` : jours locaux comportant au moins un verset effectivement lu. Un jour de correction seul n'est pas actif.

La projection exige provisoirement au moins 7 jours calendaires d'observation et 2 jours avec de la progression unique dans la fenêtre. Ce seuil est un choix produit prudent, pas un intervalle statistique de confiance. Sans données suffisantes, `finish=null` et `projectionStatus='données insuffisantes'`. La Bible terminée renvoie `projectionStatus='terminée'`, sans date future. Les relectures ne sont jamais transformées en nouvelle progression après annulation de leur première lecture.

## Prochaine lecture

`nextUnread` parcourt les références dans l'ordre biblique, retourne le premier verset non lu et le segment continu restant jusqu'au prochain verset déjà lu. Il fonctionne même avec une lecture hors ordre et retourne `null` si tout est terminé. Aucun parcours chronologique n'est inventé.

Le branchement de ce résultat au bouton de l'Accueil, aux paramètres URL et à la sélection initiale appartient au lot C et n'est pas fait ici. De même, les anciens libellés des statistiques et de l'historique doivent être adaptés au modèle v2 dans ce lot C avant diffusion de cette branche aux utilisateurs : le rendu actuel ne distingue pas encore correctement la nouvelle relecture et décrit encore le rythme comme incluant les relectures. Cette branche n'est pas à déployer en l'état comme consolidation complète.

## Référentiel : audit réalisé et limites

Source exacte : https://github.com/bkuhl/bible-verse-counts-per-chapter/blob/996e993487e713431865e6433c42f6d84f6580de/bible.json

Le 15 octobre 2026, les 1 189 longueurs de chapitre du fichier local ont été comparées à cette source figée : correspondance exacte. Empreinte Git blob recalculée : `2cbb2c0e2a00db458bf3af8636a725a65c8cc3fe`, identique à la provenance enregistrée. Les 66 livres ont des identifiants consécutifs ; les nombres de chapitres de chaque livre sont contrôlés individuellement par les tests. Total inchangé : 31 102 positions numériques.

Constats ponctuels dans les pages officielles de l'édition d'étude française :

- [3 Jean 1](https://www.jw.org/fr/biblioth%C3%A8que/bible/bible-d-etude/livres/3-jean/1/) : borne 14, conforme au référentiel actuel. Ce chapitre ne constitue donc pas une divergence démontrée dans cette édition.
- [Matthieu 17](https://www.jw.org/fr/biblioth%C3%A8que/bible/bible-d-etude/livres/matthieu/17/) : borne 27, mais le numéro 21 est un emplacement sans texte courant (tirets). Une borne numérique n'est pas un inventaire des versets lisibles.

La validation complète NWT n'est **pas acquise** : aucun inventaire exhaustif des numéros omis ou des divergences n'a été constitué. Aucun texte biblique n'est intégré ni enregistré. Les nombres actuels sont conservés pour ne pas modifier silencieusement les progressions existantes. Il reste à décider si les emplacements omis doivent être exclus de la cible, puis établir un référentiel numérique d'édition et une migration de progression adaptée. Les 31 102 positions ne doivent pas être présentées comme un total NWT certifié. Les conditions de réutilisation de la source restent à éclaircir avant toute redistribution supplémentaire du jeu de données.

`validatePassage` et `jwLink` rejettent désormais livre, chapitre, verset ou plage inexistant dans le référentiel actuel, y compris un faux maximum fourni par l'appelant. Cela n'interdit pas encore une position omise dans la NWT mais présente dans cette numérotation, comme Matthieu 17:21.

## Vérification du lot

Les tests ajoutés couvrent lectures inédites, relectures et sélections mixtes, corrections ciblées et partielles, couverture par une autre validation, idempotence et ordre des corrections, activité sans faux jour de lecture, projection insuffisante ou excluant les relectures, ordre inhabituel, premier trou, fin de Bible, compatibilité des anciens événements, socle sans historique et références JW. Les bornes et l'encodage JW sont parcourus pour les 1 189 chapitres.

Les tests d'import/export, migration physique IndexedDB et persistance réelle sont volontairement reportés au lot B. Le contrôle Android/iPad et le branchement des écrans appartiennent au lot C. Aucun test d'appareil réel ni déploiement n'est revendiqué pour ce lot.

Résultats du 15 octobre 2026 : **50 tests réussis** dans 2 fichiers (9 initiaux + 41 nouveaux), contrôle TypeScript sans émission réussi, compilation Vite de production réussie. `git diff --check` ne relève aucune erreur d'espacement. Build : 675,45 ko de JavaScript, 200,04 ko gzip ; avertissement de chunk supérieur à 500 ko conservé, sans modification de découpage dans ce lot.
