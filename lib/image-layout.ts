import type { ProjectAssetEdits } from "./project";

/** Shared geometry for the editor preview and the permanent PNG copy. */
export function imageLayout(sourceWidth: number, sourceHeight: number, edits: ProjectAssetEdits = {}) {
  const ratio = edits.crop === "square" ? 1 : edits.crop === "portrait" ? 9 / 16 : edits.crop === "landscape" ? 16 / 9 : sourceWidth / sourceHeight;
  const pixel = (value: number) => Math.max(1, Math.min(4096, Math.round(value)));
  const width = pixel(edits.width || (edits.height ? edits.height * ratio : sourceWidth));
  const height = pixel(edits.height || width / ratio);
  const fit = edits.fit || (edits.crop && edits.crop !== "original" ? "cover" : "contain");
  const scale = fit === "cover" ? Math.max(width / sourceWidth, height / sourceHeight) : Math.min(width / sourceWidth, height / sourceHeight);
  const drawWidth = fit === "fill" ? width : sourceWidth * scale;
  const drawHeight = fit === "fill" ? height : sourceHeight * scale;
  return { width, height, ratio: width / height, fit, drawWidth, drawHeight };
}

export function imageAspectRatio(edits: ProjectAssetEdits): string {
  if (edits.width && edits.height) {
    const ratio = edits.width / edits.height;
    return (["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "21:9"] as const)
      .reduce((best, value) => {
        const number = (text: string) => { const [w,h] = text.split(":").map(Number); return w/h; };
        return Math.abs(Math.log(number(value)/ratio)) < Math.abs(Math.log(number(best)/ratio)) ? value : best;
      });
  }
  return edits.crop === "square" ? "1:1" : edits.crop === "portrait" ? "9:16" : edits.crop === "landscape" ? "16:9" : "auto";
}
