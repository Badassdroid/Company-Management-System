# Company Management System

See [DEPLOYMENT.md](./DEPLOYMENT.md) for publishing the Flask API to Render and the React frontend to Vercel from GitHub.

## Configure Supabase

1. Copy `.env.example` to `.env`.
2. Set `SUPABASE_URL` to your project URL and `SUPABASE_SECRET_KEY` to the server-only secret key from your Supabase project settings.
3. Set either `SUPABASE_PUBLISHABLE_KEY` (recommended for new projects) or `SUPABASE_ANON_KEY` (legacy projects).
4. Keep `.env` local. It is ignored by Git; do not put secret keys in frontend files or commit them.
5. In the Supabase SQL Editor, run [`database/schema.sql`](./database/schema.sql) to create the tables and policies.

The Flask API uses the secret key only on the server for database operations. The Vite configuration exposes only the Supabase URL and publishable/anon key required for browser sign-in; it does not expose the secret key. Create Supabase Auth accounts for your staff and make sure management users have an active `management` row in `user_profiles`.

## Set up the accounts

1. In Supabase **Authentication → Users**, create and confirm `kaokutoro@gmail.com` and `mayhambug@gmail.com` using their passwords. The SQL script does not create Auth users or set passwords.
2. Run [`database/schema.sql`](./database/schema.sql) if you have not already created the tables.
3. Run [`database/demo_accounts.sql`](./database/demo_accounts.sql) in the Supabase SQL Editor. It creates employee records when needed and links `kaokutoro@gmail.com` to `management` and `mayhambug@gmail.com` to `employee`. It stops with an error if either Auth user is missing or unconfirmed.
4. Sign in through the app with the account email and password. The React client uses Supabase `signInWithPassword()`.

Keep account credentials private and use appropriately secured accounts for production.

## Run locally

In one terminal, start the API:

```sh
./venv/bin/python -m flask --app app run --debug
```

In another terminal, start the frontend:

```sh
cd frontend
npm install
npm run dev
```

The frontend runs at <http://localhost:5173> and the API at <http://localhost:5000>. Vite proxies `/api` calls to Flask. The API health check is <http://localhost:5000/api/health>. Set `CORS_ORIGINS` in `.env` to the exact comma-separated frontend origins you use.

Sign in at the frontend with a Supabase Auth account. The Dashboard, Employee Management, Asset Management, Vehicle Management, Inventory Management, and Requests Management pages read and update live API data. Management operations require a signed-in account whose active `user_profiles.role` is `management`.
