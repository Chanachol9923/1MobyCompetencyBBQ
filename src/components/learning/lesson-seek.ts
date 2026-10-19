/**
 * "Play chapter 2 from 3:15" — asked for by a transcript line or by a citation
 * in an assistant answer, and carried out by whichever video is on screen.
 * When the chapter is not the one showing, the player switches to it first and
 * the new video picks the request up as soon as it has loaded.
 */

export const SEEK_EVENT = "lesson:seek";
export type SeekRequest = { chapterId: string; sec: number };

let pending: SeekRequest | null = null;

export function seekTo(chapterId: string, sec: number) {
  pending = { chapterId, sec };
  window.dispatchEvent(new CustomEvent<SeekRequest>(SEEK_EVENT, { detail: pending }));
}

/** A video that has just loaded takes the waiting request if it is for it. */
export function takePendingSeek(chapterId: string): number | null {
  if (pending?.chapterId !== chapterId) return null;
  const sec = pending.sec;
  pending = null;
  return sec;
}
