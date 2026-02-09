// src/lib/transcript/emojiConvert.js
const CDN_FMT = "https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/72x72/{codepoint}.png";

const EMOJI_RE = /\p{Extended_Pictographic}(\u200d\p{Extended_Pictographic}|\ufe0f)*/gu;

function codepoint(codes) {
  if (!codes.includes("200d")) {
    return codes.filter((c) => c !== "fe0f").join("-");
  }
  return codes.join("-");
}

function charToCodepoints(char) {
  return [...char].map((c) => c.codePointAt(0).toString(16));
}

export function convertEmoji(text) {
  return text.replace(EMOJI_RE, (match) => {
    const codes = charToCodepoints(match);
    const cp = codepoint(codes);
    const src = CDN_FMT.replace("{codepoint}", cp);
    return `<img class="emoji emoji--small" src="${src}" alt="${match}" title="${match}">`;
  });
}
