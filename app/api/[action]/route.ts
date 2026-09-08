import { NextRequest, NextResponse } from "next/server";
import {
  csrf,
  readDraft,
  readPublished,
  sessionValid,
  signIn,
  signOut,
  writeContent,
  database,
  requireConfig,
  uploadsDir,
} from "@/lib/db";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const reply = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ action: string }> },
) {
  try {
    const { action } = await params;
    if (action === "published") return reply({ content: readPublished() });
    const token = request.cookies.get("porter_session")?.value;
    if (!sessionValid(token))
      return reply({ error: "Owner sign-in required." }, 401);
    if (action === "draft")
      return reply({ ...readDraft(), csrf: csrf(token!) });
    if (action === "assets") {
      const db = database();
      try {
        return reply({
          assets: db.prepare("SELECT id,mime,filename,size FROM assets").all(),
        });
      } finally {
        db.close();
      }
    }
    return reply({ error: "Not found" }, 404);
  } catch (e) {
    return reply(
      { error: e instanceof Error ? e.message : "Read failed" },
      503,
    );
  }
}
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ action: string }> },
) {
  try {
    requireConfig();
    if (request.headers.get("origin") !== process.env.APP_ORIGIN)
      return reply({ error: "Origin rejected." }, 403);
    const { action } = await params;
    if (Number(request.headers.get("content-length") || 0) > 8 * 1024 * 1024)
      return reply({ error: "Request exceeds 8 MB." }, 413);
    if (action === "login") {
      const { password } = await request.json();
      if (typeof password !== "string" || password.length > 500)
        return reply({ error: "Invalid password" }, 400);
      const token = signIn(password);
      const response = reply({ ok: true });
      response.cookies.set("porter_session", token, {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.COOKIE_SECURE === "true",
        path: "/",
        maxAge: 28800,
      });
      return response;
    }
    const token = request.cookies.get("porter_session")?.value;
    if (!sessionValid(token))
      return reply({ error: "Owner sign-in required." }, 401);
    if (request.headers.get("x-csrf-token") !== csrf(token!))
      return reply({ error: "CSRF token rejected." }, 403);
    if (action === "logout") {
      signOut(token!);
      const response = reply({ ok: true });
      response.cookies.delete("porter_session");
      return response;
    }
    if (action === "upload") {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File) || file.size > 5 * 1024 * 1024)
        throw Error("Choose a PNG, JPEG or WebP up to 5 MB.");
      const buffer = Buffer.from(await file.arrayBuffer());
      const png = buffer
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      const jpeg = buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255;
      const webp =
        buffer.toString("ascii", 0, 4) === "RIFF" &&
        buffer.toString("ascii", 8, 12) === "WEBP";
      const mime = png
        ? "image/png"
        : jpeg
          ? "image/jpeg"
          : webp
            ? "image/webp"
            : "";
      if (!mime || mime !== file.type)
        throw Error(
          "Unsupported image or file signature. Previous image retained.",
        );
      const id = randomUUID();
      await mkdir(uploadsDir(), { recursive: true });
      await writeFile(join(uploadsDir(), id), buffer, { flag: "wx" });
      const db = database(true);
      try {
        db.prepare("INSERT INTO assets VALUES(?,?,?,?,?)").run(
          id,
          mime,
          file.name.slice(0, 200),
          file.size,
          new Date().toISOString(),
        );
      } finally {
        db.close();
      }
      return reply({ src: `/assets/${id}` });
    }
    if (action === "draft" || action === "publish") {
      const body = await request.json();
      if (!Number.isInteger(body.version)) throw Error("Version is required.");
      return reply(
        writeContent(body.content, body.version, action === "publish"),
      );
    }
    return reply({ error: "Not found" }, 404);
  } catch (e) {
    const error = e instanceof Error ? e.message : "Write failed";
    return reply(
      { error },
      error.startsWith("CONFLICT")
        ? 409
        : error.includes("password")
          ? 401
          : 400,
    );
  }
}
