import "server-only";
import { RequestError } from "@/lib/metrics";

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new RequestError(400, "Send a JSON body with Content-Type: application/json.");
  }
}

/** Runs a handler, answering a RequestError with its status and message as `{ "error": ... }`. */
export async function respond(handler: () => Promise<Response>): Promise<Response> {
  try {
    return await handler();
  } catch (error) {
    if (error instanceof RequestError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
