#!/bin/sh
set -e

# 默认值
export WIREMOCK_HOST="${WIREMOCK_HOST:-wiremock}"
export WIREMOCK_PORT="${WIREMOCK_PORT:-8080}"

# 通过 envsubst 生成 nginx 配置
envsubst '${WIREMOCK_HOST} ${WIREMOCK_PORT}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf

echo "WireMock upstream: http://$WIREMOCK_HOST:$WIREMOCK_PORT"

exec nginx -g "daemon off;"
