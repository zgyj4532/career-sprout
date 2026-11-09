#!/bin/sh
set -eu
mkdir -p /var/cache/career-sprout/assets
cp -nR /usr/share/nginx/html/career-sprout/assets/. /var/cache/career-sprout/assets/
