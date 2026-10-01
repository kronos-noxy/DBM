# Discord Music Bot

TypeScript · discord.js v14 · @discordjs/voice · play-dl · better-sqlite3 · Docker

## Setup
1. Create an app + bot at https://discord.com/developers, invite with scopes `bot applications.commands` and permissions **Connect**, **Speak**, **Send Messages**, **Embed Links**.
2. `cp .env.example .env` and fill in `DISCORD_TOKEN` / `DISCORD_CLIENT_ID`.
3. Register slash commands, then run:

```bash
# Docker
docker compose build
docker compose run --rm bot node dist/deploy-commands.js
docker compose up -d

# Local (needs Node 20+ and ffmpeg)
npm install
npm run deploy-commands
npm run dev
```

## Commands
`/play` `/pause` `/resume` `/skip` `/stop` `/queue` `/nowplaying` `/volume` `/loop` `/shuffle` `/remove`
`/playlist save|load|list|delete` `/history`

## Development
`npm test` · `npm run typecheck` · `npm run build`

## Layout
- `src/index.ts` – bootstrap + graceful shutdown
- `src/handlers.ts` – Discord event handlers, player announcements
- `src/player.ts` – `GuildPlayer` (voice/audio) and `PlayerManager`
- `src/queue.ts` – pure queue logic (unit tested)
- `src/resolver.ts` – URL/search → tracks via play-dl
- `src/db.ts` – SQLite with versioned migrations
- `src/commands/*` – one file per slash command
