# FitLog

A personal, offline-first app that combines a **strength workout logger** (like Hevy) with a **food & macro tracker** (like MyFitnessPal), and connects them: your calorie target goes up on days you train, and body weight sits next to your strength progress.

Built with Expo SDK 58, Expo Router, expo-sqlite, and zustand. All data lives on your phone.

## Run it

```bash
npm install
npx expo start
```

Scan the QR code with **Expo Go** (Android/iOS). Everything used here works in Expo Go; no development build needed.

## Features

- **Today**: calorie ring with what you've eaten vs. your target, macro bars, a +kcal note on training days, today's workout, body weight, water.
- **Workout**: routines, start an empty or routine-based workout, set-by-set logging with your previous values shown, warm-up/drop/failure sets, rest timer with a notification, PR detection, history.
- **Exercise detail**: estimated 1RM and volume charts, full history.
- **Food**: meals per day, search [Open Food Facts](https://world.openfoodfacts.org), scan barcodes, recent foods, custom foods (per 100 g or per serving), edit and delete entries.
- **Progress**: body-weight trend with a 7-day average, 14-day calories vs. target, weekly sets per muscle, PR table.
- **Profile**: BMR (Mifflin-St Jeor) → TDEE → goal-adjusted targets, macro settings, kg/lb, rest-timer length, JSON export.

## Project layout

```
app/                 Expo Router screens (tabs + stack screens)
src/db/index.ts      SQLite schema, migrations, exercise seed
src/db/queries.ts    All reads/writes (synchronous expo-sqlite API)
src/lib/             Pure logic: nutrition, strength (e1RM/PRs), Open Food Facts client, formatting
src/store/           zustand stores: active workout draft (persisted), routine editor, data version
src/components/      UI primitives and SVG charts
```

## Scripts

```bash
npm test            # unit tests for nutrition / strength / OFF mapping / formatting
npm run typecheck
npm run lint
```

Food data © Open Food Facts contributors, available under the ODbL.
