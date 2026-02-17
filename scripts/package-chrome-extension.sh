#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

usage() {
  cat <<'USAGE'
Usage: scripts/package-chrome-extension.sh [--skip-tests]

Creates a Chrome Web Store upload ZIP in ./dist using the manifest name/version.
USAGE
}

SKIP_TESTS=0
for arg in "$@"; do
  case "$arg" in
    --skip-tests)
      SKIP_TESTS=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      usage
      exit 1
      ;;
  esac
done

if ! command -v node >/dev/null 2>&1; then
  echo "Error: node is required." >&2
  exit 1
fi

if ! command -v zip >/dev/null 2>&1; then
  echo "Error: zip is required." >&2
  exit 1
fi

required_paths=(manifest.json src popup icons)
for path in "${required_paths[@]}"; do
  if [[ ! -e "$path" ]]; then
    echo "Error: missing required path '$path'." >&2
    exit 1
  fi
done

if [[ "$SKIP_TESTS" -eq 0 ]]; then
  if [[ -f package.json ]] && command -v npm >/dev/null 2>&1; then
    echo "Running tests..."
    npm test
  else
    echo "Skipping tests (npm or package.json not found)."
  fi
fi

manifest_name="$(node -e "const m=require('./manifest.json'); const n=(m.name||'chrome-extension').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,''); process.stdout.write(n || 'chrome-extension');")"
manifest_version="$(node -e "const m=require('./manifest.json'); process.stdout.write(String(m.version || '0.0.0'));")"

dist_dir="$ROOT_DIR/dist"
mkdir -p "$dist_dir"

zip_name="${manifest_name}-v${manifest_version}.zip"
zip_path="$dist_dir/$zip_name"
rm -f "$zip_path"

zip -r -q "$zip_path" manifest.json src popup icons

echo "Created: $zip_path"
