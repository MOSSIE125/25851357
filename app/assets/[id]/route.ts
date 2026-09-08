import { NextRequest } from "next/server";
import { database, readPublished, sessionValid, uploadsDir } from "@/lib/db";
import { flatten } from "@/lib/model";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^[a-f0-9-]{36}$/.test(id))
    return new Response("Not found", { status: 404 });
  const isPublished = flatten(readPublished().root).some(
    (n) => n.config.src === `/assets/${id}`,
  );
  if (
    !isPublished &&
    !sessionValid(request.cookies.get("porter_session")?.value)
  )
    return new Response("Not found", { status: 404 });
  const db = database();
  try {
    const row = db.prepare("SELECT mime FROM assets WHERE id=?").get(id) as
      { mime: string } | undefined;
    if (!row) return new Response("Not found", { status: 404 });
    return new Response(await readFile(join(uploadsDir(), id)), {
      headers: {
        "Content-Type": row.mime,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } finally {
    db.close();
  }
}
