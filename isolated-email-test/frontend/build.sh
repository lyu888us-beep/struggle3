#!/bin/sh
# Build the existing customer frontend, then copy only its generated assets to
# this separate Pages project's output directory.
set -eu
cd "$(dirname "$0")"
ROOT="$(pwd)"
cd '../../蓉渝康养行_顾客端_Cloudflare部署包/frontend'
npm ci
npm run build
mkdir -p "$ROOT/public"
cp -R public/. "$ROOT/public/"
