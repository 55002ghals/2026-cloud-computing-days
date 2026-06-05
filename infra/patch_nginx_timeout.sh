#!/bin/bash
set -euo pipefail

CONF=/etc/nginx/conf.d/qna-diary.conf

if [ ! -f "$CONF" ]; then
    echo "ERROR: $CONF not found" >&2
    exit 1
fi

if grep -q "proxy_read_timeout 300s" "$CONF"; then
    echo "Already patched — skipping."
    exit 0
fi

sudo cp "$CONF" "$CONF.bak.$(date +%s)"

sudo sed -i '/proxy_pass http:\/\/127\.0\.0\.1:8000;/a\        proxy_http_version 1.1;\n        proxy_buffering off;\n        proxy_read_timeout 300s;\n        proxy_send_timeout 300s;' "$CONF"

sudo nginx -t
sudo nginx -s reload

echo "==> Patched. Current /api/ block:"
grep -A8 'location /api/' "$CONF"
