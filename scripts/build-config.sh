#!/usr/bin/env sh
set -eu

if [ -f supabase-config.js ] && [ -z "${VERCEL:-}" ] && [ -z "${NETLIFY:-}" ] && [ "${FORCE_BUILD_CONFIG:-0}" != "1" ]; then
  echo "supabase-config.js already exists. Set FORCE_BUILD_CONFIG=1 to overwrite it locally."
  exit 0
fi

if [ -z "${SUPABASE_URL:-}" ] || [ -z "${SUPABASE_ANON_KEY:-}" ]; then
  echo "SUPABASE_URL and SUPABASE_ANON_KEY are required for deployment." >&2
  exit 1
fi

cat > supabase-config.js <<EOF
export default {
  url: "${SUPABASE_URL}",
  anonKey: "${SUPABASE_ANON_KEY}"
};
EOF
