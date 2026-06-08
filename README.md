# Culture Quest Lite Mobile

Expo SDK 56 project structured around `expo-router` with a feature-based `src` layout.

## Run the project

```bash
npm install
npx expo start
```

Useful shortcuts:

- `npm run android`
- `npm run ios`
- `npm run web`
- `npm run lint`

## Project structure

```text
src/
  app/                  Expo Router route files only
    (tabs)/             Main tab navigation
  components/           Shared UI primitives
  constants/            Theme tokens and shared constants
  features/             Domain modules (home, quests, profile)
  hooks/                Shared hooks
  services/             API and external integrations
  store/                Global state when needed
  types/                Shared TypeScript types
  utils/                Helper functions
```

## Conventions

- Keep navigation files inside `src/app`.
- Put screen implementations in `src/features/<feature>/screens`.
- Put reusable UI in `src/components`.
- Grow `src/services`, `src/store`, `src/types`, and `src/utils` only when the app needs them.

## Next implementation targets

1. Authentication and onboarding flow.
2. Quest list, detail, and progress tracking.
3. Rewards, leaderboard, and user profile.
