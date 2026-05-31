import type { APIRoute } from "astro";
import { store } from "@/lib/store";
import type { SearchMode } from "@/lib/search";

export const prerender = false;

export const GET: APIRoute = ({ url }) => {
  const query = url.searchParams.get("q") || "";
  const mode = (url.searchParams.get("mode") || "contains") as SearchMode;
  return Response.json({ results: store.search(query, mode) });
};
