#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

usage() {
  cat <<'USAGE'
Usage: scripts/package-firefox-extension.sh [--skip-tests]

Creates a Firefox package (.xpi) in ./dist using root manifest + firefox overrides.
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

required_paths=(manifest.json firefox/manifest.overrides.json src popup icons)
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

manifest_name="$(node -e "const m=require('./manifest.json'); const n=(m.name||'firefox-extension').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,''); process.stdout.write(n || 'firefox-extension');")"
manifest_version="$(node -e "const m=require('./manifest.json'); process.stdout.write(String(m.version || '0.0.0'));")"

dist_dir="$ROOT_DIR/dist"
mkdir -p "$dist_dir"

build_dir="$dist_dir/.firefox-build"
rm -rf "$build_dir"
mkdir -p "$build_dir"

cp -R src popup icons "$build_dir/"

node - "$ROOT_DIR/manifest.json" "$ROOT_DIR/firefox/manifest.overrides.json" "$build_dir/manifest.json" <<'NODE'
const fs = require("node:fs");

const [basePath, overridesPath, outPath] = process.argv.slice(2);
const base = JSON.parse(fs.readFileSync(basePath, "utf8"));
const overrides = JSON.parse(fs.readFileSync(overridesPath, "utf8"));

function mergeDeep(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const targetValue = target[key];
      const nextTarget = targetValue && typeof targetValue === "object" && !Array.isArray(targetValue)
        ? targetValue
        : {};
      target[key] = mergeDeep(nextTarget, value);
    } else {
      target[key] = value;
    }
  }
  return target;
}

const merged = mergeDeep(JSON.parse(JSON.stringify(base)), overrides);
fs.writeFileSync(outPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
NODE

xpi_name="${manifest_name}-firefox-v${manifest_version}.xpi"
xpi_path="$dist_dir/$xpi_name"
rm -f "$xpi_path"

(
  cd "$build_dir"
  zip -r -q "$xpi_path" manifest.json src popup icons
)

rm -rf "$build_dir"
echo "Created: $xpi_path"
