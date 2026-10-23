// Cleans up model output to match the style rules and flags banned words.
// Small local models often forget the style rules, so this enforces them in code.

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

const ALL = [...BANNED, ...EXTRA];
const PATTERN = new RegExp("\\b(" + ALL.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")\\b", "gi");

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

// lowercase, no punctuation (. , ! ? ' " ;), no markdown asterisks, keep NOTE lines as written
export function cleanStyle(text) {
  const lines = text.replace(/\r/g, "").split("\n").map((raw) => {
    const line = raw.trim();
    if (!line) return "";
    if (/^note:/i.test(line)) return "NOTE:" + line.slice(5);
    return line
      .replace(/^reply\s*:\s*/i, "")
      .replace(/[*_`#]/g, "")
      .replace(/[.,!?;"“”‘’']/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
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

export function finalize(text) {
  const cleaned = cleanStyle(trimExtras(text));
  const hits = findBanned(cleaned);
  if (!hits.length) return cleaned;
  return cleaned + "\nNOTE: banned word found (" + hits.join(", ") + ") so rewrite or skip this before sending";
}