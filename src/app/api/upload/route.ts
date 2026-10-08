import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { PERMISSIONS } from "@/lib/permissions";
import { assertPermission, assertViewer, NotAuthorised } from "@/server/session";
import { MEDIA_LIMITS, type MediaKind } from "@/components/learning/model";

/**
 * Issues one-time upload tokens for learning media.
 *
 * The file itself goes straight from the administrator's browser to Vercel
 * Blob — a video never passes through this server, which could not accept it
 * anyway (request bodies are capped at a few megabytes). This route only
 * decides whether *this* person may upload *this* kind of file, and how big.
 * Saving the resulting URL against a short, document or chapter is a separate
 * server action that checks permission again.
 */
export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const kind = (clientPayload ?? "") as MediaKind;
        const limit = MEDIA_LIMITS[kind as "video" | "pdf" | "image"];
        if (!limit || !("types" in limit)) throw new Error("Unknown kind of file.");
        if (/^reports\/(screenshots|evidence)\//.test(pathname)) {
          // screenshots on a problem report, and an admin's evidence of the
          // fix: anyone signed in, images only
          await assertViewer();
          if (kind !== "image") throw new Error("Only images can be attached to a report.");
        } else if (/^learning\/(shorts|documents|chapters|posters)\//.test(pathname)) {
          await assertPermission(PERMISSIONS.MANAGE_LMS);
        } else {
          throw new Error("Unexpected upload location.");
        }
        return {
          allowedContentTypes: [...limit.types],
          maximumSizeInBytes: limit.maxMB * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
      // the record is saved by the screen's own server action once the upload
      // finishes, so nothing needs to happen when Vercel confirms it
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(result);
  } catch (err) {
    const status = err instanceof NotAuthorised ? 403 : 400;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload refused." },
      { status },
    );
  }
}
