import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { deleteFile, getFileRow } from "@/lib/filestore";
import { r2Get } from "@/lib/r2";

export const dynamic = "force-dynamic";

/**
 * Authorized download. Private files: owner (or admin) only. Public files:
 * anyone — but still streamed through the server so access rules stay in one
 * place. Never a raw bucket URL.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  const { id } = await params;
  const row = await getFileRow(id);
  if (!row || row.status !== "active") return NextResponse.json({ errors: ["Not found."] }, { status: 404 });

  const isOwner = row.ownerUserId === user.id;
  const isAdmin = user.role === "admin";
  if (row.accessLevel !== "public" && !isOwner && !isAdmin) {
    return NextResponse.json({ errors: ["Forbidden."] }, { status: 403 });
  }

  const object = await r2Get(row.objectKey);
  if (!object) return NextResponse.json({ errors: ["Object missing."] }, { status: 404 });

  // SVG executes in <img>-less contexts — force a safe serving posture.
  const isSvg = row.mime === "image/svg+xml";
  const headers: Record<string, string> = {
    "content-length": String(object.bytes.length),
    "cache-control": isOwner ? "private, max-age=86400" : "public, max-age=86400",
    "x-content-type-options": "nosniff",
    "content-security-policy": "default-src 'none'",
    "content-disposition": isSvg ? `attachment; filename="${row.originalName}"` : `inline; filename="${row.originalName}"`,
  };
  if (!isSvg) headers["content-type"] = row.mime;

  return new NextResponse(object.bytes as unknown as BodyInit, { headers });
}

/** Owner-only delete (soft row + bucket delete). */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const result = await deleteFile(auth.user.id, id);
  if (!result.ok) return NextResponse.json({ errors: ["Not found or not yours."] }, { status: 404 });
  return NextResponse.json({ ok: true });
}
