import { CompositionClip, ProjectAsset } from "./project";

export async function exportCompositionVideo(clips: CompositionClip[], assets: ProjectAsset[], duration: number, name: string, report: (message: string) => void) {
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) throw new Error("Video export is not supported in this browser.");
  const audio = new AudioContext();
  const destination = audio.createMediaStreamDestination();
  const canvas = document.createElement("canvas"); canvas.width = 1280; canvas.height = 720;
  const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("Could not create the video canvas.");
  const resources: {clip: CompositionClip; media?: HTMLMediaElement; image?: HTMLImageElement; gain?: GainNode}[] = [];
  let recorder: MediaRecorder | undefined; let stream: MediaStream | undefined;
  try {
    report("Loading video, images and audio…"); await audio.resume();
    for (const clip of clips) {
      const url = assets.find(a => a.storageKey && a.storageKey === clip.storageKey)?.url || clip.url;
      if (["video","voice","music","sfx"].includes(clip.track)) {
        if (!url) throw new Error("Missing media: " + clip.assetName);
        const element = document.createElement(clip.track === "video" ? "video" : "audio") as HTMLMediaElement;
        element.crossOrigin = "anonymous"; element.preload = "auto"; element.src = url;
        await new Promise<void>((resolve,reject) => {
          const timeout = window.setTimeout(() => reject(new Error("Timed out loading " + clip.assetName)),30000);
          element.onloadeddata = () => {clearTimeout(timeout);resolve();};
          element.onerror = () => {clearTimeout(timeout);reject(new Error("Cannot load " + clip.assetName + ". Check the file and media access permissions."));};
          element.load();
        });
        element.playbackRate = clip.playbackRate || 1;
        element.currentTime = clip.trimStart || 0;
        const gain = audio.createGain(); gain.gain.value = 0;
        audio.createMediaElementSource(element).connect(gain).connect(destination);
        resources.push({clip,media:element,gain});
      } else if (clip.track === "visual") {
        if (!url) throw new Error("Missing image: " + clip.assetName);
        const image = new Image(); image.crossOrigin = "anonymous"; image.src = url;
        await image.decode(); resources.push({clip,image});
      } else resources.push({clip});
    }
    // Reject canvas access failures before recording rather than exporting a blank video.
    for (const item of resources) {if(item.image)ctx.drawImage(item.image,0,0,1,1);if(item.media instanceof HTMLVideoElement)ctx.drawImage(item.media,0,0,1,1);}
    ctx.getImageData(0,0,1,1);
    stream = canvas.captureStream(30); destination.stream.getAudioTracks().forEach(track => stream!.addTrack(track));
    const mime = ["video/webm;codecs=vp9,opus","video/webm;codecs=vp8,opus","video/webm","video/mp4"].find(type => MediaRecorder.isTypeSupported(type));
    if (!mime) throw new Error("No supported video export format was found.");
    recorder = new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:5000000});
    const chunks: Blob[] = [];
    const completed = new Promise<Blob>((resolve,reject) => {
      recorder!.ondataavailable = event => {if(event.data.size)chunks.push(event.data);};
      recorder!.onerror = () => reject(new Error("Video recording failed."));
      recorder!.onstop = () => resolve(new Blob(chunks,{type:mime}));
    });
    recorder.start(250);
    const started = performance.now();
    await new Promise<void>((resolve,reject) => {
      const draw = () => {
        const time = (performance.now()-started)/1000;
        if(time>=duration){resolve();return;}
        try {
          ctx.fillStyle="#000";ctx.fillRect(0,0,canvas.width,canvas.height);
          for(const item of resources) {
            const {clip,media,image,gain}=item;
            const active=time>=clip.start && time<clip.start+clip.duration;
            const fade=Math.max(0,Math.min(1,clip.fadeIn?(time-clip.start)/clip.fadeIn:1,clip.fadeOut?(clip.start+clip.duration-time)/clip.fadeOut:1));
            if(media){
              if(!active){media.pause();if(gain)gain.gain.value=0;continue;}
              if(gain)gain.gain.value=(clip.volume??1)*fade;
              if(media.ended && clip.loop){media.currentTime=clip.trimStart||0;}
              if(media.paused && !media.ended)void media.play().catch(reject);
            }
            if(!active)continue;
            ctx.save();ctx.globalAlpha=fade;
            const visual=image || (media instanceof HTMLVideoElement?media:undefined);
            if(visual){const w=image?image.naturalWidth:(media as HTMLVideoElement).videoWidth;const h=image?image.naturalHeight:(media as HTMLVideoElement).videoHeight;const scale=Math.min(canvas.width/w,canvas.height/h);ctx.drawImage(visual,(canvas.width-w*scale)/2,(canvas.height-h*scale)/2,w*scale,h*scale);}
            if(clip.track==="text"){ctx.fillStyle="#fff";ctx.font="bold 48px sans-serif";ctx.textAlign="center";ctx.fillText(clip.text||"",640,620,1160);}
            if(clip.track==="effect") throw new Error("Remove effect clips before video export. Rendered effect export is not available yet.");
            ctx.restore();
          }
          report("Rendering video: "+Math.round(time/duration*100)+"% (keep this tab open)");
          requestAnimationFrame(draw);
        }catch(error){reject(error);}
      };draw();
    });
    recorder.stop(); const blob=await completed;
    if(!blob.size)throw new Error("Video export produced an empty file.");
    const url=URL.createObjectURL(blob);const link=document.createElement("a");link.href=url;link.download=(name.replace(/[^a-z0-9_-]/gi,"_")||"composition")+(mime.includes("mp4")?".mp4":".webm");link.click();window.setTimeout(()=>URL.revokeObjectURL(url),60000);
    report("Video exported with its mixed voice, music and sound tracks.");
  } finally {
    if(recorder && recorder.state!=="inactive")recorder.stop();
    resources.forEach(item=>{item.media?.pause();if(item.media){item.media.removeAttribute("src");item.media.load();}});
    stream?.getTracks().forEach(track=>track.stop());await audio.close();
  }
}
