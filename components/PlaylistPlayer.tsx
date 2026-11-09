"use client";

import { useEffect, useRef, useState } from "react";
import type { ProjectAsset } from "../lib/project";

/**
 * The player for a pool whose assets are audio (owner request,
 * 2026-11-08 — "a way to play a zip playlist"): one audio element
 * walks the pool's tracks in pool order, with Play/Pause, Next and
 * Previous, a clickable track list, and automatic advance when a
 * track ends; the last track stops instead of looping. Playback
 * state is local to this component — nothing about it is saved into
 * the project record.
 */
export default function PlaylistPlayer({ poolName, tracks }: { poolName: string; tracks: ProjectAsset[] }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pendingPlay = useRef(false);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const currentIndex = Math.min(index, Math.max(0, tracks.length - 1));
  const current = tracks[currentIndex];

  // When a different track becomes current and a play was requested
  // (a list click, Next/Previous while playing, auto-advance), start
  // it once the new source is in place.
  useEffect(() => {
    if (pendingPlay.current) {
      pendingPlay.current = false;
      void audioRef.current?.play().catch(() => {});
    }
  }, [currentIndex]);

  if (!current) return null;
  const trackKey = (track: ProjectAsset) => track.storageKey || track.name;

  function choose(nextIndex: number, play: boolean) {
    if (nextIndex === currentIndex) {
      if (play) void audioRef.current?.play().catch(() => {});
      return;
    }
    pendingPlay.current = play;
    setIndex(nextIndex);
  }

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) audio.pause();
    else void audio.play().catch(() => {});
  }

  return (
    <div className="pool-playlist" aria-label={`Playlist player for ${poolName}`}>
      <div className="pool-playlist-controls">
        <button type="button" onClick={() => choose(currentIndex - 1, playing)} disabled={currentIndex === 0} aria-label="Previous track">⏮ Prev</button>
        <button type="button" onClick={toggle} aria-label={playing ? `Pause ${current.name}` : `Play ${current.name}`}>{playing ? "⏸ Pause" : "▶ Play"}</button>
        <button type="button" onClick={() => choose(currentIndex + 1, playing)} disabled={currentIndex >= tracks.length - 1} aria-label="Next track">Next ⏭</button>
        <span className="pool-playlist-now">{currentIndex + 1} of {tracks.length} · {current.name}</span>
      </div>
      <ol className="pool-playlist-tracks">
        {tracks.map((track, i) => (
          <li key={trackKey(track)}>
            <button type="button" aria-current={i === currentIndex || undefined} onClick={() => choose(i, true)}>
              {i === currentIndex && playing ? "▶ " : ""}{track.name}
            </button>
          </li>
        ))}
      </ol>
      <audio
        ref={audioRef}
        src={current.url}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { if (currentIndex < tracks.length - 1) choose(currentIndex + 1, true); else setPlaying(false); }}
      />
    </div>
  );
}
