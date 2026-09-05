# Деплой на skylar (game.multivibe.ru)

> **Статус: РАБОТАЕТ.** `wss://game.multivibe.ru/ws` принимает соединения (проверено извне).
> server.js под systemd (multivibe-server), бинд 172.18.0.1:2567 (docker-мост).

## Предусловия

- Node 22+ на хосте (`node --version`) — **бинарная копия в /usr/local/bin/node**
  (симлинк на /root/.hermes/node не работает: /root закрыт для deploy)
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
# ВНИМАНИЕ: НЕ nginx -s reload — нужен docker restart agentvibe-nginx!
# Файл смонтирован по inode; если редактор пересоздал файл (temp+rename),
# контейнер держит старый inode и reload не увидит правок.
docker restart agentvibe-nginx
docker exec agentvibe-nginx grep -c 'location /ws' /etc/nginx/conf.d/default.conf  # → 1

# 3. Проверка
curl -s http://172.18.0.1:2567/health   # {"ok":true,"tick":20,...}
# wss-проверка извне: node -e "const w=require('ws');const s=new WebSocket('wss://game.multivibe.ru/ws');s.on('message',d=>{console.log(d.toString());process.exit(0)})"
```

## Логи

```bash
journalctl -u multivibe-server -f
```

## Клиент

`index.html` подключается к `wss://game.multivibe.ru/ws` (nginx проксирует
Upgrade на 172.18.0.1:2567). Локально для разработки — `ws://localhost:2567`.
