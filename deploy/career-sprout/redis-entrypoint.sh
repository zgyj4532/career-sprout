#!/bin/sh
set -eu

secret_dir=/run/career-sprout-secrets
mkdir -p "$secret_dir"
cp /run/secrets/redis_users_acl "$secret_dir/users.acl"
cp /run/secrets/redis_password "$secret_dir/redis_password"
cp /run/secrets/redis_backup_password "$secret_dir/redis_backup_password"
chown redis:redis "$secret_dir" "$secret_dir"/*
chmod 0500 "$secret_dir"
chmod 0400 "$secret_dir"/*

exec /usr/local/bin/docker-entrypoint.sh "$@"
