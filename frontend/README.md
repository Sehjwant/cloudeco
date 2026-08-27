# Aussie EcoLens — Frontend

React + Vite + TypeScript web app providing AWS Cognito authentication and the
full user interface: media upload, tag/species/thumbnail/file search, bulk tag
editing, deletion, and tag notifications.

## Setup

```bash
npm install
cp .env.example .env     # fill in the Cognito values
npm run dev              # http://localhost:5173
npm run build            # type-check + production build
```

See the [project README](../README.md) and
[architecture doc](../docs/ARCHITECTURE.md) for the full design.
