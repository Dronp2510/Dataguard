# DataGuard

DataGuard is a full-stack secure document vault. The backend stores encrypted blobs and metadata, while the frontend performs client-side encryption and key wrapping before upload. The server never receives the user's plaintext file contents or raw file keys.

## What It Does

- User signup, login, logout, and 12-hour bearer-token sessions.
- Client-side AES-GCM file encryption using the browser Web Crypto API.
- Password-derived master keys using PBKDF2 and per-user salts.
- File-key wrapping for each encrypted vault item.
- Folder and file organization inside a personal vault.
- Upload, download, rename, delete, recent files, and storage quota tracking.
- Share links with passphrase-wrapped file keys, expiry options, view limits, and revocation.
- Share access logs, activity history, viewer watermark labels, and notifications.
- Server-sent notification stream for shared-file access events.
- Render deployment blueprint for backend and frontend services.

## Tech Stack

Backend:

- FastAPI
- SQLAlchemy
- SQLite by default
- Uvicorn
- Werkzeug password hashing

Frontend:

- React 19
- Vite
- React Router
- Tailwind CSS
- Web Crypto API
- Lucide React icons

## Repository Layout

```text
.
+-- app/                    # FastAPI backend
|   +-- api/                # Route modules: auth, vault, share, notifications
|   +-- core/               # Rate limiting
|   +-- services/           # Auth/share/vault domain helpers
|   +-- bootstrap.py        # Table creation and SQLite column backfill helpers
|   +-- database.py         # SQLAlchemy engine/session setup
|   +-- main.py             # FastAPI app, CORS, router registration
|   +-- models.py           # SQLAlchemy models
|   +-- schemas.py          # Pydantic request/response models
|   +-- utils.py            # Tokens, paths, quotas, datetime helpers
+-- app_frontend/           # React/Vite frontend
|   +-- src/components/     # UI components and modals
|   +-- src/layouts/        # Authenticated app shell
|   +-- src/pages/          # Landing, auth, vault, activity, settings, share access
|   +-- src/utils/          # API, crypto, session, key storage, byte formatting
+-- tests/                  # Backend unit tests
+-- render.yaml             # Render Blueprint for backend + frontend
+-- DEPLOY_RENDER.md        # Render deployment notes
+-- requirements.txt        # Backend runtime dependencies
+-- requirements-dev.txt    # Backend dev/test dependencies
```

## Backend Setup

From the repository root:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt -r requirements-dev.txt
uvicorn app.main:app --reload
```

The API will be available at:

- `http://127.0.0.1:8000`
- `http://127.0.0.1:8000/docs`

## Frontend Setup

In a second terminal:

```powershell
cd app_frontend
npm install
npm run dev
```

The Vite dev server runs at:

- `https://localhost:5173`

Local frontend requests use the Vite `/api` proxy by default. `app_frontend/.env` can set:

```env
VITE_BACKEND_TARGET=http://127.0.0.1:8000
VITE_PUBLIC_SHARE_ORIGIN=https://localhost:5173
```

For production builds, set `VITE_API_BASE_URL` to the deployed backend origin.

## Environment Variables

Backend variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `sqlite:///./dataguard.db` | SQLAlchemy database URL |
| `STORAGE_PATH` | `./secure_storage` | Directory for encrypted uploaded blobs |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Allowed browser origins |
| `APP_ENV` | `development` | Used to reject wildcard CORS outside development |
| `TRUST_PROXY_HEADERS` | `false` | Trust `X-Forwarded-For` for rate limits only when behind a trusted proxy |
| `MAX_UPLOAD_BYTES` | `1610612736` | Per-file upload limit, default 1.5 GB |
| `MAX_USER_STORAGE_BYTES` | `16106127360` | Per-user quota, default 15 GB |

Frontend variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `/api` | API base URL used by `apiFetch` |
| `VITE_BACKEND_TARGET` | `http://127.0.0.1:8000` | Vite dev proxy target |
| `VITE_PUBLIC_SHARE_ORIGIN` | unset | Public frontend origin for share URLs |
| `VITE_PERSIST_MASTER_KEY` | `false` | Optional dev convenience to persist the raw derived master key in session storage |

## API Overview

Authentication:

- `POST /auth/signup`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`
- `GET /auth/key-wrappings`
- `POST /auth/change-password`

Vault:

- `POST /vault/files`
- `POST /vault/folders`
- `GET /vault/items`
- `GET /vault/recent`
- `GET /vault/storage`
- `GET /vault/files/{file_id}/download`
- `GET /vault/files/{file_id}/blob`
- `PUT /vault/items/{item_id}/rename`
- `DELETE /vault/items/{item_id}`

Sharing and activity:

- `POST /share/create`
- `GET /share/list`
- `DELETE /share/{share_id}`
- `GET /share/{token}`
- `GET /share/{token}/blob`
- `GET /share/{share_id}/logs`
- `GET /activity/logs`

Notifications:

- `GET /notifications`
- `POST /notifications/read-all`
- `GET /notifications/stream`

## Security Model

DataGuard uses client-side encryption for file contents. The frontend generates a random AES-GCM file key, encrypts the file in the browser, then wraps the file key with a password-derived master key before sending encrypted data to the backend.

For sharing, the frontend re-wraps the file key with a passphrase-derived share key. The backend stores the encrypted blob, encrypted key material, metadata, share settings, and logs, but it does not have enough information to decrypt files by itself.

Important implementation notes:

- Password hashes are stored with Werkzeug.
- Session tokens are generated randomly and stored server-side only as SHA-256 hashes.
- New share tokens are generated randomly and stored server-side only as SHA-256 hashes; legacy plaintext-token rows are still readable for compatibility.
- Upload, login, signup, share metadata, share blob, and share creation endpoints have in-memory rate limits.
- Rate limiting trusts proxy headers only when `TRUST_PROXY_HEADERS=true`.
- Share links can expire, be revoked, or stop working after a configured view limit.
- Encrypted blob paths are confined to `STORAGE_PATH`, and blob responses are served as `application/octet-stream` with `nosniff`.
- Client-side DOCX HTML previews are sanitized before insertion into the DOM.
- Browser auth tokens are kept in `sessionStorage`; the raw derived master key is memory-only unless `VITE_PERSIST_MASTER_KEY=true`.
- The current SQLite migration support is lightweight and handled by `app/bootstrap.py`.

## Testing

Run backend tests from the repository root:

```powershell
pytest
```

The tests cover authentication, folder/file flows, ownership checks, share limits/revocation, logs, password validation, and password-change key re-wrapping.

## Deployment

This repository includes `render.yaml` for a Render Blueprint with:

- `dataguard-backend`: Python web service
- `dataguard-frontend`: static Vite build

See `DEPLOY_RENDER.md` for the step-by-step Render flow.

On Render free tier, the configured SQLite database and storage directory use `/tmp`, which is ephemeral. Use persistent storage, an external database, and object storage before treating this as durable production storage.

## Development Notes

- Do not commit `.env` files, local databases, virtual environments, or uploaded encrypted blobs.
- The backend creates the configured storage directory automatically.
- The frontend keeps the derived master key in memory by default. Set `VITE_PERSIST_MASTER_KEY=true` only if you accept the extra risk in exchange for refresh persistence.
- Because encrypted blobs are stored on disk, deleting a vault file also removes the corresponding stored blob when present.
