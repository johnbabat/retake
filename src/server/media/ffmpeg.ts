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
