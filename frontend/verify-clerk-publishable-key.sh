#!/bin/sh
set -eu
expected=${CLERK_PUBLISHABLE_KEY:?CLERK_PUBLISHABLE_KEY is required at runtime}
actual=$(cat /etc/career-sprout/clerk-publishable-key)
if [ "$expected" != "$actual" ]; then
  echo 'Runtime Clerk key does not match the key embedded in this frontend image.' >&2
  exit 1
fi
