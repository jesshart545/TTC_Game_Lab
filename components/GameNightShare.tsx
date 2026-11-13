"use client";

import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";

// "Share this game" — the Game Night publish surface (Off-Stream
// Multiplayer Game Night). Inside a multiplayer project, once the game
// is published, this creates (or reuses) the project's play room from
// the frozen published snapshot and shows the /play/<token> link plus a
// QR code of it: the creator shares either one, friends scan or tap,
// type their name, and play — the creator plays along as a player.
// There is no host link and nothing private to leak: the play link IS
// the invitation.

type RoomInfo = { token: string; path: string; status: string; gameType: string };

export default function GameNightShare({ projectId, published }: { projectId: string; published: boolean }) {
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [qr, setQr] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const playUrl = useCallback((path: string) => {
    if (typeof window === "undefined") return path;
    return new URL(path, window.location.origin).toString();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}/game-room`, { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled && data.room) setRoom(data.room as RoomInfo);
      } catch { /* the button below still works */ }
      finally { if (!cancelled) setLoaded(true); }
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  useEffect(() => {
    if (!room) { setQr(""); return; }
    let cancelled = false;
    QRCode.toDataURL(playUrl(room.path), { width: 240, margin: 1 })
      .then(url => { if (!cancelled) setQr(url); })
      .catch(() => { if (!cancelled) setQr(""); });
    return () => { cancelled = true; };
  }, [room, playUrl]);

  async function share() {
    if (busy) return;
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch(`/api/projects/${projectId}/game-room`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) { setStatus(data.error || "Sharing didn't start — try again."); return; }
      setRoom(data.room as RoomInfo);
      setStatus("Your game night is ready to share — send the link or let friends scan the code.");
    } catch { setStatus("Sharing didn't start — check your connection and try again."); }
    finally { setBusy(false); }
  }

  async function copyLink() {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(playUrl(room.path));
      setStatus("Play link copied — send it to your players.");
    } catch { setStatus("Copy the play link from the line below."); }
  }

  return (
    <div className="workshop-publish-links game-night-share">
      <h3>🎲 Share this game night</h3>
      {!published ? (
        <p>Publish this game first — then one link (or one QR code) is all your friends need to join and play. You play along as one of the players; the game runs itself.</p>
      ) : room ? (
        <>
          <p>Send your friends the link, or let them scan the code with their phones. They type their name and they&apos;re in — no account needed. You join the same way and play along.</p>
          {qr && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="QR code for this game's play link" width={180} height={180} style={{ borderRadius: 12, background: "#fff", padding: 6 }} />
          )}
          <div>
            <button type="button" className="outline-btn" onClick={copyLink}>Copy play link</button>
            <a className="outline-btn" href={room.path} target="_blank" rel="noreferrer">Open the game lobby</a>
          </div>
          <p className="publish-url-line">Play link (share this one): <code>{playUrl(room.path)}</code></p>
        </>
      ) : (
        <>
          <p>Your game is published. Create its play link and QR code — one tap, and it&apos;s ready to share.</p>
          <div>
            <button type="button" className="outline-btn" onClick={share} disabled={busy || !loaded}>
              {busy ? "Creating your play link…" : "Share this game"}
            </button>
          </div>
        </>
      )}
      {status && <p role="status">{status}</p>}
    </div>
  );
}
