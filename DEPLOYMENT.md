# Online Deployment

The frontend is hosted on Vercel and the Flask API on Render. Both services deploy from this GitHub repository.

## Publish to GitHub

Push the project to a GitHub repository. Keep `.env` out of source control; it contains the server-only Supabase secret.

## Deploy the API to Render

1. In Render, choose **New → Blueprint** and connect this repository. Render reads `render.yaml` and creates the Python web service.
2. Set `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and `SUPABASE_PUBLISHABLE_KEY` from Supabase. Set `FRONTEND_URL` to the Vercel production origin, for example `https://your-project.vercel.app`, and set `CORS_ORIGINS` to that exact origin.
3. Wait for the service to deploy and verify `https://YOUR-RENDER-SERVICE.onrender.com/api/health` returns `{"success": true, "status": "ok"}`.

## Deploy the frontend to Vercel

1. Import the same GitHub repository in Vercel and set **Root Directory** to `frontend`.
2. Add these environment variables for the Production environment:
	- `VITE_API_BASE_URL`: `https://YOUR-RENDER-SERVICE.onrender.com/api`
	- `VITE_SUPABASE_URL`: your Supabase project URL
	- `VITE_SUPABASE_PUBLISHABLE_KEY`: your Supabase publishable key (or use `VITE_SUPABASE_ANON_KEY` for a legacy project)
3. Deploy and copy the Vercel production URL into Render's `CORS_ORIGINS` if it was not known earlier, then redeploy the Render service.
4. In Supabase **Authentication → URL Configuration**, set the Site URL to the Vercel URL and add `https://YOUR-VERCEL-DOMAIN/**` to the allowed redirect URLs. Configure Supabase SMTP so employee invitation emails can be delivered.

## Employee sign-in accounts

When management adds an active employee with an email address, the API invites that address through Supabase Auth and links the Auth user to the employee's `user_profiles` row. The employee follows the email link to `/set-password` to choose their password. For an existing Supabase Auth user with the same email, management can use **Create or link login** in the Employees list; this links the existing Auth identity without sending another invitation. Employees without an email can be given a login later by adding their email and using that action.

Deactivating an employee also disables their app profile. Reactivating them restores access to the linked account.

The publishable/anon key is intended for browser use. Never put `SUPABASE_SECRET_KEY` in Vercel or any `VITE_` variable. Render's free service may spin down after inactivity, so the first API call after a quiet period can be slow.
