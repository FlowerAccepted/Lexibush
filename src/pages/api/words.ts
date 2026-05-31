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
      return Response.json({ ok: true, result: store.importWords(body.input || "", body.format || "auto") });
    }
    if (body.action === "update") {
      return Response.json({ ok: true, entry: store.updateWord(body.original || body.word, body.entry || {}) });
    }
    const entry = store.addWord(body.word || "", body.meaning || {}, body.notes || "", body.tags || []);
    return Response.json({ ok: true, entry });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
};

export const DELETE: APIRoute = async ({ request }) => {
  try {
    const body = await readBody(request);
    store.deleteWord(body.word || "");
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
};
