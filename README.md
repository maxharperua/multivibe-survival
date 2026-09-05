# multivibe-survival

Браузерная 3D-выживалка в духе DayZ (lite). Начало — однопользовательский Three.js FPS «Сосновый лес», цель — онлайн-выживалка: общий мир, игроки, голод/жажда/здоровье, крафт, лёгкий PvP, персистентность.

**Играть:** https://game.multivibe.ru (в разработке)

## Текущий статус (MVP FPS)

- Three.js 0.185.1 ESM **без сборки** (importmap), чистый JS
- Instanced-лес (2 CC0-модели сосен Quaternius, чанки)
- День/ночь (восход 06:00, закат 21:00), SkyDome-скайбокс (Poly Haven kloppenheim_06, CC0)
- Пикапы: камень (Kenney rockflat), ветка (Quaternius twig) — лежат на земле, сбор по **F**
- Инвентарь по **E**, мобильная версия (кнопка «СОБРАТЬ»)
- Процедурные тучи удалены по решению пользователя (см. историю коммитов)

## Следующий этап — онлайн-выживалка (DayZ-lite)

Архитектура (совместно с агентами GetPostingBoard, открыто для спора):

1. **Realtime**: Node 22 + голый `ws` (MVP), бинарный протокол 19 байт/игрок/тик (DataView), 20 тиков/сек. Colyseus — оверинжиниринг для нас.
2. **Authoritative-сервер**: состояние мира, инвентарь, ресурсы, крафт, урон — только на сервере (анти-чит). Клиент шлёт `InputVector {dx, dz, yaw, actions}`.
3. **Клиент**: Three.js, интерполяция чужих игроков, реконнект, HUD (голод/жажда/HP).
4. **Персистентность**: SQLite (потом Postgres).
5. **Лобби**: вход по нику, без паролей.

### Роли (запись открыта)

| Роль | Кто |
|---|---|
| Core Loop / Sockets (20 Гц, бинарный протокол 19 б) | antigravity-scout-99 (борда) |
| Survival / Inventory / Craft (5x5+4, атомарные интенты) | antigravity-flastik (борда) |
| QA / Load-testing / Interpolation / AOI-чанки 64x64 | hermes-scout-42 (борда) |
| LagComp (authoritative rewind) + Spatial Audio | antigravity-wanderer (борда) |
| Logistics / деплой / Three.js-интеграция | maxharper-hermes (борда) |

### Согласованные решения (протокол)

- `actions` — **битовая маска uint8**: BIT0 SPRINT, BIT1 CROUCH, BIT2 ATTACK, BIT3 PICKUP, BIT4 USE (5-7 резерв)
- **Разделение частот**: 20 Гц tick-stream (pos + yaw + mask, 19 байт/игрок) vs дискретные RPC (крафт/слоты/дроп)
- Всё состояние — на сервере (анти-чит), клиент шлёт только интенты

### Структура репозитория

```
server/
  server.js          — ws-приём + 20 Гц тик-луп (scout-99)
  inventory_engine.js— слоты/крафт/decay, чистый ESM (flastik)
  lagcomp.js         — rewind-буфер + raycast (wanderer)
  world.js           — чанки 64x64, AOI-рассылка (hermes-scout-42)
  persistence.js     — SQLite-снапшоты (maxharper, потом)
bots/
  loadtest.js        — headless-боты (hermes-scout-42)
public/              — существующий Three.js-клиент (game.multivibe.ru)
```

Правила PR: чистый ESM, 0 зависимостей в MVP, юнит-тесты (`node --test`), каждый модуль — отдельный PR в `main`.

## Запуск

Статика за nginx (nginx отдаёт `public/`). Для локальной разработки:

```bash
cd public && python3 -m http.server 8091
# открой http://localhost:8091
```

## Лицензии

- Код: MIT
- Модели/текстуры: CC0 (Poly Haven, Kenney, Quaternius) — см. `assets/`
