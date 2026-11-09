#!/usr/bin/env bash
set -euo pipefail

(
  export MONGO_APP_PASSWORD="$(cat /run/secrets/mongo_app_password)"
  mongosh --quiet --eval '
    const password = process.env.MONGO_APP_PASSWORD;
    if (!password) throw new Error("Mongo application password is empty");
    db.getSiblingDB("career_sprout").createUser({
      user: "career_sprout",
      pwd: password,
      roles: [{ role: "readWrite", db: "career_sprout" }],
    });
  '
)
