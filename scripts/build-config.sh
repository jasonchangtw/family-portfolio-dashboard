#!/usr/bin/env sh
set -eu

if [ -f supabase-config.js ] && [ -z "${VERCEL:-}" ] && [ -z "${NETLIFY:-}" ] && [ "${FORCE_BUILD_CONFIG:-0}" != "1" ]; then
  echo "supabase-config.js already exists. Set FORCE_BUILD_CONFIG=1 to overwrite it locally."
  exit 0
fi

if [ -n "${VERCEL:-}" ]; then
  cat > supabase-config.js <<EOF
export default null;
EOF
  echo "Supabase config is served by /api/config on Vercel."
  exit 0
fi

SUPABASE_PUBLIC_URL="${PUBLIC_SUPABASE_URL:-${SUPABASE_URL:-}}"
SUPABASE_PUBLIC_ANON_KEY="${PUBLIC_SUPABASE_ANON_KEY:-${SUPABASE_ANON_KEY:-}}"

if [ -z "${SUPABASE_PUBLIC_URL}" ] || [ -z "${SUPABASE_PUBLIC_ANON_KEY}" ]; then
  echo "PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY are required for deployment." >&2
  exit 1
fi

cat > supabase-config.js <<EOF
export default {
  url: "${SUPABASE_PUBLIC_URL}",
  anonKey: "${SUPABASE_PUBLIC_ANON_KEY}"
};
EOF
