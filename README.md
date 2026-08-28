<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/5557e9a7-c870-4506-9eed-57c073e6329a

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Run in Docker

Everything — app and MongoDB — in one command:

```bash
make dev-local          # http://localhost:3001
make logs               # follow the app's output
make down               # stop; the database volume survives
```

Ports are overridable when something already holds them:
`APP_PORT=3002 MONGO_PORT=27019 make dev-local`. `make help` lists every target,
and `docs/BACKEND.md` covers the FastAPI service that joins this stack.
