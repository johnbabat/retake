# Roadmap

Retake is built in milestones. Each one ends with a demo that has to work before the next one starts.

## Local / Offline Editor Track (Mock Mode)

Before wiring live external providers, the core non-linear video editor, multi-track timeline, and local FFmpeg compositor are built and verified end to end in `PROVIDERS=mock` mode using synthetic FFmpeg-generated multi-scene footage (`M2`, `M3`, `M6`, and `M8`). Live AI API calls, personal footage, and voice/character models (`M1`, `M4`, `M7`) are out of scope for this track.

- **Media ingest & shot detection (`M2`):** synthetic multi-scene clip generator, streaming upload, `ffprobe` metadata (VFR and rotation handling), 720p proxy, FFmpeg scene-score shot detection, thumbnails, and visual PCM waveform peaks
- **Shot & take edit loop (`M3`):** project editor page, manual shot split/merge, side-by-side mock takes per shot, select take or revert to original, undo/redo history
- **Multi-track timeline & compositor (`M6`):** video, audio, and keyframed text/shape overlay tracks; trim, split, slip, ripple, reorder, transitions, keyboard shortcuts, HTML5 Canvas preview, and segment-cached FFmpeg export to **WebM (VP9)** and **MP4**
- **Hardening & verification (`M8`):** spend/job breakdown view, parallel/cached segment rendering, golden-frame parity checks between Canvas preview and FFmpeg WebM output, `ffprobe`/PCM sync checks, and Playwright end-to-end tests in mock mode

**Done when:** a generated multi-scene clip ingests into shots with waveforms, supports multi-track edits (splits, trims, reorders, text overlays, and mock take replacements) with full undo/redo, exports to a playable WebM/MP4 with zero frame-count drift verified by `ffprobe`, matches Canvas preview frames within SSIM/pixel-diff bounds, and passes the Vitest + Playwright suite offline.

## M0 · Foundations ✅
- [x] Next.js app, SQLite + Drizzle, folder layout, lint, Vitest
- [x] Provider adapter interface and a mock provider (no paid calls)
- [x] Background worker with a job queue, cost ledger, and daily/monthly spend caps

**Done when:** the web app and worker run, a mock job goes from queued to done in the UI, and spend reads $0.00.

## M1 · Provider wiring
- [ ] One default provider per feature, configured through the adapter interface
- [ ] Real adapters for generation, character replacement, motion, voice and lip sync
- [ ] Automatic retry and a fallback provider when a job fails

**Done when:** each feature runs end to end on a test clip of my own footage.

## M2 · Media pipeline
- [ ] Upload with ffprobe metadata, constant-frame-rate conversion, 720p preview proxy
- [ ] Shot detection from FFmpeg scene scores, with manual split and merge
- [ ] Trim inputs for AI jobs; normalise outputs (frame rate, resolution, colour, audio)
- [ ] Export: stitch the sequence and keep the original audio

**Done when:** a 3-minute phone video uploads, splits into shots, and exports back with audio in sync.

## M3 · Core edit loop
- [ ] Project page with player, shot list and an "edit this shot" panel
- [ ] Job cards with live status and cost
- [ ] 2–3 takes side by side; pick one, or revert to the original
- [ ] Export the edited sequence

**Done when:** one shot of a real video is replaced with an AI take and exported as a watchable MP4.

## M4 · Features
- [ ] Generate a new shot from text or a frame
- [ ] Replace a character with an AI-generated fictional character
- [ ] Copy a motion from a reference clip
- [ ] Change the action: regenerate a shot from its first frame
- [ ] Change the words: edit the transcript, re-voice in my own cloned voice, lip sync
- [ ] Draft first, then finalise at higher quality

## M5 · Precision edits
- [ ] Click to select a person and track them through a shot
- [ ] Edit a time range inside a shot and blend it back
- [ ] Split shots longer than the provider limit

## M6 · Timeline
- [ ] Multi-track timeline: video, audio, text overlays
- [ ] Trim, split, reorder, keyboard shortcuts

## M7 · Assistant
- [ ] Chat panel that turns a plain-English request into an edit plan with a cost preview

## M8 · Hardening
- [ ] Spend page by feature and provider
- [ ] Faster playback, caching, parallel jobs
- [ ] End-to-end tests in mock mode

## Mobile
- [ ] Phone-friendly web layout
- [ ] Native iOS and Android app (Expo) after M4
