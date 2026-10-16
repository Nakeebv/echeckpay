import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import {
  UploadRejected,
  recentUploadCount,
  storeFile,
  type FileCategory,
} from "@/lib/filestore";

export const dynamic = "force-dynamic";

const CATEGORIES: FileCategory[] = [
  "logo_bank",
  "logo_company",
  "signature",
  "micr_font",
  "check_pdf",
  "profile",
  "other",
];

/**
 * Multipart upload. Validation order: auth → category → size (content-length
 * then bytes) → rate limits → extension/MIME — magic bytes are sniffed in
 * filestore. The server picks the object key; client filenames are metadata.
 */
export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ errors: ["Expected multipart/form-data."] }, { status: 400 });
  }

  const category = String(form.get("category") ?? "");
  if (!CATEGORIES.includes(category as FileCategory)) {
    return NextResponse.json({ errors: ["Unknown file category."] }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ errors: ["file is required (multipart)."] }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  try {
    const stored = await storeFile({
      userId: auth.user.id,
      category: category as FileCategory,
      bytes,
      originalName: file.name,
    });
    return NextResponse.json({ file: stored }, { status: 201 });
  } catch (error) {
    if (error instanceof UploadRejected) {
      return NextResponse.json(
        { errors: [error.message], code: error.code },
        { status: error.code === "r2_unavailable" ? 503 : 415 },
      );
    }
    return NextResponse.json({ errors: ["Upload failed."] }, { status: 500 });
  }
}

export async function GET() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const recent = await recentUploadCount(auth.user.id);
  return NextResponse.json({ recentUploads: recent });
}
