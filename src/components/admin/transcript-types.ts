/** Shapes for the subtitle controls in the learning admin (kept out of the "use server" module). */

export type TranscriptState = {
  status: "PENDING" | "PROCESSING" | "READY" | "FAILED";
  /** 0-100 */
  percent: number;
  /** subtitle lines so far */
  cues: number;
  error: string | null;
  hasSummary: boolean;
  summaryError: string | null;
  /** lines the AI check changed */
  corrected: number;
  /** false until TYPHOON_API_KEY is set */
  enabled: boolean;
};

export type TranscriptAdminCue = {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
  edited: boolean;
  /** what speech recognition heard, when the AI check changed the line */
  rawText: string | null;
};
