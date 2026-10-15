#!/usr/bin/env bash
set -euo pipefail

: "${DEPLOY_HOST:?Adresse SSH manquante}"
: "${DEPLOY_USER:?Utilisateur SSH manquant}"
: "${DEPLOY_PATH:?Dossier de destination manquant}"
: "${DEPLOY_SSH_KEY:?Clé SSH manquante}"
: "${DEPLOY_KNOWN_HOSTS:?Empreinte SSH vérifiée manquante}"
DEPLOY_PORT="${DEPLOY_PORT:-22}"

# Les valeurs traversent SSH : limiter explicitement leur syntaxe.
[[ "$DEPLOY_HOST" =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]*$ ]] || { echo 'Hôte SSH invalide'; exit 1; }
[[ "$DEPLOY_USER" =~ ^[a-z_][a-z0-9_-]*$ ]] || { echo 'Utilisateur SSH invalide'; exit 1; }
[[ "$DEPLOY_PORT" =~ ^[0-9]{1,5}$ ]] && ((10#$DEPLOY_PORT >= 1 && 10#$DEPLOY_PORT <= 65535)) || { echo 'Port invalide'; exit 1; }
[[ "$DEPLOY_PATH" =~ ^/[a-zA-Z0-9/_-]+$ && "$DEPLOY_PATH" != / ]] || { echo 'Dossier absolu simple requis'; exit 1; }
[[ -f dist/index.html && -f dist/sw.js && -f dist/.htaccess ]] || { echo 'Build incomplet'; exit 1; }

ssh_dir=$(mktemp -d)
trap 'rm -rf -- "$ssh_dir"' EXIT
chmod 700 "$ssh_dir"
printf '%s\n' "$DEPLOY_SSH_KEY" > "$ssh_dir/key"
printf '%s\n' "$DEPLOY_KNOWN_HOSTS" > "$ssh_dir/known_hosts"
chmod 600 "$ssh_dir/key" "$ssh_dir/known_hosts"
export RSYNC_RSH="ssh -i $ssh_dir/key -p $DEPLOY_PORT -o BatchMode=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=$ssh_dir/known_hosts"

# Le dossier doit être créé et autorisé lors de la préparation du VPS.
ssh -i "$ssh_dir/key" -p "$DEPLOY_PORT" -o BatchMode=yes -o StrictHostKeyChecking=yes -o "UserKnownHostsFile=$ssh_dir/known_hosts" "$DEPLOY_USER@$DEPLOY_HOST" "test -d '$DEPLOY_PATH' && test -w '$DEPLOY_PATH'"

# Publier les fichiers hachés avant l’index. Conserver les anciens assets pour
# les onglets encore ouverts ; aucune suppression distante n’est effectuée.
rsync -rltz --chmod=D755,F644 --exclude=index.html --exclude=sw.js dist/ "$DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_PATH/"
rsync -rltz --chmod=D755,F644 dist/index.html "$DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_PATH/"
rsync -rltz --chmod=D755,F644 dist/sw.js "$DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_PATH/"
