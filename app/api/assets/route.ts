import { NextResponse } from "next/server";
import { deleteAssetsByPrefix, getAssetUrl, putAsset } from "../../../lib/object-storage";

export const runtime = "nodejs";
export const maxDuration = 300;

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "asset";
}

export async function POST(request: Request) {
  try {
    if ((request.headers.get("content-type") || "").includes("application/json")) {
      const body = await request.json();
      const source = new URL(String(body.sourceUrl || ""));
      if (source.protocol !== "https:" || source.username || source.password ||
          !(source.hostname === "fal.media" || source.hostname.endsWith(".fal.media"))) {
        return NextResponse.json({ error: "Unsupported generated media source." }, { status: 400 });
      }
      const response = await fetch(source, { redirect: "error", signal: AbortSignal.timeout(120000) });
      if (!response.ok) throw new Error("Unable to download generated media.");
      const maximum = 64 * 1024 * 1024;
      if (Number(response.headers.get("content-length") || 0) > maximum) throw new Error("Generated media exceeds the 64 MB limit.");
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length > maximum) throw new Error("Generated media exceeds the 64 MB limit.");
      const name = String(body.name || "Generated media");
      const type = response.headers.get("content-type") || "application/octet-stream";
      const key = `projects/${safeName(String(body.projectId || "unassigned"))}/${crypto.randomUUID()}-${safeName(name)}`;
      await putAsset(key, bytes, type);
      return NextResponse.json({ name, type, storageKey: key, url: await getAssetUrl(key) });
    }
    const form = await request.formData();
    const file = form.get("file");
    const projectId = String(form.get("projectId") || "unassigned");
    if (!(file instanceof File)) return NextResponse.json({ error: "A file is required." }, { status: 400 });

    const key = `projects/${safeName(projectId)}/${crypto.randomUUID()}-${safeName(file.name)}`;
    await putAsset(key, new Uint8Array(await file.arrayBuffer()), file.type);
    const url = await getAssetUrl(key);
    return NextResponse.json({ name: file.name, type: file.type || "application/octet-stream", storageKey: key, url });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Asset upload failed." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("key") || "";
  if (!/^projects\/[^/]+\/[^/]+$/.test(key)) return NextResponse.json({ error: "Invalid asset key." }, { status: 400 });
  try { return NextResponse.json({ url: await getAssetUrl(key) }); }
  catch { return NextResponse.json({ error: "Could not refresh the asset URL." }, { status: 500 }); }
}

export async function DELETE(request: Request) {
  const key = new URL(request.url).searchParams.get("key") || "";
  if (!/^projects\/[^/]+\/[^/]+$/.test(key)) return NextResponse.json({ error: "Invalid asset key." }, { status: 400 });
  try { const deleted = await deleteAssetsByPrefix(key); return NextResponse.json({ deleted }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Asset delete failed." }, { status: 500 }); }
}
