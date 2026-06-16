# SquadGoals

A collaborative accountability PWA — group check-ins, schedules, reminders, and a "jar" penalty system.

## Stack

| Layer | Technology | Host |
|-------|-----------|------|
| Frontend | Vite + React + TypeScript PWA | Railway (static) |
| Backend API | Next.js 14 (App Router) + Node.js | Railway (service) |
| Database | PostgreSQL via Prisma ORM | Railway (Postgres plugin) |
| Auth | Google Sign-In → JWT | — |
| Push | Web Push (VAPID) | — |
| Email | SendGrid | — |

## Repository layout

```
accountabilibuddy/
├── src/                   # Vite + React PWA
├── backend/               # Next.js API server
│   ├── prisma/            # Prisma schema & migrations
│   └── src/
│       ├── app/api/       # Next.js route handlers
│       ├── jobs/          # node-cron scheduler
│       └── lib/           # auth, push, email helpers
├── frontend/railway.json  # Railway config — frontend service
└── backend/railway.json   # Railway config — backend service
```

## Local development

### Prerequisites

- Node.js 20+
- PostgreSQL running locally (or a Railway Postgres URL)

### Backend

```bash
cd backend
cp .env.example .env          # fill in values
npm install
npx prisma migrate dev        # run migrations
node server.js                # starts on :3001
```

### Frontend

```bash
# repo root
cp .env.example .env          # fill in VITE_API_URL etc.
npm install
npm run dev                   # starts on :5173
```

## Environment variables

### Frontend (`/.env`)

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend URL, e.g. `https://api.example.railway.app` |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `VITE_VAPID_PUBLIC_KEY` | VAPID public key (from backend) |

### Backend (`/backend/.env`)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Random secret for signing JWTs |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `VAPID_PUBLIC_KEY` | VAPID public key |
| `VAPID_PRIVATE_KEY` | VAPID private key |
| `VAPID_EMAIL` | `mailto:you@example.com` |
| `SENDGRID_API_KEY` | SendGrid API key (optional) |
| `FRONTEND_URL` | Deployed frontend URL (CORS) |
| `UPLOADS_DIR` | File upload directory (default `./uploads`) |
| `PORT` | Server port (default `3001`) |

Generate VAPID keys:
```bash
cd backend && npx web-push generate-vapid-keys
```

## Railway deployment

Deploy as two separate services from the same GitHub repo:

1. **Frontend service**
   - Root directory: `/` (repo root)
   - Build command: `npm run build`
   - Start command: `npx serve -s dist -l $PORT`

2. **Backend service**
   - Root directory: `backend`
   - Build command: `npm run build`
   - Start command: `node server.js`
   - Add a **PostgreSQL** plugin and copy `DATABASE_URL` to environment

3. After first backend deploy, run Prisma migrations:
   ```bash
   railway run --service backend npx prisma migrate deploy
   ```

### GitHub Actions auto deploy on merge

This repository now includes `.github/workflows/railway-deploy.yml`, which deploys both services whenever `main` is updated.

Configure these GitHub settings before relying on it:

- **Secret:** `RAILWAY_TOKEN`
- **Repository variable:** `RAILWAY_FRONTEND_SERVICE`
- **Repository variable:** `RAILWAY_BACKEND_SERVICE`

Each service variable should be set to the Railway service name or service ID for the existing frontend/backend service.
# evify
