#!/usr/bin/env bash
# Fetches the built app bundles from the GitHub release and unpacks them into the bundle root.
#
# The release is public: the host needs no GitHub account and no token, only curl.
# The tarball is checked against SHA256SUMS before anything is unpacked, and the unpack is atomic:
# the new tree is built next to the old one and the link is swapped in one step.
#
# Usage: scripts/fetch-bundles.sh [release-name]
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO="${OV_STUDIO_REPO:-OpenVibers/OpenVibe.Studio}"
BUNDLE_ROOT="${STUDIO_BUNDLE_ROOT:-$ROOT/public/apps}"
PHOTO_TAG="${PHOTO_TAG:-$(node -e "process.stdout.write(require('$ROOT/server/adapters/photo').base.tag)")}"
LIGHT_TAG="${LIGHT_TAG:-$(node -e "process.stdout.write(require('$ROOT/server/adapters/light').base.tag)")}"
RELEASE="${1:-bundles-$PHOTO_TAG-$LIGHT_TAG}"
TARBALL="studio-bundles-$PHOTO_TAG-$LIGHT_TAG.tar.gz"
BASE="${OV_STUDIO_RELEASE_BASE:-https://github.com/$REPO/releases/download/$RELEASE}"

command -v curl >/dev/null || { echo "error: curl is required" >&2; exit 1; }
command -v sha256sum >/dev/null || { echo "error: sha256sum is required" >&2; exit 1; }

WORK="$(mktemp -d "${TMPDIR:-/tmp}/studio-bundles.XXXXXX")"
cleanup() { rm -rf "$WORK"; }
trap cleanup EXIT

echo "fetching $RELEASE from $REPO"
curl -fsSL -o "$WORK/$TARBALL" "$BASE/$TARBALL"
curl -fsSL -o "$WORK/SHA256SUMS" "$BASE/SHA256SUMS"
( cd "$WORK" && sha256sum -c SHA256SUMS )

rm -rf "$WORK/unpacked"
mkdir -p "$WORK/unpacked"
tar -xzf "$WORK/$TARBALL" -C "$WORK/unpacked"
for app in photo light; do
  [ -f "$WORK/unpacked/$app/index.html" ] || { echo "error: the release has no $app/index.html" >&2; exit 1; }
done

# The bundle root is a link to a versioned tree, so the swap is one step and never half done.
PARENT="$(dirname "$BUNDLE_ROOT")"
NAME="$(basename "$BUNDLE_ROOT")"
mkdir -p "$PARENT/versions"
TARGET="$PARENT/versions/$RELEASE"
rm -rf "$TARGET"
mv "$WORK/unpacked" "$TARGET"
if [ -e "$BUNDLE_ROOT" ] && [ ! -L "$BUNDLE_ROOT" ]; then
  mv "$BUNDLE_ROOT" "$PARENT/versions/previous-$(date +%s)"
fi
ln -sfn "$TARGET" "$PARENT/.$NAME.tmp"
mv -T "$PARENT/.$NAME.tmp" "$BUNDLE_ROOT"
find "$PARENT/versions" -maxdepth 1 -mindepth 1 -type d ! -name "$RELEASE" -mtime +14 -exec rm -rf {} + 2>/dev/null || true

echo "the bundles of $RELEASE are in place at $BUNDLE_ROOT"
