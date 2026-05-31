import type { APIRoute } from "astro";
import { store } from "@/lib/store";

export const prerender = false;

async function readBody(request: Request) {
  return request.json().catch(() => ({}));
}

export const GET: APIRoute = () => Response.json({ archives: store.archives() });

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await readBody(request);
    if (body.action === "restore") store.restore(body.hash || "");
    else store.snapshot(body.message || "Manual archive");
    return Response.json({ ok: true, archives: store.archives() });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
};
