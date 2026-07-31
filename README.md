<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/ef022a73-4503-49ee-a7b0-eb2ad3697ad3

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Production deployment notes

- **Content-Security-Policy** is only enabled when `NODE_ENV=production`
  (see `server.ts`) - the dev server needs a much looser policy for Vite's
  HMR/eval-based module transform, which the production build never uses.
  The policy is generated from `SUPABASE_URL` at server startup, so it
  automatically covers whichever Supabase project you deploy against.
- **`VITE_*` environment variables are baked in at build time**, not read
  at runtime - `npm run build` must be run with `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_ANON_KEY` already set in the shell/CI environment, or the
  built app will fail immediately with a "Missing VITE_SUPABASE_URL" error
  in the browser. Setting them only in the server's runtime environment
  (e.g. a platform's dashboard env vars, added after the build step) is not
  enough.
