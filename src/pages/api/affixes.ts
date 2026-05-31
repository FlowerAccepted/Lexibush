import type { APIRoute } from "astro";
import { store } from "@/lib/store";

export const prerender = false;

async function readBody(request: Request) {
  return request.json().catch(() => ({}));
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await readBody(request);
    if (body.action === "import") {
      return Response.json({ ok: true, result: store.importAffixes(body.input || "", body.format || "auto") });
    }
    if (body.action === "seed") {
      return Response.json({ ok: true, count: store.seedAffixes() });
    }
    const meanings = Array.isArray(body.meanings)
      ? body.meanings
      : String(body.meanings || "").split(";").map((part) => part.trim()).filter(Boolean);
    const entry = store.addAffix(body.affix || "", body.type || "root", meanings);
    return Response.json({ ok: true, entry });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
};

export const DELETE: APIRoute = async ({ request }) => {
  try {
    const body = await readBody(request);
    store.deleteAffix(body.affix || "");
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
};
