/** Animation uses a reviewed landscape design; it must not silently redesign an image. */
export async function landscapeAnimationReference(url:string):Promise<string> {
  const image=new Image();
  await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error("The animation reference could not be loaded. Try uploading the image into Workshop again."));image.src=url;});
  if(Math.abs(image.naturalWidth/image.naturalHeight-16/9)<0.02)return url;
  throw new Error("This image needs a widescreen layout before animation. Create or upload a horizontal 16:9 version in Workshop, review it, then select it as the animation reference. Animation will not crop or add filler to this image automatically.");
}
