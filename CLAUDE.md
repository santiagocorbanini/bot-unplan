# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Monorepo structure

This repo contains two independent Node.js services deployed on Railway:

- **`whatsapp-bot/`** — Webhook listener connected to Meta's WhatsApp Cloud API. Receives incoming messages, classifies them with Groq (Llama), searches professionals in Supabase, and replies. Also forwards all messages and errors to Discord.
- **`promo-bot/`** — Cron job that sends outbound promotional WhatsApp messages via the Kapso AI proxy (~20/day). Reads contacts from a local TSV file (`contactos.csv`) and tracks sent contacts in Supabase to avoid duplicates.

Each service has its own `package.json` and is deployed independently in Railway with its own Root Directory and env vars.

## Running locally

```bash
# whatsapp-bot
cd whatsapp-bot
npm install
node --env-file=.env --watch index.js

# promo-bot
cd promo-bot
npm install
node --env-file=.env index.js
```

## whatsapp-bot architecture

Message flow: `index.js` (Express webhook) → `handler.js` → `ai.js` + `supabase.js` + `whatsapp.js`

- **`index.js`** — Express server. Handles Meta webhook verification (GET) and incoming messages (POST). Responds 200 immediately before processing.
- **`handler.js`** — Orchestrates the full pipeline: text/audio ingestion → Groq classification → Supabase search → WhatsApp reply. Also forwards to Discord and sends Discord alerts on errors.
- **`ai.js`** — Two Groq calls: `classifyMessage()` uses `llama-3.1-8b-instant` to extract category/keywords/isEmergency as JSON; `transcribeAudio()` uses `whisper-large-v3-turbo`.
- **`supabase.js`** — Queries `professional_profiles` table. Primary search by `specialty_category/specialty/description` with ilike; falls back to keyword search if no results.
- **`whatsapp.js`** — Raw fetch calls to Meta Graph API v19.0 for sending messages and downloading audio media.

### Key env vars (whatsapp-bot)
`WHATSAPP_TOKEN`, `VERIFY_TOKEN`, `GROQ_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `DISCORD_WEBHOOK_URL`, `APP_URL`

## promo-bot architecture

Single script (`index.js`) that runs once and exits — no server.

- **`config.js`** — Single source of truth for all tunable parameters: `MESSAGES_PER_RUN`, `ACTIVE_DAYS`, `DELAY_MS`, `buildMessage()`. Edit this file to change behavior.
- **`index.js`** — Checks active day → validates env vars → parses TSV → queries Supabase for already-sent phones → sends batch via Kapso → records sent contacts in Supabase.

Contacts CSV is tab-separated with columns: `pagina, nombre, cp, ciudad, telefono_original, whatsapp, direccion, email, web`. Only rows with `whatsapp` starting with `+549` are used. Duplicates within the CSV are deduplicated by phone number.

The `promo_sent` Supabase table (in the prod project) tracks sent contacts with `phone UNIQUE` to prevent re-sending across runs.

### Key env vars (promo-bot)
`KAPSO_API_KEY`, `KAPSO_PHONE_NUMBER_ID`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`

## Supabase

- Uses **service key** (bypasses RLS) in both services.
- Main table: `professional_profiles` with fields `id, trade_name, specialty, specialty_category, skills, description, location_city, location_province, emergency_available, whatsapp_phone, hourly_rate, is_active`.
- Promo table: `promo_sent` with fields `phone (unique), nombre, ciudad, sent_at`.
