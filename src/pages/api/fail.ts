import type { APIRoute } from "astro";
import { store } from "@/lib/store";

export const prerender = false;

export const GET: APIRoute = ({ url }) => {
  const word = url.searchParams.get("word") || "";
  const direction = url.searchParams.get("direction") === "suffix" ? "suffix" : "prefix";
  return Response.json({ results: store.fail(word, direction) });
};
