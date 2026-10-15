# Phase 1.5 — Lot B : sauvegarde et stockage

## Périmètre et inspection initiale

Travail réalisé sur `feature/phase-1-5-consolidation`, à partir de `d50b359`. Le dépôt était propre et les 50 tests du lot A ont été relancés avec succès avant modification. `docs/LOT-A.md`, les modèles, la logique métier, le stockage et l'ancien bouton d'export ont été examinés.

Les exports de phase 1 sont des objets `ReadingState` bruts produits par `JSON.stringify(state, null, 2)`, sans enveloppe, préférences ni date d'export. Aucun fichier réel de sauvegarde utilisateur n'a été fourni : les tests utilisent des exemples construits selon le code d'origine. Les exports bruts du lot A ont le même `schemaVersion: 1`, mais peuvent contenir `legacyContext`, des événements `modelVersion: 2`, des relectures et des annulations ciblées. Les versions du document de sauvegarde, du carnet et du stockage sont volontairement distinctes.

Seul le lot B est implémenté. Pas de Supabase, authentification, modification Apache, secrets GitHub, CI/CD, push ni déploiement. La page Paramètres reçoit seulement le panneau fonctionnel de sauvegarde ; les extractions Dashboard/Statistics/Settings/Navigation, la reprise de lecture et la PWA restent au lot C.

## Ancien stockage — IndexedDB version 1

Base : `bible-tracker`. Un object store `state`, clé `current`, contenait tout le carnet :

- `schemaVersion: 1`, UUID de l'utilisateur, indicateur de démonstration ;
- dictionnaire de progression `livre:chapitre -> versets` ;
- tableau complet d'événements, dans l'ordre de l'audit ;
- contexte historique facultatif ajouté au lot A.

Chaque lecture réécrivait l'intégralité de cet objet et de son historique.

## Nouveau stockage — IndexedDB version 2

| Object store | Clé | Contenu |
| --- | --- | --- |
| `state` | `current` | Original phase 1 conservé intact ; jamais réécrit par le nouvel adaptateur. |
| `metadata` | `current` | `storageVersion: 2`, UUID du jeu actif, révision locale, identité, démonstration, progression en cache et contexte historique ; aucun tableau d'événements. |
| `events` | `[datasetId, id]` | Un événement par ligne avec UUID original, `sequence` d'audit et index `datasetId`. |
| `preferences` | `datasetId` | Préférences du jeu : parcours classique et dernier passage facultatifs. |
| `recoveries` | UUID de copie | Sauvegarde complète, date et motif : migration, restauration ou passage d'une démonstration à un carnet personnel. |

`datasetId` est un identifiant technique local de jeu de données ; il ne remplace ni l'identité utilisateur ni les UUID des événements. Une restauration crée un nouveau jeu puis change le pointeur actif. Les anciens jeux ne sont pas supprimés. Deux jeux peuvent donc contenir les mêmes UUID sans constituer des doublons dans un carnet actif.

## Migration et gestion des interruptions

1. `onupgradeneeded` crée les stores et l'index nécessaires, sans supprimer ni transformer `state/current`.
2. Une transaction `readwrite` vérifie l'absence de `metadata/current`.
3. Si un original existe, il est strictement validé. Les UUID, dates, références et événements doivent être exploitables ; aucune donnée invalide n'est filtrée silencieusement.
4. La transaction crée une copie de récupération, les lignes d'événements dans leur ordre d'origine, les préférences vides et les métadonnées actives.
5. Le succès n'est annoncé qu'après `transaction.oncomplete`.

Le pointeur actif protège explicitement contre une répétition de la migration. Si l'upgrade structurel a réussi mais que la copie échoue ensuite (quota, interruption, erreur de données), la base peut déjà être en version 2, mais aucun pointeur ni copie partielle n'est conservé : l'original reste dans `state/current`, et la prochaine ouverture réessaie. Les tests simulent précisément ce cas.

Une ancienne base contenant des doublons ou des références invalides est laissée intacte et l'ouverture échoue avec un message explicite. Il faut alors récupérer la valeur d'origine depuis l'inspecteur IndexedDB avant une réparation accompagnée ; **ne pas effacer la base**. Les données invalides ne sont pas automatiquement corrigées ou présentées comme migrées.

Les connexions du nouvel adaptateur sont fermées après chaque opération et réagissent à `versionchange`. Si un ancien onglet empêche l'upgrade, l'utilisateur est invité à fermer les autres onglets. Les erreurs de requête, exceptions synchrones et abandons de transaction annulent aussi les écritures déjà effectuées dans la transaction.

## Repository et préparation à la synchronisation

Le contrat `ReadingRepository` expose :

- `load`, `save` : chargement et adaptateur compatible avec l'écran existant ;
- `appendEvents`, `readEvents` : ajout incrémental et lecture de l'audit ;
- `reconstructProgress` : calcul de progression à partir des contributions effectives et du socle historique ;
- `loadPreferences`, `savePreferences` ;
- `exportBackup`, `previewImport`, `restore`, `listRecoveries`.

Les composants utilisent le contrat. Le choix IndexedDB se fait uniquement au point de composition `services/readingRepository.ts`. Aucun détail de store ou transaction n'est exposé aux composants React.

Une sauvegarde ordinaire ajoute seulement les nouveaux événements avec `add`, puis actualise les petites métadonnées ; les lignes d'audit existantes ne sont jamais réécrites. La progression est recalculée avant validation finale. Un UUID existant avec exactement le même événement est accepté comme nouvel envoi idempotent ; un contenu différent provoque un conflit explicite. Un lot contenant deux fois le même UUID est rejeté. Une sauvegarde provenant d'un écran périmé, qui omet ou modifie des événements déjà enregistrés, est refusée.

L'ordre des anciens événements est préservé par `sequence` : il porte leur ancienne sémantique de correction instantanée. Les corrections du lot A ciblent des UUID et s'appliquent sans dépendre de l'ordre du tableau ; les annulations se combinent comme décrit dans LOT-A. L'import d'une sauvegarde complète exige néanmoins que toutes les cibles soient présentes. La réception de flux partiels, les horloges divergentes, la fusion multiappareils et le changement d'identité authentifiée restent des sujets de phase 2. La révision stockée est locale, pas un protocole de synchronisation.

## Format JSON de sauvegarde

Le document version 2 est une enveloppe autonome. Exemple de carnet vide :

```json
{
  "format": "bible-tracker-backup",
  "version": 2,
  "exportedAt": "2026-10-15T12:00:00.000Z",
  "reference": "bkuhl-2cbb2c0e2a00db458bf3af8636a725a65c8cc3fe",
  "state": {
    "schemaVersion": 1,
    "userId": "00000000-0000-4000-8000-000000000001",
    "demo": false,
    "progress": {},
    "events": []
  },
  "preferences": { "activePlan": "canonical" }
}
```

Un carnet non vide contient tous les événements, y compris ceux neutralisés, les corrections ciblées, les relectures, la progression et `legacyContext` lorsqu'il existe. L'identité importée et les horodatages d'origine sont conservés. `lastPassage` peut contenir `bookId`, `chapter` et un `verse` facultatif ; l'interface de reprise reste à brancher au lot C.

La validation refuse : format ou version inconnue, champs requis absents ou inconnus, UUID invalides ou dupliqués (même si seule la casse diffère), utilisateur incohérent, dates impossibles, références inexistantes dans le référentiel actuel, versets dupliqués, cibles de correction absentes/incompatibles et cache de progression incompatible avec les événements v2. Les dates supportées sont le format UTC canonique `YYYY-MM-DDTHH:mm:ss.sssZ` produit depuis la phase 1. Un ISO avec décalage horaire, bien que valide en général, n'est pas un export pris en charge ici et n'est pas converti silencieusement.

La taille de fichier est limitée à 10 Mo et l'historique à 100 000 événements. Le téléchargement utilise le même validateur et refuse un fichier dépassant la limite plutôt que de produire un export que l'application ne pourrait pas restaurer. Ces limites devront être réévaluées avant un usage de longue durée ou des imports externes volumineux.

### Compatibilité et migrations futures

- Export phase 1 brut : accepté si tous les champs d'origine obligatoires existent ; `preferences` devient un objet vide, sans inventer de préférence utilisateur.
- Export brut du lot A : accepté avec son contexte et ses types d'événements récents.
- Sauvegarde version 2 : acceptée et restaurable sans perte des champs pris en charge.
- Version future : refusée avant toute écriture, jusqu'à ajout d'une conversion explicite et de ses tests.

Une progression sans événement justificatif reste un socle hérité non daté. L'aperçu le signale ; aucun événement n'est fabriqué pour le combler. Les anciennes corrections ne permettent pas de retrouver les UUID qu'elles auraient dû cibler : l'avertissement explique cette limite et le snapshot historique est conservé. Les 31 102 positions du référentiel restent non certifiées comme total NWT, conformément au lot A.

## Restauration et récupération

La sélection d'un fichier ne fait que le lire et le valider. Un aperçu montre le type de carnet, son identité, la progression, les nombres d'événements par type et les avertissements. Il faut cocher une confirmation et cliquer sur le bouton distinct de restauration. Annuler ou choisir un autre fichier réinitialise la confirmation.

L'utilisateur peut télécharger le carnet courant avant de confirmer. Au remplacement, le repository relit l'état courant dans une transaction et vérifie qu'il correspond à celui observé lors de l'aperçu. S'il a changé, la restauration est refusée. Il sauvegarde ensuite automatiquement le carnet enregistré et ses préférences dans `recoveries` avant d'insérer le nouveau jeu et de changer le pointeur actif. Si la copie préalable ou une écriture suivante échoue, **toute la transaction est annulée**. Sur une base réellement vierge, il n'y a aucun carnet antérieur enregistré à copier.

Les copies sont proposées au téléchargement dans Paramètres après rechargement. Pour revenir en arrière, télécharger la copie, la sélectionner comme un import normal puis confirmer sa restauration. Les préférences modifiées après la prévisualisation font partie de la copie préalable prise au moment du remplacement. Aucune restauration automatique ni purge des copies n'est implémentée.

### Limite du retour à une ancienne version de l'application

Le stockage conserve l'original et les copies, mais l'upgrade de numéro IndexedDB ne peut pas être annulé en réinstallant simplement le code phase 1 : celui-ci ouvre la base en version 1 et recevrait une `VersionError`. La récupération supportée utilise cette version de l'application et un import confirmé. Toute future migration devra conserver une voie de lecture/récupération et avoir ses propres tests ; ne jamais conseiller une suppression de base pour résoudre une erreur d'upgrade.

## Tests et vérifications

La dépendance de développement `fake-indexeddb` 6.2.5 simule les API et transactions IndexedDB pour les tests, sans accéder à la base réelle du navigateur. Elle n'entre pas dans le paquet de production. L'installation pnpm locale a rencontré des erreurs réseau et une vérification de miroir hors ligne sans métadonnées ; le paquet officiel sans dépendances transitives a été récupéré directement depuis le registre npm et son SHA-512 vérifié, puis inscrit avec cette intégrité dans le lockfile. Aucun contrôle CI distant n'a été lancé et aucune installation complète depuis un cache vierge n'est revendiquée.

Tests ajoutés : aller-retour de sauvegarde et de restauration, ancien format avec/sans historique, lot A, refus JSON/versions/champs/dates/références, doublons UUID, corrections et relectures, migration v1, migration des données du lot A, réouverture idempotente, copie originale inchangée, interruption et reprise, ancien onglet bloquant puis fermé, écriture incrémentale, nouvel envoi idempotent, conflit UUID, erreur synchrone et erreur IndexedDB asynchrone, concurrence entre onglets, confirmation, copie avant remplacement, quota simulé sur la copie ou le nouveau jeu, restauration d'une copie et conservation des préférences.

Un test navigateur local a utilisé une origine distincte (`127.0.0.1:5174`) et des données fictives : refus d'un JSON invalide, aperçu sans remplacement, confirmation désactivée avant coche, restauration, rechargement puis présence de la copie préalable. Le stockage de production et celui de l'aperçu initial n'ont pas été utilisés pour ces essais.

Résultats finaux du 15 octobre 2026 : **94 tests réussis dans 3 fichiers** (50 du lot A + 44 du lot B), contrôle TypeScript sans émission réussi, compilation Vite de production réussie. Le build contient 692,19 ko de JavaScript (205,35 ko gzip), avec l'avertissement de chunk supérieur à 500 ko déjà connu. `git diff --check` ne signale aucune erreur d'espacement.

L'automatisation du téléchargement via l'événement `download` du navigateur intégré a expiré sans résultat exploitable : l'enregistrement du fichier sur disque n'est donc pas revendiqué comme vérifié. La sérialisation, la réimportation sans perte et la restauration des copies sont testées automatiquement ; leur présence après rechargement et les commandes de téléchargement ont été vérifiées dans l'interface. Un essai manuel du téléchargement dans un navigateur utilisateur reste nécessaire.

## Risques résiduels et lot C

- IndexedDB et ses copies restent sur le même appareil : ils ne protègent pas contre l'effacement du navigateur, sa désinstallation ou une panne matérielle. Télécharger régulièrement une copie externe.
- Originaux, anciens jeux et copies sont conservés sans purge ; le stockage peut croître. Une politique de rétention ne devra pas supprimer de sauvegarde sans choix explicite et possibilité d'export.
- Le repository lit encore l'historique complet pour valider et recalculer ; les écritures sont incrémentales, mais l'usage mémoire et les calculs ne sont pas paginés.
- Les anomalies d'anciennes données bloquent volontairement la migration automatique ; une réparation assistée devra conserver le brut. Pas de validation NWT supplémentaire dans ce lot.
- Les interruptions sont simulées au niveau transactionnel, pas par coupure physique d'un appareil. Aucune validation Android/iPad réelle n'est revendiquée.
- Les copies JSON sont en clair et contiennent l'historique personnel ; aucun chiffrement n'est ajouté.
- Le comportement de sauvegarde de l'ancien écran peut encore effacer sa sélection après un échec, et ses libellés de relecture/statistiques restent à adapter au lot C.
- Au lot C : brancher les préférences de dernier passage, expliquer les corrections ciblées, afficher séparément activité et rythme unique, finaliser les composants et l'accessibilité, tester les parcours de restauration sur appareils réels et traiter la PWA. Ne pas déployer cette branche comme consolidation complète avant cette intégration.
