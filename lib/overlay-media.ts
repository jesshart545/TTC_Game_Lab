export const EXTEND_OVERLAY_PROMPT = "Extend this image into a horizontal 16:9 composition for a 1920 by 1080 livestream overlay. Preserve the entire original image, all subjects, lettering, and important details without cropping, distortion, or stretching. Outpaint additional matching artwork and scenery around it to fill the wider canvas seamlessly. Do not add black bars, blank padding, borders, or new text.";

/** Extend mismatched animation inputs with matching artwork, rather than center cropping. */
export async function landscapeAnimationReference(url:string):Promise<string> {
  const image=new Image();
  await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error("The animation reference could not be loaded. Try uploading the image into Workshop again."));image.src=url;});
  if(Math.abs(image.naturalWidth/image.naturalHeight-16/9)<0.005)return url;
  const response=await fetch("/api/edit-image",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({imageUrl:url,prompt:EXTEND_OVERLAY_PROMPT,aspectRatio:"16:9"})});
  const data=await response.json();
  if(!response.ok||!data.url)throw new Error(data.error||"Unable to extend the reference image for the overlay.");
  return data.url;
}
