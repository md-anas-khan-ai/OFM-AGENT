// Vercel serverless function. Keeps the API key and system prompt on the server.
import { SYSTEM_PROMPT } from "../lib/systemPrompt.js";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const MAX_MESSAGES = 20;
const MAX_CHARS = 3000;

function cleanMessages(input) {
  if (!Array.isArray(input) || input.length === 0) return null;
  const trimmed = input.slice(-MAX_MESSAGES);
  const out = [];
  for (const m of trimmed) {
    if (!m || (m.role !== "user" && m.role !== "assistant")) return null;
    if (typeof m.content !== "string" || !m.content.trim()) return null;
    out.push({ role: m.role, content: m.content.slice(0, MAX_CHARS) });
  }
  // The API needs the conversation to start with a user turn and end with one.
  while (out.length && out[0].role !== "user") out.shift();
  if (!out.length || out[out.length - 1].role !== "user") return null;
  // Merge back to back turns of the same role so roles alternate.
  const merged = [];
  for (const m of out) {
    const last = merged[merged.length - 1];
    if (last && last.role === m.role) last.content += "\n\n" + m.content;
    else merged.push({ ...m });
  }
  return merged;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "POST only" });
  }

  const appPassword = process.env.APP_PASSWORD;
  if (appPassword && req.headers["x-app-password"] !== appPassword) {
    return res.status(401).json({ error: "wrong password" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "server is missing ANTHROPIC_API_KEY" });
  }

  const body = typeof req.body === "string" ? safeParse(req.body) : req.body;
  const messages = cleanMessages(body && body.messages);
  if (!messages) {
    return res.status(400).json({ error: "bad request: send a messages array ending with a user message" });
  }

  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 600,
        system: SYSTEM_PROMPT,
        messages,
      }),
    });

    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const msg = (data && data.error && data.error.message) || "upstream error";
      return res.status(502).json({ error: msg });
    }

    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    if (!text) {
      const why = data.stop_reason === "refusal" ? "the model declined this one, try rewording or skip it" : "empty reply, try again";
      return res.status(502).json({ error: why });
    }
    return res.status(200).json({ reply: text });
  } catch (err) {
    return res.status(502).json({ error: "could not reach the model" });
  }
}

function safeParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
