# EON — software that evolves under your control
Copyright (c) Dev Prakash Sahu. All rights reserved. Contact: devprakashsahu348@gmail.com

React + TypeScript (Vite) frontend, FastAPI (Python) backend as Vercel serverless function, Neon Postgres. Tables are created automatically on first request.

## Launch for free (about 15 minutes)
1. **GitHub**: create an empty repo, upload everything in this folder (not `node_modules`/`dist`), commit.
2. **Neon**: create a project at neon.tech, copy the connection string (it ends in `?sslmode=require`).
3. **Vercel**: Add New > Project > import the repo. Framework: Vite. Add environment variables from `.env.example`:
   - `DATABASE_URL` (Neon), `JWT_SECRET` (48+ random characters), `APP_URL` (your final https URL)
   - `RESEND_API_KEY` + `MAIL_FROM` for reset and contact emails (free at resend.com; verify your domain to email anyone, otherwise it only delivers to your own account email)
   - `GEMINI_API_KEY` optional, free key from Google AI Studio. Without it the Guide uses built-in answers.
4. Deploy. Vercel gives you HTTPS automatically.
5. **Replace `YOUR-SITE.vercel.app`** with your real URL in: `index.html`, `public/robots.txt`, `public/sitemap.xml`. Redeploy.
6. Open the site, create an account, load the sample project, run an experiment.

## After launch checklist
- Submit `https://your-site/sitemap.xml` in Google Search Console.
- Custom domain: Vercel > Settings > Domains. Domain email: a free forwarder (e.g. Cloudflare Email Routing) or Zoho Mail free plan.
- Backups: Neon free plan keeps a short point-in-time restore window; export with `pg_dump` for long-term copies.
- Analytics: not installed (cookie policy says none by default). Add Google Analytics only with a consent step, then update the Cookie Policy.
- Test on a real phone, Chrome and Safari, and test the reset email with your real domain.

## Honest scope of this first version
Working: sign up, sign in, logout, forgot/reset password (single-use, 30 min), rate limiting, projects, Python AST analysis, transparent score, experiments with before/after, approve/reject, Evolution Memory, discovery ranking, contact form, AI Guide (Gemini with built-in fallback, labelled), legal pages, SEO files.
Not built yet (Vercel cannot run Docker): sandboxed container test runs, pytest execution, other languages, cross-project learning, evolution tree, payments (terms page only, no processor).

## Local run
`npm install`, copy `.env.example` to `.env`, `pip install -r requirements.txt`, then `npm run api` and `npm run dev`.
