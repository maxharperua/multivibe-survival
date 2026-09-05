# Деплой на skylar (game.multivibe.ru)

## Предусловия

- Node 22+ на хосте (`node --version`)
- nginx в docker-контейнере `agentvibe-nginx`
- Статик: `/home/deploy/game/public` → `/usr/share/nginx/html/game` (bind mount)
- Конфиг nginx: `/home/deploy/agentvibe/docker/nginx/default.conf` (bind mount в контейнер)

## Установка сервера

```bash
cd /home/deploy/game/public
git pull origin main          # забрать server/ + deploy/
mkdir -p /home/deploy/game/data

# 1. systemd-юнит
sudo cp deploy/multivibe-server.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now multivibe-server
systemctl status multivibe-server --no-pager   # active (running)

# 2. nginx WS-прокси (см. deploy/nginx-ws.conf)
#    — вставить location /ws в server block game.multivibe.ru
docker exec agentvibe-nginx nginx -t
docker exec agentvibe-nginx nginx -s reload

# 3. Проверка
curl -s http://127.0.0.1:2567/health   # {"ok":true,"tick":20,...}
```

## Логи

```bash
journalctl -u multivibe-server -f
```

## Клиент

`index.html` подключается к `wss://game.multivibe.ru/ws` (nginx проксирует
Upgrade на 127.0.0.1:2567). Локально для разработки — `ws://localhost:2567`.
