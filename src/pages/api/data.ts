import type { APIRoute } from "astro";
import { store } from "@/lib/store";

export const prerender = false;

export const GET: APIRoute = () => Response.json(store.overview());
