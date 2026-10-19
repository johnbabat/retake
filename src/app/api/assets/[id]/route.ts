import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { eq } from "drizzle-orm";
import { connection } from "next/server";
import { config } from "@/server/config";
import { db } from "@/server/db/client";
import { assets } from "@/server/db/schema";

/** Streams a media file, with byte-range support so <video> can seek. */
export async function GET(request: Request, ctx: RouteContext<"/api/assets/[id]">) {
  await connection();
  const { id } = await ctx.params;
  const asset = await db().query.assets.findFirst({ where: eq(assets.id, id) });
  if (!asset) return new Response("Not found", { status: 404 });

  // Only ever serve files inside the data folder.
  const root = resolve(config().dataDir);
  const file = resolve(root, asset.path);
  if (!file.startsWith(root + sep)) return new Response("Not found", { status: 404 });

  const size = (await stat(file)).size;
  const type = asset.mimeType ?? "application/octet-stream";
  const range = /bytes=(\d*)-(\d*)/.exec(request.headers.get("range") ?? "");

  if (!range) {
    return new Response(body(file), {
      headers: { "Content-Type": type, "Content-Length": String(size), "Accept-Ranges": "bytes" },
    });
  }

  const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
  const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
  if (start >= size || start > end) {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  }
  return new Response(body(file, start, end), {
    status: 206,
    headers: {
      "Content-Type": type,
      "Content-Length": String(end - start + 1),
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Accept-Ranges": "bytes",
    },
  });
}

function body(file: string, start?: number, end?: number) {
  return Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream;
}
