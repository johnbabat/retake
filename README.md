# Retake

Retake is an AI-assisted video editor. You upload a video, it splits into shots, and you can generate new "takes" of any shot. A take can be a newly generated shot, a replaced character, a new motion, or new words with matching lip sync. You pick the takes you like and export the finished video.

It is a personal project, built for my own footage. It runs locally on a Mac and calls third-party AI video APIs. It does not train or host any models.

> **Status:** early development. See [ROADMAP.md](ROADMAP.md) for what is planned.

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

Requirements: macOS, Node.js 24 (see `.nvmrc`), pnpm, FFmpeg.

```bash
nvm use
brew install ffmpeg
corepack enable
pnpm install
cp .env.example .env.local   # then add your own API keys
pnpm dev                     # web app on http://localhost:3000
pnpm worker                  # background job runner (separate terminal)
```

Set `PROVIDERS=mock` in `.env.local` to try the app without any API keys or spend.

## License

[MIT](LICENSE)
