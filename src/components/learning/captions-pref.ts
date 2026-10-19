"use client";

import { useCallback, useEffect, useSyncExternalStore, type RefObject } from "react";

/**
 * Whether the viewer wants subtitles, remembered on this device and shared by
 * every player on the page — turning them off on one short turns them off for
 * the rest of the feed. On unless the viewer said otherwise.
 */
const KEY = "1moby-captions";
const EVENT = "1moby-captions-change";

function read() {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useCaptionsPref(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(subscribe, read, () => true);
  const set = useCallback((next: boolean) => {
    try {
      localStorage.setItem(KEY, next ? "on" : "off");
    } catch {
      // private mode: the choice lasts until the page is left
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [on, set];
}

/** Show or hide a video's subtitle track to match the viewer's choice. */
export function useTrackMode(video: RefObject<HTMLVideoElement | null>, on: boolean, ready: unknown) {
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    const apply = () => {
      for (const t of Array.from(v.textTracks)) {
        if (t.kind === "subtitles" || t.kind === "captions") t.mode = on ? "showing" : "hidden";
      }
    };
    apply();
    // the <track> can arrive after the video does
    v.textTracks.addEventListener("addtrack", apply);
    return () => v.textTracks.removeEventListener("addtrack", apply);
  }, [video, on, ready]);
}
