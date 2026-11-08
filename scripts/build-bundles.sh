#!/usr/bin/env bash
# Builds the app bundles from their pinned upstream tags into artifacts/.
#
# The bundles are never kept in git: the deploy fetches them from the build artifacts by tag and
# checksum. Each build keeps the upstream licence and attribution files with the bundle.
#
# Usage: scripts/build-bundles.sh [photocraft|lightcraft|all]
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENDOR="$ROOT/vendor"
ARTIFACTS="$ROOT/artifacts"
PHOTOCRAFT_TAG="v0.21.0"
LIGHTCRAFT_TAG="v0.19.0"
CRAFT_FONTS_REF="b076417b5880bd4154bd22f00695b1d28c6bea83"
WHICH="${1:-all}"

keep_docs() {
  local from="$1" to="$2" f
  for f in README.md LICENSE LICENSE-MIT LICENSE-APACHE NOTICE ATTRIBUTION.md COPYRIGHT; do
    [ -f "$from/$f" ] && cp "$from/$f" "$to/$f" || true
  done
}

build_photocraft() {
  echo "== PhotoCraft $PHOTOCRAFT_TAG"
  cd "$VENDOR/photocraft"
  PHOTOCRAFT_BUILD_SHA="$(git rev-parse HEAD)" ./packaging/web/package.sh
  rm -rf "$ARTIFACTS/photo"
  mkdir -p "$ARTIFACTS/photo"
  rm -rf "$VENDOR/photocraft/unpacked"
  mkdir -p "$VENDOR/photocraft/unpacked"
  unzip -q dist/release/photocraft-web-*.zip -d "$VENDOR/photocraft/unpacked"
  cp -R "$VENDOR/photocraft/unpacked"/photocraft-web-*/. "$ARTIFACTS/photo/"
  # Upstream's web package puts snippets/ at the root while app/photocraft-web.js imports ./snippets/… from app/, so the
  # app never starts (404s; upstream issues #10017/#10248). Measured fix from the Studio due diligence: a copy in app/.
  if [ -d "$ARTIFACTS/photo/snippets" ] && [ -d "$ARTIFACTS/photo/app" ] && [ ! -d "$ARTIFACTS/photo/app/snippets" ]; then
    cp -R "$ARTIFACTS/photo/snippets" "$ARTIFACTS/photo/app/snippets"
  fi
  keep_docs "$VENDOR/photocraft" "$ARTIFACTS/photo"
}

build_lightcraft() {
  echo "== LightCraft $LIGHTCRAFT_TAG"
  cd "$VENDOR/lightcraft"
  cargo xtask web
  rm -rf "$ARTIFACTS/light"
  mkdir -p "$ARTIFACTS/light"
  cp -R target/web-site/. "$ARTIFACTS/light/"
  keep_docs "$VENDOR/lightcraft" "$ARTIFACTS/light"
  # The module embeds two OFL fonts (the UI face and the Thai face); their licences travel with it.
  for family in biz-ud-pgothic noto-sans-thai; do
    url="https://raw.githubusercontent.com/storytold/craft-fonts/$CRAFT_FONTS_REF/fonts/$family/OFL.txt"
    if curl -fsSL "$url" -o "$ARTIFACTS/light/OFL-$family.txt"; then
      echo "   licence: OFL-$family.txt"
    else
      rm -f "$ARTIFACTS/light/OFL-$family.txt"
      echo "   warning: could not fetch the licence of $family" >&2
    fi
  done
}

case "$WHICH" in
  photocraft) build_photocraft ;;
  lightcraft) build_lightcraft ;;
  all) build_photocraft; build_lightcraft ;;
  *) echo "usage: $0 [photocraft|lightcraft|all]" >&2; exit 2 ;;
esac

mkdir -p "$ARTIFACTS"
( cd "$ARTIFACTS" && find . -type f -print0 | sort -z | xargs -0 sha256sum > "$ARTIFACTS/bundles.sha256" )
echo "wrote $ARTIFACTS/bundles.sha256"
