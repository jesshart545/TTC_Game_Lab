// MiniMax Music 3 returns PCM16 WAV. Cap overruns without another paid generation.
export function capMusicWav(bytes: Uint8Array, seconds: number): Uint8Array {
  if (!Number.isFinite(seconds) || seconds < 3 || seconds > 120) throw new Error("Invalid short music length.");
  const input = Buffer.from(bytes);
  if (input.toString("ascii",0,4) !== "RIFF" || input.toString("ascii",8,12) !== "WAVE") throw new Error("Short music returned an unsupported audio format.");
  let rate = 0, align = 0, dataStart = 0, dataSize = 0;
  for (let offset = 12; offset + 8 <= input.length;) {
    const size = input.readUInt32LE(offset + 4);
    if (offset + 8 + size > input.length) throw new Error("Incomplete generated audio.");
    const tag = input.toString("ascii",offset,offset+4);
    if (tag === "fmt ") {
      if (size < 16 || input.readUInt16LE(offset+8) !== 1 || input.readUInt16LE(offset+22) !== 16) throw new Error("Short music requires PCM16 audio.");
      rate = input.readUInt32LE(offset+12); align = input.readUInt16LE(offset+20);
    }
    if (tag === "data") { dataStart = offset+8; dataSize = size; break; }
    offset += 8 + size + (size % 2);
  }
  if (!rate || !align || !dataStart || align % 2) throw new Error("Invalid generated WAV audio.");
  const limit = Math.floor(seconds * rate) * align;
  if (dataSize <= limit) return bytes;
  const output = Buffer.from(input.subarray(0,dataStart+limit));
  output.writeUInt32LE(output.length-8,4);
  output.writeUInt32LE(limit,dataStart-4);
  const fadeFrames = Math.min(Math.floor(rate*0.5), Math.floor(limit/align));
  const fadeStart = dataStart+limit-fadeFrames*align;
  for (let frame=0; frame<fadeFrames; frame++) {
    const gain = (fadeFrames-1-frame)/Math.max(1,fadeFrames-1);
    for (let channel=0; channel<align/2; channel++) {
      const offset=fadeStart+frame*align+channel*2;
      output.writeInt16LE(Math.round(output.readInt16LE(offset)*gain),offset);
    }
  }
  return output;
}
