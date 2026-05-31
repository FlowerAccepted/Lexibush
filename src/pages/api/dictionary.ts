import type { APIRoute } from "astro";

export const prerender = false;

const POS_MAP: Record<string, string> = {
  noun: "n.",
  verb: "v.",
  adjective: "adj.",
  adverb: "adv.",
  pronoun: "pron.",
  preposition: "prep.",
  conjunction: "conj.",
  interjection: "int.",
};

export const GET: APIRoute = async ({ url }) => {
  const word = (url.searchParams.get("word") || "").trim();
  if (!word) return Response.json({ ok: false, error: "请输入要查询的词" }, { status: 400 });

  try {
    if (process.env.OXFORD_APP_ID && process.env.OXFORD_APP_KEY) {
      const endpoint = `https://od-api.oxforddictionaries.com/api/v2/entries/en-gb/${encodeURIComponent(word.toLowerCase())}`;
      const response = await fetch(endpoint, {
        headers: {
          app_id: process.env.OXFORD_APP_ID,
          app_key: process.env.OXFORD_APP_KEY,
        },
      });
      if (response.ok) {
        const data = await response.json();
        return Response.json({ ok: true, source: "Oxford Dictionaries", meaning: fromOxford(data) });
      }
    }

    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    if (!response.ok) throw new Error("词典没有返回结果");
    const data = await response.json();
    return Response.json({ ok: true, source: "Free Dictionary API", meaning: fromFreeDictionary(data) });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 502 });
  }
};

function fromOxford(data: any) {
  const meaning: Record<string, string> = {};
  for (const result of data?.results || []) {
    for (const lexicalEntry of result.lexicalEntries || []) {
      const pos = POS_MAP[String(lexicalEntry.lexicalCategory?.id || "").toLowerCase()] || `${lexicalEntry.lexicalCategory?.text || ""}.`;
      const definitions: string[] = [];
      for (const entry of lexicalEntry.entries || []) {
        for (const sense of entry.senses || []) {
          definitions.push(...(sense.definitions || []), ...(sense.shortDefinitions || []));
        }
      }
      if (definitions.length) meaning[pos] = Array.from(new Set(definitions)).slice(0, 3).join("; ");
    }
  }
  return meaning;
}

function fromFreeDictionary(data: any) {
  const meaning: Record<string, string> = {};
  for (const item of Array.isArray(data) ? data : []) {
    for (const block of item.meanings || []) {
      const pos = POS_MAP[String(block.partOfSpeech || "").toLowerCase()] || `${block.partOfSpeech || ""}.`;
      const definitions = (block.definitions || []).map((entry: any) => entry.definition).filter(Boolean);
      if (definitions.length) meaning[pos] = Array.from(new Set(definitions)).slice(0, 3).join("; ");
    }
  }
  return meaning;
}
