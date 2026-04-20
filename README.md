# DFAVisualizer

Interactive visualizer and playground for finite automata.

## Prerequisites

- Node.js 18+
- npm
- Firebase project
- Gemini API key

## Run Locally

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file:

```bash
cp .env.example .env
```

3. Fill values in `.env`.

4. Start dev server:

```bash
npm run dev
```

## Environment Variables

Copy from `.env.example` and set real values:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
VITE_GEMINI_TOKEN=
```

##### Note:
- Firebase is considered configured when at least `VITE_FIREBASE_API_KEY` and `VITE_FIREBASE_PROJECT_ID` are set.
- `VITE_GEMINI_TOKEN` is required for the AI summary panel.

## Firebase Setup (Auth + Firestore)

1. Create a Firebase project.
2. In Firebase Console, enable:
    - Authentication -> Sign-in method -> GitHub
    - Firestore Database
3. Copy Firebase web config values into `.env`.
4. Apply Firestore rules from `firestore.rules`.

## GitHub OAuth Setup

1. Create a GitHub OAuth app.
2. Set the callback URL from Firebase Auth instructions.
3. Add GitHub client ID and secret in Firebase Authentication -> GitHub provider.
4. Add your domains in Firebase Auth authorized domains.
