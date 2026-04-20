# cdn

![Node.js](https://img.shields.io/badge/Node.js-%3E%3D24-339933?style=flat&logo=nodedotjs&logoColor=white)
![Fastify](https://img.shields.io/badge/Fastify-5.x-000000?style=flat&logo=fastify&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?style=flat&logo=vite&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-8-4479A1?style=flat&logo=mysql&logoColor=white)
![Cloudflare R2](https://img.shields.io/badge/Cloudflare%20R2-F38020?style=flat&logo=cloudflare&logoColor=white)
![Bulma](https://img.shields.io/badge/Bulma-1.x-00D1B2?style=flat&logo=bulma&logoColor=white)
![License](https://img.shields.io/badge/License-Apache%202.0-blue?style=flat)

A self-hosted CDN and media management platform. Upload, process, organize, and serve images, audio, video, and archive files through a responsive web UI, with all assets stored on **Cloudflare R2** object storage.

## Features

- **Multi-format media** — images, audio (MP3/WAV), video (MP4), and archives (ZIP)
- **Automatic image processing** — uploads are converted to WebP and resized into three variants (960 px, 640 px, and original resolution)
- **Audio conversion** — WAV files are automatically transcoded to MP3 (192 kbps)
- **Cloudflare R2 storage** — all processed assets are stored in and served from an R2 bucket via public URL
- **OAuth authentication** — sign in with Google or GitHub
- **Collections** — organize media into albums with drag-and-drop ordering
- **Responsive UI** — React + Bulma single-page app with Uppy-powered uploads
- **Health check** — `GET /health` returns database status and uptime

## R2 Storage Architecture

The server uses the **AWS SDK S3 client** configured against the Cloudflare R2 endpoint. Uploaded files are processed and stored under type-specific prefixes:

| Media Type | R2 Path Pattern | Format |
|---|---|---|
| Image | `i/{publicId}/960.webp`, `640.webp`, `original.webp` | WebP (quality 85) |
| Audio | `au/{publicId}/{filename}.mp3` | MP3 192 kbps |
| Video | `v/{publicId}/{filename}.mp4` | MP4 (passthrough) |
| Archive | `a/{publicId}/{filename}.zip` | ZIP (passthrough) |

Public URLs are built from the `R2_PUBLIC_URL` environment variable. A backward-compatible `/m/*` route redirects legacy paths to the current R2 public URL.

## Quickstart

### Prerequisites

- **Node.js** >= 24
- **MySQL** 8+
- **FFmpeg** (required for WAV → MP3 conversion)
- A **Cloudflare R2** bucket with API credentials
- A **Google** and/or **GitHub** OAuth application

### Install

```bash
git clone <repo-url> && cd cdn
npm install
```

### Configure

Create a `.env` file in the project root:

```dotenv
# Database
DB_HOST=localhost
DB_USER=cdn
DB_PASSWORD=
DB_NAME=cdn

# Cloudflare R2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=          # e.g. https://cdn.example.com

# OAuth — Google
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=    # e.g. https://cdn.example.com/auth/google/callback

# OAuth — GitHub
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_CALLBACK_URL=    # e.g. https://cdn.example.com/auth/github/callback

# Session
SESSION_SECRET=         # random string, ≥ 32 characters

# Server
HOST=0.0.0.0
PORT=3000
NODE_ENV=production
```

### Build & Run

```bash
# Build the frontend
npm run build

# Development (auto-reload)
npm run dev

# Production
npm start
```

Database migrations run automatically on startup—no manual migration step is needed.

### Production (PM2)

```bash
pm2 start ecosystem.config.cjs
```

## API Overview

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Health check (DB status, uptime) |
| `GET` | `/auth/google` | Start Google OAuth flow |
| `GET` | `/auth/github` | Start GitHub OAuth flow |
| `GET` | `/api/auth/status` | Current auth status |
| `POST` | `/api/auth/logout` | Log out |
| `GET` | `/api/collections` | List collections |
| `POST` | `/api/collections` | Create collection |
| `GET` | `/api/collections/:id` | Get collection with media |
| `PATCH` | `/api/collections/:id` | Update collection |
| `DELETE` | `/api/collections/:id` | Delete empty collection |
| `POST` | `/api/media/upload` | Upload a file (multipart) |
| `PATCH` | `/api/media/:id` | Update media metadata |
| `DELETE` | `/api/media/:id` | Delete media and R2 assets |

## License

[Apache License 2.0](LICENSE)
