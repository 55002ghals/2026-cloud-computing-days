#!/bin/bash
set -euo pipefail

exec &> >(stdbuf -oL -eL tee /var/log/deploy.log)

GIT_REPO_URL="https://github.com/55002ghals/2026-cloud-computing-days.git"
GIT_BRANCH="master"

# Read credentials from env file and export to subprocesses
set -a; source /etc/qna-diary/env; set +a

if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
    echo "WARNING: ANTHROPIC_API_KEY is not set in /etc/qna-diary/env — Claude API calls will fail" >&2
fi

echo "==> [1/8] Installing System Packages..."
dnf install -y python3.11 python3.11-pip nodejs20 git nginx
dnf clean all

echo "==> [2/8] Synchronizing Source Code..."
if [ -d "/opt/app/.git" ]; then
    cd /opt/app
    git fetch origin "$GIT_BRANCH"
    git reset --hard "origin/$GIT_BRANCH"
else
    mkdir -p /opt/app
    git clone --branch "$GIT_BRANCH" "$GIT_REPO_URL" /opt/app
fi
chown -R ec2-user:ec2-user /opt/app

echo "==> [3/8] Setting up Backend Virtual Environment..."
cd /opt/app/backend
sudo -u ec2-user python3.11 -m venv .venv
sudo -u ec2-user .venv/bin/pip install --upgrade pip
sudo -u ec2-user .venv/bin/pip install -r requirements.txt

echo "==> [3-b/8] Setting up MCP Server Virtual Environment..."
cd /opt/app/mcp_server
sudo -u ec2-user python3.11 -m venv .venv
sudo -u ec2-user .venv/bin/pip install --upgrade pip
sudo -u ec2-user .venv/bin/pip install -r requirements.txt

echo "==> [4/8] Verifying Database Context..."
cd /opt/app/backend
.venv/bin/python3 -u << 'PYEOF'
import asyncio, asyncpg, re

def read_env(key):
    with open('/etc/qna-diary/env') as f:
        for line in f:
            m = re.match(rf'^{key}=["\']?([^"\'\n]+)["\']?', line.strip())
            if m:
                return m.group(1)
    return ''

async def init_database():
    raw = read_env('DB_URL')
    if not raw:
        print('Warning: DB_URL not found in /etc/qna-diary/env, skipping check.', flush=True)
        return
    base_url = raw.replace('postgresql+asyncpg://', 'postgresql://').rsplit('/', 1)[0] + '/postgres'
    try:
        conn = await asyncpg.connect(base_url)
        exists = await conn.fetchval("SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = 'qnadiary')")
        if not exists:
            await conn.execute('COMMIT')
            await conn.execute('CREATE DATABASE qnadiary')
            print("Success: 'qnadiary' database created.", flush=True)
        else:
            print("Info: 'qnadiary' database already exists.", flush=True)
        await conn.close()
    except Exception as e:
        print(f'Warning: {e}', flush=True)

asyncio.run(init_database())
PYEOF

echo "==> [5/8] Building Frontend Assets..."
cd /opt/app/frontend
npm ci
npm run build
rm -rf node_modules

echo "==> [6/8] Configuring System Services..."

cat > /etc/systemd/system/qna-api.service <<'UNIT'
[Unit]
Description=QnA Diary FastAPI Application
After=network.target

[Service]
User=ec2-user
WorkingDirectory=/opt/app/backend
EnvironmentFile=/etc/qna-diary/env
ExecStart=/opt/app/backend/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT

cat > /etc/systemd/system/qna-mcp.service <<'UNIT'
[Unit]
Description=QnA Diary MCP Server
After=network.target

[Service]
User=ec2-user
WorkingDirectory=/opt/app
EnvironmentFile=/etc/qna-diary/env
ExecStart=/opt/app/mcp_server/.venv/bin/uvicorn \
    mcp_server.main:app --host 127.0.0.1 --port 8080
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT

cat > /etc/nginx/conf.d/qna-diary.conf <<'NGINX'
server {
    listen 80;
    server_name _;

    root /opt/app/frontend/dist;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_http_version 1.1;
        proxy_buffering off;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }

    location /mcp {
        auth_basic "MCP Access";
        auth_basic_user_file /etc/nginx/.mcp.htpasswd;

        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_http_version 1.1;
        proxy_read_timeout 120s;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
NGINX

rm -f /etc/nginx/conf.d/default.conf

echo "==> [7/8] Configuring MCP Auth and Environment..."

# htpasswd: recreate on every redeploy (picks up password changes)
_mcp_pw="$APP_PASSWORD"
printf 'mcp:%s\n' "$(openssl passwd -apr1 "$_mcp_pw")" > /etc/nginx/.mcp.htpasswd
chmod 640 /etc/nginx/.mcp.htpasswd
chown root:nginx /etc/nginx/.mcp.htpasswd
unset _mcp_pw

# Keep DATABASE_URL in sync with DB_URL (mcp_server/db.py reads DATABASE_URL)
if [ -z "$DB_URL" ]; then
    echo "ERROR: DB_URL is not set in /etc/qna-diary/env — cannot continue" >&2
    exit 1
fi
if grep -q "^DATABASE_URL=" /etc/qna-diary/env; then
    sed -i "s|^DATABASE_URL=.*|DATABASE_URL=$DB_URL|" /etc/qna-diary/env
else
    echo "DATABASE_URL=$DB_URL" >> /etc/qna-diary/env
fi

echo "==> [8/8] Running Migrations and Starting Services..."
cd /opt/app/backend
.venv/bin/alembic upgrade head
.venv/bin/python -m scripts.seed_holidays

systemctl daemon-reload
systemctl enable nginx qna-api qna-mcp
systemctl restart nginx qna-api qna-mcp

echo "==> Redeploy done"
systemctl --no-pager status qna-api qna-mcp | head -n 30

echo "==> Tailing qna-api logs (Ctrl+C to exit)"
journalctl -u qna-api -f
