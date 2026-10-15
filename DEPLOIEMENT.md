# Déploiement Apache et GitHub Actions

Préparation locale : aucun changement du VPS n’est effectué par l’ajout de ces fichiers. La publication est désactivée tant que la variable GitHub `DEPLOY_ENABLED` n’est pas égale à `true`.

## Fonctionnement

Chaque push sur `main` et chaque pull request lancent les tests et la compilation. Le résultat est conservé 14 jours dans GitHub Actions. Sur `main`, si le déploiement est activé, le job `production` transfère `dist` par SSH/rsync puis vérifie les pages `/` et `/lecture` en HTTPS. L’application n’a besoin ni de Node.js ni de Supabase sur le VPS.

Les assets sont transférés avant l’index et le service worker. Les anciens assets sont conservés pour les onglets ouverts. Ce transfert n’est pas une bascule atomique de release et n’inclut pas de rollback automatique. Pour revenir à une version précédente, rétablir le commit dans Git puis pousser ; les données IndexedDB du navigateur ne sont pas touchées. Un nettoyage périodique des vieux assets pourra être ajouté après validation de la production.

## À recueillir avant installation

- Adresse, port et utilisateur SSH du VPS ; méthode d’accès disponible.
- Dossier dédié au site et VirtualHost Apache existant éventuel.
- DNS de `lecture.jsdev.fr` et état du certificat HTTPS.

Configuration confirmée : `debian@jsdev.fr`, dossier `/var/www/bible-tracker`, HTTPS déjà configuré. Ces valeurs sont les valeurs par défaut du workflow (port 22 supposé). Les variables ci-dessous permettent de les remplacer. L’accès SSH et le VirtualHost n’ont pas encore pu être inspectés : l’empreinte ED25519 du serveur doit d’abord être vérifiée.

## Préparation du VPS à adapter à l’existant

Prévoir un utilisateur de déploiement non root qui peut écrire uniquement dans le dossier du site, sans sudo pour le workflow. Le VPS doit disposer de rsync. Créer une paire de clés SSH dédiée à GitHub Actions : clé publique dans `authorized_keys` de cet utilisateur ; clé privée uniquement dans GitHub Secrets. Ne pas partager cette clé dans le chat ni la committer. Désactiver le transfert de ports et d’agent pour cette clé, par exemple avec l’option `restrict` dans `authorized_keys` ; conserver l’exécution des commandes pour rsync.

Le VirtualHost existant doit pointer son `DocumentRoot` vers le dossier choisi. Autoriser `AllowOverride FileInfo Indexes Options` pour que le `.htaccess` livré soit appliqué. Activer `mod_rewrite` pour les routes React et `mod_headers` pour les règles de cache. Tester la configuration avec `apachectl configtest` avant tout rechargement. Adapter l’existant plutôt que créer un VirtualHost concurrent. HTTPS est nécessaire pour la PWA.

## Configuration GitHub

Dans le dépôt, créer un environnement `production`, puis ajouter ses variables :

| Variable | Valeur |
| --- | --- |
| `DEPLOY_HOST` | Nom DNS ou IPv4 du VPS |
| `DEPLOY_USER` | Utilisateur de déploiement |
| `DEPLOY_PORT` | Port SSH, généralement 22 |
| `DEPLOY_PATH` | Dossier absolu dédié, sans espaces ni point |

Secrets de l’environnement `production` :

| Secret | Contenu |
| --- | --- |
| `DEPLOY_SSH_KEY` | Clé privée SSH dédiée, sans passphrase |
| `DEPLOY_KNOWN_HOSTS` | Ligne(s) known_hosts du VPS, vérifiées hors connexion |

Vérifier l’empreinte de la clé hôte avec la console du fournisseur ou un canal SSH déjà fiable. `ssh-keyscan` seul ne prouve pas l’identité du serveur. Pour un port différent de 22, la ligne known_hosts doit utiliser `[hôte]:port`.

Enfin, ajouter la **variable du dépôt** `DEPLOY_ENABLED=true` pour activer la publication. Le workflow utilise ce réglage avant l’accès à l’environnement ; il ne faut donc pas le définir uniquement dans `production`. Lancer ensuite manuellement « Vérifier et déployer » depuis l’onglet Actions, ou pousser sur `main`.

## Validation après la première publication

Vérifier le certificat, l’accès direct à `/lecture` et `/statistiques`, le chargement des assets, le service worker et la persistance locale. Un échec de la vérification HTTP après transfert ne restaure pas automatiquement la version précédente. Le cache du navigateur peut conserver une version précédente hors ligne.

Références : [syntaxe GitHub Actions](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax), [secrets GitHub](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets), [règles Apache](https://httpd.apache.org/docs/2.4/mod/mod_rewrite.html).
