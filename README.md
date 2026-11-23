# FitLog

[![CI](https://github.com/stravvez/FitLog/actions/workflows/ci.yml/badge.svg)](https://github.com/stravvez/FitLog/actions/workflows/ci.yml)

A personal, offline-first app that combines a **strength workout logger** (like Hevy) with a **food & macro tracker** (like MyFitnessPal), and connects them: your calorie target goes up on days you train, and body weight sits next to your strength progress.

Built with Expo SDK 58, Expo Router, expo-sqlite, and zustand. All data lives on your phone.

## Run it

```bash
npm install
npx expo start
```

Scan the QR code with **Expo Go** (Android/iOS). Everything used here works in Expo Go; no development build needed.

On first launch, open **Profile** and enter your details. Until you do, targets use placeholder values (Today shows a reminder).

## Features

- **Today**: calorie ring with what you've eaten vs. your target, macro bars, a +kcal note on training days, today's workout, body weight, water.
- **Workout**: routines, start an empty or routine-based workout, set-by-set logging with your previous values shown (tick ✓ on an empty set to reuse them), warm-up/drop/failure sets, rest timer with a notification, PR detection, history. An in-progress workout survives the app being closed.
- **Exercise detail**: estimated 1RM and volume charts, full history.
- **Food**: meals per day, search [Open Food Facts](https://world.openfoodfacts.org), scan barcodes, recent foods, custom foods (per 100 g or per serving), edit and delete entries.
- **Progress**: body-weight trend with a 7-day average, 14-day calories vs. target, weekly sets per muscle, PR table.
- **Profile**: BMR (Mifflin-St Jeor) → TDEE → goal-adjusted targets, macro settings, kg/lb, rest-timer length, JSON export.

## Project layout

```
app/                 Expo Router screens (tabs + stack screens)
src/db/index.ts      SQLite schema, migrations, exercise seed
src/db/queries.ts    All reads/writes (synchronous expo-sqlite API)
src/lib/             Pure logic: nutrition, strength (e1RM/PRs), Open Food Facts client (with retry),
                     formatting, rest-timer notifications, useToday (date that rolls over at midnight)
src/store/           zustand stores: active workout draft (persisted), routine editor, data version
src/components/      UI primitives and SVG charts
src/test/            Test helper: expo-sqlite sync API on Node's built-in SQLite
```

## Scripts

```bash
npm test            # unit + database tests (needs Node 22.5+ for node:sqlite)
npm run typecheck
npm run lint
```

Tests cover the nutrition and strength maths, the Open Food Facts client (mapping and retry), the workout-draft store, and every SQL query, run against a real in-memory SQLite database. CI runs typecheck, lint, tests and a full Android bundle on every push to `master`.

Food data © Open Food Facts contributors, available under the ODbL.
