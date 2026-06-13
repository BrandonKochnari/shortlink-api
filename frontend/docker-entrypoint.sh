#!/bin/sh
set -eu

API_BASE_URL="${VITE_API_BASE_URL:-https://shortlink-api-1.onrender.com}"
API_BASE_URL="${API_BASE_URL%/}"

cat > /usr/share/nginx/html/runtime-config.js <<EOF
window.__SHORTLINK_CONFIG__ = {
  API_BASE_URL: "$API_BASE_URL",
};
EOF

exec nginx -g "daemon off;"
