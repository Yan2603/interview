#!/usr/bin/env bash
# 服务器一键：确保 JWT_ACCESS_SECRET，并创建登录账号。
#
# 用法（在仓库根目录，compose 已部署后）：
#   chmod +x scripts/bootstrap-auth.sh
#   ./scripts/bootstrap-auth.sh
#   ./scripts/bootstrap-auth.sh --username admin --password 'YourPass123!'
#
# 依赖：docker compose、openssl（或 /dev/urandom）

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

USERNAME="admin"
PASSWORD=""
ENV_FILE="${ROOT_DIR}/.env"
COMPOSE_SERVICE="app"
FORCE_SECRET=0

usage() {
  cat <<'EOF'
Usage: ./scripts/bootstrap-auth.sh [options]

Options:
  --username <name>     登录用户名（默认 admin）
  --password <pass>     登录密码（省略则随机生成并打印一次）
  --env-file <path>     .env 路径（默认仓库根目录 .env）
  --service <name>      compose 服务名（默认 app）
  --force-secret        即使已有 JWT_ACCESS_SECRET 也重新生成（会使旧 token 失效）
  -h, --help            显示帮助
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --username)
      USERNAME="${2:?--username requires a value}"
      shift 2
      ;;
    --password)
      PASSWORD="${2:?--password requires a value}"
      shift 2
      ;;
    --env-file)
      ENV_FILE="${2:?--env-file requires a value}"
      shift 2
      ;;
    --service)
      COMPOSE_SERVICE="${2:?--service requires a value}"
      shift 2
      ;;
    --force-secret)
      FORCE_SECRET=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "$USERNAME" ]]; then
  echo "username 不能为空" >&2
  exit 1
fi

random_hex() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
  else
    head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'
  fi
}

random_password() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 18 | tr -d '/+=' | head -c 20
  else
    head -c 16 /dev/urandom | od -An -tx1 | tr -d ' \n' | head -c 20
  fi
}

get_env_value() {
  local key="$1"
  local file="$2"
  [[ -f "$file" ]] || return 0
  # shellcheck disable=SC2162
  while IFS= read -r line || [[ -n "$line" ]]; do
    case "$line" in
      ''|\#*) continue ;;
    esac
    if [[ "$line" == "${key}="* ]]; then
      printf '%s' "${line#${key}=}"
      return 0
    fi
  done <"$file"
}

upsert_env() {
  local key="$1"
  local value="$2"
  local file="$3"
  local tmp

  touch "$file"
  tmp="$(mktemp)"
  if grep -qE "^${key}=" "$file"; then
    # 保留其它行，替换目标 key
    awk -v k="$key" -v v="$value" '
      BEGIN { done = 0 }
      $0 ~ "^" k "=" {
        print k "=" v
        done = 1
        next
      }
      { print }
      END {
        if (!done) print k "=" v
      }
    ' "$file" >"$tmp"
    mv "$tmp" "$file"
  else
    printf '\n%s=%s\n' "$key" "$value" >>"$file"
    rm -f "$tmp"
  fi
}

CURRENT_SECRET="$(get_env_value JWT_ACCESS_SECRET "$ENV_FILE" || true)"
SECRET_CHANGED=0

if [[ "$FORCE_SECRET" -eq 1 || -z "$CURRENT_SECRET" || "$CURRENT_SECRET" == "change-me-access-secret" ]]; then
  NEW_SECRET="$(random_hex)"
  upsert_env JWT_ACCESS_SECRET "$NEW_SECRET" "$ENV_FILE"
  CURRENT_SECRET="$NEW_SECRET"
  SECRET_CHANGED=1
  echo "已写入 JWT_ACCESS_SECRET → $ENV_FILE"
else
  echo "沿用已有 JWT_ACCESS_SECRET（$ENV_FILE）"
fi

# TTL 缺省时补上，避免 create-user / 登录时报 Missing config
if [[ -z "$(get_env_value JWT_ACCESS_TTL "$ENV_FILE" || true)" ]]; then
  upsert_env JWT_ACCESS_TTL "15m" "$ENV_FILE"
fi
if [[ -z "$(get_env_value JWT_REFRESH_TTL "$ENV_FILE" || true)" ]]; then
  upsert_env JWT_REFRESH_TTL "7d" "$ENV_FILE"
fi

PASSWORD_GENERATED=0
if [[ -z "$PASSWORD" ]]; then
  PASSWORD="$(random_password)"
  PASSWORD_GENERATED=1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "未找到 docker，请先安装 Docker / Compose" >&2
  exit 1
fi

echo "重建 ${COMPOSE_SERVICE} 以加载最新环境变量…"
docker compose up -d --force-recreate --no-deps "$COMPOSE_SERVICE"

echo "等待 ${COMPOSE_SERVICE} 就绪…"
for _ in $(seq 1 30); do
  if docker compose exec -T "$COMPOSE_SERVICE" node -e "process.exit(0)" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "创建用户 ${USERNAME}…"
set +e
CREATE_OUT="$(docker compose exec -T \
  -e JWT_ACCESS_SECRET="$CURRENT_SECRET" \
  -e JWT_ACCESS_TTL="$(get_env_value JWT_ACCESS_TTL "$ENV_FILE")" \
  -e JWT_REFRESH_TTL="$(get_env_value JWT_REFRESH_TTL "$ENV_FILE")" \
  "$COMPOSE_SERVICE" \
  node dist/auth/create-user.cli.js --username "$USERNAME" --password "$PASSWORD" 2>&1)"
CREATE_CODE=$?
set -e
echo "$CREATE_OUT"

if [[ $CREATE_CODE -ne 0 ]]; then
  if echo "$CREATE_OUT" | grep -q '用户名已存在'; then
    echo "用户已存在，跳过创建。密钥与服务已就绪。"
  else
    echo "创建用户失败（exit $CREATE_CODE）" >&2
    exit "$CREATE_CODE"
  fi
fi

echo
echo "======== 完成 ========"
echo "用户名: $USERNAME"
if [[ "$PASSWORD_GENERATED" -eq 1 ]]; then
  echo "密码:   $PASSWORD"
  echo "（请立即保存；脚本不会再次显示随机密码）"
else
  echo "密码:   （你传入的 --password）"
fi
if [[ "$SECRET_CHANGED" -eq 1 ]]; then
  echo "JWT_ACCESS_SECRET 已更新；旧 access token 全部失效。"
fi
echo "======================"
