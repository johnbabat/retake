# Retake

Retake is an AI-assisted video editor. You upload a video, it splits into shots, and you can generate new "takes" of any shot. A take can be a newly generated shot, a replaced character, a new motion, or new words with matching lip sync. You pick the takes you like and export the finished video.

It is a personal project, built for my own footage. It runs locally on a Mac and calls third-party AI video APIs. It does not train or host any models.

> **Status:** early development. The job runner works end to end in mock mode (M0). The non-linear video editor, multi-track timeline, and local FFmpeg pipeline can be built and verified completely offline in mock mode using generated test footage — see [Local / Offline Editor Track in ROADMAP.md](ROADMAP.md#local--offline-editor-track-mock-mode).

## What it does (planned)

- Upload a phone video and split it into shots automatically
- Generate a new shot from text or a still frame
- Replace a character in a shot with an AI-generated fictional character
- Copy a motion from a reference clip
- Re-voice your own lines with lip sync
- Pick between 2–3 takes per edit, then export an MP4 with the original audio intact
- Show an estimated cost before each AI job, with daily and monthly spend caps

## Usage rules

Retake is only used on the author's own face and footage, or on AI-generated fictional characters. It must not be used to depict other real people. It must never be used to create sexual content of real people.

## Built with

- TypeScript, Next.js, React, Tailwind
- SQLite with Drizzle ORM
- FFmpeg for all video processing
- A background worker that calls AI providers (fal.ai, Google Gemini API, Runway, sync.so, ElevenLabs) through one adapter interface, with a mock mode that makes no paid calls

## Running it locally

Requirements: macOS or Linux, Node.js 22.13+ (24 in `.nvmrc`), pnpm (or npm), FFmpeg.

```bash
nvm use                      # Node 22.13+ works (built-in node:sqlite)
brew install ffmpeg          # macOS; on Linux use the system ffmpeg
corepack enable
pnpm install
cp .env.example .env.local   # optional: PROVIDERS=mock is already the default
pnpm dev                     # web app on http://localhost:3000
pnpm worker                  # background job runner (separate terminal)
```

Set `PROVIDERS=mock` (the default when `.env.local` is omitted) to run completely offline with synthetic FFmpeg clips, no API keys, and `$0.00` spend.

**Offline / mirror environments:**
- If `corepack` cannot download `pnpm@12.14.0` without public internet, install pnpm from your local npm mirror (`npm i -g pnpm`) or adjust `"packageManager"` in `package.json` to match the installed pnpm version (standard `npm install` also works).
- `pnpm-workspace.yaml` sets `minimumReleaseAge: 4320` as a supply-chain guard; if an internal package mirror omits publish timestamps, comment that line out locally.

Other scripts: `pnpm test` (unit tests), `pnpm typecheck`, `pnpm lint`, `pnpm db:generate` (after changing the schema).

## How it fits together

- **Web app** (`src/app`): the editor UI and API routes. It only reads and writes database rows.
- **Worker** (`scripts/worker.ts`, `src/server/jobs`): picks up queued jobs, checks the spend caps, calls providers, saves the results as takes.
- **Providers** (`src/server/providers`): one adapter per AI model behind a single interface, plus a free mock.
- **Media** (`src/server/media`): FFmpeg and ffprobe, always called with argument lists (never a shell).
- **Database** (`src/server/db`): SQLite through Node's built-in `node:sqlite`, so there are no native modules to compile.

## License

[MIT](LICENSE)
