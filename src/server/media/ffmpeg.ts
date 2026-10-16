import { spawn } from "node:child_process";

export class FfmpegError extends Error {
  constructor(
    message: string,
    readonly stderr: string,
  ) {
    super(message);
  }
}

/** Run a binary with an argument list (never through a shell). */
export function run(bin: "ffmpeg" | "ffprobe", args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (err) => reject(new FfmpegError(`${bin} failed to start: ${err.message}`, stderr)));
    child.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new FfmpegError(`${bin} exited with code ${code}`, stderr.slice(-2000)));
    });
  });
}

export type ProbeResult = {
  durationMs: number | null;
  width: number | null;
  height: number | null;
  fps: number | null;
  hasAudio: boolean;
};

/** Read basic metadata from a media file with ffprobe. */
export async function probe(path: string): Promise<ProbeResult> {
  const out = await run("ffprobe", [
    "-v", "error",
    "-print_format", "json",
    "-show_format",
    "-show_streams",
    path,
  ]);
  const info = JSON.parse(out) as {
    format?: { duration?: string };
    streams?: { codec_type?: string; width?: number; height?: number; avg_frame_rate?: string }[];
  };
  const video = info.streams?.find((s) => s.codec_type === "video");
  const duration = Number(info.format?.duration);
  return {
    durationMs: Number.isFinite(duration) ? Math.round(duration * 1000) : null,
    width: video?.width ?? null,
    height: video?.height ?? null,
    fps: parseRate(video?.avg_frame_rate),
    hasAudio: Boolean(info.streams?.some((s) => s.codec_type === "audio")),
  };
}

function parseRate(rate: string | undefined): number | null {
  if (!rate) return null;
  const [num, den] = rate.split("/").map(Number);
  if (!num || !den) return null;
  return Math.round((num / den) * 1000) / 1000;
}

/** Render a short H.264 test-pattern clip, used by the mock provider. */
export async function renderTestPattern(
  outPath: string,
  opts: { seconds: number; width?: number; height?: number },
) {
  const { seconds, width = 1280, height = 720 } = opts;
  await run("ffmpeg", [
    "-y",
    "-hide_banner",
    "-loglevel", "error",
    "-f", "lavfi",
    "-i", `testsrc2=size=${width}x${height}:rate=30:duration=${seconds}`,
    "-f", "lavfi",
    "-i", `sine=frequency=440:duration=${seconds}`,
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-shortest",
    outPath,
  ]);
}
