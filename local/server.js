// Local version: serves index.html and answers /api/generate using Ollama on your own computer.
// No API key, no cost, nothing leaves your machine. Run with:  node local/server.js
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getSystemPrompt } from "../lib/systemPrompt.js";
import { finalize, optsFromMessages } from "../lib/postprocess.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INDEX = path.join(__dirname, "..", "index.html");

const PORT = Number(process.env.PORT || 3000);
const OLLAMA_URL = (process.env.OLLAMA_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
const MODEL = process.env.OLLAMA_MODEL || "llama3.1:8b";
const MAX_MESSAGES = 20;
const MAX_CHARS = 3000;

function send(res, code, obj) {
  res.writeHead(code, { "content-type": "application/json" });
  res.end(JSON.stringify(obj));
}

function readBody(req, limit = 200000) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) { reject(new Error("too big")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function cleanMessages(input) {
  if (!Array.isArray(input) || !input.length) return null;
  const out = [];
  for (const m of input.slice(-MAX_MESSAGES)) {
    if (!m || (m.role !== "user" && m.role !== "assistant")) return null;
    if (typeof m.content !== "string" || !m.content.trim()) return null;
    out.push({ role: m.role, content: m.content.slice(0, MAX_CHARS) });
  }
  while (out.length && out[0].role !== "user") out.shift();
  if (!out.length || out[out.length - 1].role !== "user") return null;
  return out;
}

async function generate(req, res) {
  let body;
  try { body = JSON.parse(await readBody(req)); } catch { return send(res, 400, { error: "bad request" }); }
  const messages = cleanMessages(body && body.messages);
  if (!messages) return send(res, 400, { error: "bad request: send a messages array ending with a user message" });
  const mode = body.mode === "ppv" ? "ppv" : "chat";

  let r;
  try {
    r = await fetch(OLLAMA_URL + "/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        stream: false,
        keep_alive: "30m",
        messages: [{ role: "system", content: getSystemPrompt(mode, { compact: true }) }, ...messages],
        options: {
          temperature: 0.9,
          num_ctx: 6144,
          num_predict: mode === "ppv" ? 260 : 170,
          stop: ["SUBSCRIBER:", "Subscriber:", "subscriber:"]
        }
      })
    });
  } catch {
    return send(res, 502, { error: "cant reach ollama. open the ollama app or run: ollama serve" });
  }

  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = (data && data.error) || "ollama error";
    const hint = /not found/i.test(msg) ? " (run: ollama pull " + MODEL + ")" : "";
    return send(res, 502, { error: msg + hint });
  }
  const text = data && data.message && typeof data.message.content === "string" ? data.message.content.trim() : "";
  if (!text) return send(res, 502, { error: "empty reply, try again" });
  return send(res, 200, { reply: finalize(text, optsFromMessages(messages, mode)) });
}

const server = http.createServer(async (req, res) => {
  const url = (req.url || "/").split("?")[0];
  if (req.method === "GET" && (url === "/" || url === "/index.html")) {
    fs.readFile(INDEX, (err, buf) => {
      if (err) { res.writeHead(500); return res.end("index.html missing"); }
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(buf);
    });
    return;
  }
  if (req.method === "POST" && url === "/api/generate") return generate(req, res);
  res.writeHead(404);
  res.end("not found");
});

// Only reachable from this computer
server.listen(PORT, "127.0.0.1", () => {
  console.log("Chatter Desk local: http://localhost:" + PORT);
  console.log("Using Ollama model: " + MODEL + " at " + OLLAMA_URL);
});