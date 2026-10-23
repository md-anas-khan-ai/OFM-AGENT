// Cleans up model output to match the agency script style and flags banned words, missing PPV details and invented prices.
// Small local models often forget the style rules, so this enforces them in code.
// Normal adult vocabulary (pussy, cock, tits, ass, throat and so on) is NOT filtered. Only the agency ban list is flagged.

const BANNED = [
  "abduct", "abduction", "abducting", "abducted", "animal", "asphyxia", "asphyxiation",
  "ballbusting", "bait", "bareback", "blackmail", "bestiality", "beastiality",
  "bleeding", "blood", "bloodplay", "blooded", "blacked", "bukkake",
  "caned", "caning", "canned", "canning", "cbt", "cashapp", "cannibal",
  "cervix", "cervics", "cerviks", "comatose", "coma", "child",
  "choke", "choked", "choking", "chokes", "chocked", "chocking",
  "chloroform", "chloroformed", "chloroforming", "cycle", "cp", "consent",
  "drink", "drinking", "drunk", "drunken", "diapers", "doze", "dog", "eleven",
  "entrance", "escort", "escorted", "escorting", "enema",
  "fansonly", "fansly", "fuckfan", "fanfuck", "facentro", "fancentro",
  "fetal", "foetal", "fecal", "farm", "fist", "fisted", "fisting", "flogging",
  "force", "forced", "forcing", "forceful", "fifteen", "gaping", "golden",
  "gangbang", "gangbangs", "gangbanged", "gangbanging", "hardsports",
  "hypno", "hypnotize", "hypnotized", "hypnotizing", "hooker",
  "inbreed", "inbreeding", "incest", "inzest", "incapacitate", "incapacitation",
  "intox", "jail", "jailed", "jailbait",
  "kidnap", "kidnaps", "kidnapped", "kidnapping", "knock", "knocked", "knocking",
  "lactation", "lactating", "lactate", "lolicon", "lolita", "lalita",
  "menstruate", "menstruation", "menstrual", "many vids", "medical play",
  "molest", "molested", "molesting", "meet", "mutilate", "mutilated", "mutilating"
];
// Phrases (not single words) to flag. "throat" alone is normal adult vocabulary, only choke-like wording is flagged.
const PHRASES = /\b(?:grab(?:s|bing)?|squeez(?:e|es|ing))\s+(?:my|ur|your|his|her|the)\s+throat\b|\bby the throat\b/i;
// Add the rest of the ban list (after M) below, one word per entry:
const EXTRA = [];

export const ALL_BANNED = [...BANNED, ...EXTRA];
const PATTERN = new RegExp("\\b(" + ALL_BANNED.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")\\b", "gi");

export function findBanned(text) {
  const hits = new Set();
  for (const line of text.split("\n")) {
    if (/^\s*note:/i.test(line)) continue;
    const m = line.match(PATTERN);
    if (m) m.forEach((w) => hits.add(w.toLowerCase()));
    const p = line.match(PHRASES);
    if (p) hits.add(p[0].toLowerCase());
  }
  return [...hits];
}

// Text emoticons used in the agency scripts. They are kept exactly (lowercase).
const EMOTICONS = new Set([">:3", ">:)", ">:(", ">~<", "><", "^.^", "^^", ":p", ":x", ":3", ":c", ":)", ":(", ";)", "~<3", "<3"]);

// Script style: lowercase, no apostrophes, no commas, no single periods, keep ? and .. and ... and ~,
// allow up to 3 ALL CAPS emphasis words (3+ letters), keep text emoticons.
function cleanLine(line) {
  let s = line
    .replace(/^reply\s*:\s*/i, "")
    .replace(/[*_`#]/g, "")
    .replace(/…/g, "...")
    .replace(/[—–]/g, " ");
  const tokens = s.split(/\s+/).filter(Boolean);
  const letters = tokens.map((t) => t.replace(/[^A-Za-z]/g, ""));
  const capsish = letters.filter((l) => l.length >= 3 && l === l.toUpperCase()).length;
  const mostlyCaps = tokens.length >= 3 && capsish / tokens.length > 0.5;
  let capsKept = 0;
  const out = tokens.map((tok, i) => {
    const bare = tok.toLowerCase().replace(/[.,!]+$/, "");
    if (EMOTICONS.has(bare)) return bare;
    let t = tok
      .replace(/[,;!"“”‘’'`]/g, "")
      .replace(/(?<!\.)\.(?!\.)/g, "")
      .replace(/\.{4,}/g, "...")
      .replace(/\?{2,}/g, "?");
    const core = letters[i];
    const isCaps = core.length >= 3 && core === core.toUpperCase();
    if (isCaps && !mostlyCaps && capsKept < 3) { capsKept++; return t; }
    return t.toLowerCase();
  });
  return out.join(" ").trim();
}

export function cleanStyle(text, opts = {}) {
  const keepCase = !!opts.keepCase;
  const lines = text.replace(/\r/g, "").split("\n").map((raw) => {
    const line = raw.trim();
    if (!line) return "";
    if (/^note:/i.test(line)) return "NOTE:" + line.slice(5);
    if (keepCase) return line.replace(/^reply\s*:\s*/i, "").replace(/[*_`#]/g, "").replace(/\s+/g, " ").trim();
    return cleanLine(line);
  });
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// cuts off anything after the model starts writing the subscriber's side
export function trimExtras(text) {
  const out = [];
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    if (/^\s*(subscriber|sub|objective|context|user)\s*:/i.test(raw)) break;
    out.push(raw);
  }
  return out.join("\n").trim();
}

// Reads the flags we need (mode details) from the chat history the browser sent.
export function optsFromMessages(messages, mode) {
  let last = "";
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user" &&