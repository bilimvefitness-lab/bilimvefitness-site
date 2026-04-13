# Deployment Notes

## Recommended Target

- Vercel or any Node 20+ host that supports Next.js App Router
- Set the project root to `frontend`

## Required Environment

- `NEXT_PUBLIC_SITE_URL=https://bilimvefitness.com`

## Commands

- Install: `npm install`
- Type check: `npx tsc --noEmit`
- Build: `npm run build`
- Start: `npm run start`

## Notes

- The app uses a custom build output directory: `next-build`
- `server.js` is not the runtime entry; use Next scripts only
- `.vercelignore` excludes legacy static files with localhost references and local build artifacts
- Continuation forms are UI-only for now; real email delivery is intentionally deferred
