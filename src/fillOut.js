// src/lib/transcript/fillOut.js
import { parseMention } from "./mention.js";
import { parseMarkdown } from "./markdown.js";
import {
  PARSE_MODE_NONE,
  PARSE_MODE_MARKDOWN,
  PARSE_MODE_EMBED,
  PARSE_MODE_SPECIAL_EMBED,
  PARSE_MODE_REFERENCE,
  PARSE_MODE_EMOJI,
  PARSE_MODE_HTML_SAFE,
} from "./templates.js";

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function fillOut(guild, base, replacements) {
  for (let r of replacements) {
    if (r.length === 2) r = [r[0], r[1], PARSE_MODE_MARKDOWN];

    const [key, rawValue, mode] = r;
    let v = String(rawValue ?? "").trim();

    if (mode !== PARSE_MODE_NONE) {
      v = await parseMention(v, guild);
    }

    if (mode === PARSE_MODE_MARKDOWN) {
      v = await parseMarkdown(v, "standard");
    } else if (mode === PARSE_MODE_EMBED) {
      v = await parseMarkdown(v, "embed");
    } else if (mode === PARSE_MODE_SPECIAL_EMBED) {
      v = await parseMarkdown(v, "special_embed");
    } else if (mode === PARSE_MODE_REFERENCE) {
      v = await parseMarkdown(v, "reference");
    } else if (mode === PARSE_MODE_EMOJI) {
      v = await parseMarkdown(v, "emoji");
    } else if (mode === PARSE_MODE_HTML_SAFE) {
      v = escapeHtml(v);
      v = JSON.stringify(v).slice(1, -1);
    }

    base = base.replaceAll("{{" + key + "}}", v);
  }

  return base;
}

export { escapeHtml };
