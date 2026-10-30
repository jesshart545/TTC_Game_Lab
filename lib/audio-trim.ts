// Decode an audio file, cut the [start, end] slice, and encode it as a
// 16-bit PCM WAV blob. Used by the audio trim editor so music, voice and
// sound-effect assets can be shortened like videos already could.

export async function trimAudioToWav(sourceUrl: string, startSeconds: number, endSeconds: number): Promise<Blob> {
  const response = await fetch(sourceUrl);
  if (!response.ok) throw new Error("Could not load audio for trimming.");
  const bytes = await response.arrayBuffer();
  const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) throw new Error("Audio trimming is not supported in this browser.");
  const context = new AudioContextCtor();
  try {
    const buffer = await context.decodeAudioData(bytes);
    const start = Math.max(0, startSeconds || 0);
    const end = Math.min(endSeconds || buffer.duration, buffer.duration);
    if (!Number.isFinite(end) || end <= start + 0.05) throw new Error("Choose a valid audio trim range.");
    return encodeWav(buffer, start, end);
  } finally {
    void context.close().catch(() => undefined);
  }
}

function encodeWav(buffer: AudioBuffer, start: number, end: number): Blob {
  const sampleRate = buffer.sampleRate;
  const channels = Math.max(1, buffer.numberOfChannels);
  const startFrame = Math.floor(start * sampleRate);
  const endFrame = Math.min(buffer.length, Math.ceil(end * sampleRate));
  const frames = Math.max(1, endFrame - startFrame);
  const bytesPerSample = 2;
  const dataSize = frames * channels * bytesPerSample;
  const out = new ArrayBuffer(44 + dataSize);
  const view = new DataView(out);
  const writeText = (offset: number, text: string) => { for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i)); };
  writeText(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * bytesPerSample, true);
  view.setUint16(32, channels * bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, dataSize, true);
  const channelData: Float32Array[] = [];
  for (let channel = 0; channel < channels; channel += 1) channelData.push(buffer.getChannelData(channel));
  let offset = 44;
  for (let frame = startFrame; frame < endFrame; frame += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const sample = Math.max(-1, Math.min(1, channelData[channel][frame] || 0));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([out], { type: "audio/wav" });
}
