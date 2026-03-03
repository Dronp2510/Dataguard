# Deploy DataGuard on Render

This repository includes a Render Blueprint at `render.yaml` with:

- `dataguard-backend` (Python web service)
- `dataguard-frontend` (static site)

## 1. Push your code

Push this branch to GitHub/GitLab.

## 2. Create Blueprint on Render

1. Open Render dashboard.
2. Select `New` -> `Blueprint`.
3. Connect your repository.
4. Render will detect `render.yaml` and propose both services.
5. Click deploy.

## 3. Update domains after first deploy

The default values in `render.yaml` use placeholders:

- `https://dataguard-backend.onrender.com`
- `https://dataguard-frontend.onrender.com`

After deploy, replace these env vars with your real service URLs:

- Backend `CORS_ORIGINS`: your frontend URL
- Frontend `VITE_API_BASE_URL`: your backend URL
- Frontend `VITE_PUBLIC_SHARE_ORIGIN`: your frontend URL

Then redeploy frontend once.

## 4. Persistent storage notes

Backend uses:

- `DATABASE_URL=sqlite:////var/data/dataguard.db`
- `STORAGE_PATH=/var/data/secure_storage`

These paths are on the attached persistent disk (`/var/data`), so file shares and DB survive restarts.

## 5. Local development unaffected

If env vars are not set locally:

- DB defaults to `sqlite:///./dataguard.db`
- Storage defaults to `./secure_storage`
- CORS defaults to localhost frontend origins only (`http://localhost:5173`, `http://127.0.0.1:5173`)

## 6. Security checks before connect

- Keep GitHub app scope to `Only select repositories`.
- Do not grant additional repository permissions unless needed.
- Keep `.env` files out of git (root and frontend `.env*` are ignored in this repo).
- Ensure backend env includes:
  - `APP_ENV=production`
  - `CORS_ORIGINS=https://<your-frontend-domain>`

## 7. One-time history cleanup (recommended)

Past commits previously included files under `secure_storage/`. If any were real sensitive files, clean git history before making the repo public or widely shared.
