import { NextResponse } from "next/server";
import { getAssetUrl, putAsset } from "../../../lib/object-storage";

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "asset";
}

export async function POST(request: Request) {
  try {
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
