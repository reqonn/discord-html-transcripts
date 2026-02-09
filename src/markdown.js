// src/markdown.js
import { convertEmoji } from "./emoji.js";

function mergeQuoteLines(content) {
  const lines = content.split("\n");
  const merged = [];
  const quoteBuffer = [];
  const quotePattern = /^(?:&gt;|>)\s?(.*)/;

  for (const line of lines) {
    const match = quotePattern.exec(line);
    if (match) {
      quoteBuffer.push(match[1]);
    } else {
      if (quoteBuffer.length) {
        merged.push(`<div class="quote">${quoteBuffer.join("\n")}</div>`);
        quoteBuffer.length = 0;
      }
      merged.push(line);
    }
  }
  if (quoteBuffer.length) {
    merged.push(`<div class="quote">${quoteBuffer.join("\n")}</div>`);
  }

  let result = merged.join("\n");
  result = result.replace(/<\/div>[ \t]*\n(?!\n)/g, "</div>");
  return result;
}

function orderListMarkdownToHtml(content) {
  const lines = content.split("\n");
  let html = "";
  const indentStack = [0];
  let started = true;

  for (const line of lines) {
    const match = /^(\s*)([-*])\s+(.+)$/.exec(line);
    if (match) {
      const indent = match[1].length;
      const itemContent = match[3].trim();

      if (started) {
        html += '<ul class="markup" style="padding-left: 20px;margin: 0 !important">\n';
        started = false;
      }
      if (indent % 2 === 0) {
        while (indent < indentStack[indentStack.length - 1]) {
          html += "</ul>\n";
          indentStack.pop();
        }
        if (indent > indentStack[indentStack.length - 1]) {
          html += '<ul class="markup">\n';
          indentStack.push(indent);
        }
      } else {
        while (indent + 1 < indentStack[indentStack.length - 1]) {
          html += "</ul>\n";
          indentStack.pop();
        }
        if (indent + 1 > indentStack[indentStack.length - 1]) {
          html += '<ul class="markup">\n';
          indentStack.push(indent + 1);
        }
      }
      html += `<li class="markup">${itemContent}</li>\n`;
    } else {
      while (indentStack.length > 1) {
        html += "</ul>";
        indentStack.pop();
      }
      if (!started) {
        html += "</ul>";
        started = true;
      }
      html += line + "\n";
    }
  }
  while (indentStack.length > 1) {
    html += "</ul>\n";
    indentStack.pop();
  }
  return html;
}

function parseNormalMarkdown(content) {
  content = orderListMarkdownToHtml(content);

  const holders = [
    [/__(.*?)__/g, '<span style="text-decoration: underline">$1</span>'],
    [/\*\*(.*?)\*\*/g, "<strong>$1</strong>"],
    [/\*(.*?)\*/g, "<em>$1</em>"],
    [/(?<!\w)_(.*?)_(?!\w)/g, "<em>$1</em>"],
    [/~~(.*?)~~/g, '<span style="text-decoration: line-through">$1</span>'],
    [/^###\s(.*?)$/gm, "<h3>$1</h3>"],
    [/^##\s(.*?)$/gm, "<h2>$1</h2>"],
    [/^#\s(.*?)$/gm, "<h1>$1</h1>"],
    [/^-#\s(.*?)$/gm, "<small>$1</small>"],
    [/\|\|(.*?)\|\|/g, '<span class="spoiler spoiler--hidden" onclick="showSpoiler(event, this)"> <span class="spoiler-text">$1</span></span>'],
  ];

  for (const [pattern, replacement] of holders) {
    content = content.replace(pattern, replacement);
  }

  content = mergeQuoteLines(content);
  return content;
}

function parseEmbedMarkdown(content) {
  // [Message](Link)
  content = content.replace(/\[(.+?)]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');
  content = mergeQuoteLines(content);
  return content;
}

function httpsHttpLinks(content) {
  if (!content.includes("http://") && !content.includes("https://")) return content;

  content = content.replace(/\n/g, "<br>");
  const words = content.replace(/<br>/g, " <br>").split(" ");
  const output = [];

  for (const word of words) {
    if (word.includes("](")) {
      output.push(word);
      continue;
    }
    if (!word.includes("http")) {
      output.push(word);
      continue;
    }

    if (word.includes("&lt;") && word.includes("&gt;")) {
      const match = /&lt;(https?:\/\/.*?)&gt;/.exec(word);
      if (match) {
        const url = match[1];
        const linked = `<a href="${url}">${url}</a>`;
        output.push(word.replace(match[0], linked));
        continue;
      }
    }

    const httpsMatch = /https?:\/\/[^\s>`"*]*/.exec(word);
    if (httpsMatch) {
      const url = httpsMatch[0].endsWith(")") ? null : httpsMatch[0];
      if (url) {
        output.push(word.replace(url, `<a href="${url}">${url}</a>`));
        continue;
      }
    }

    output.push(word);
  }

  content = output.join(" ");
  content = content.replace(/<br>/g, "\n");
  return content;
}

function parseCodeBlockMarkdown(content, isReference = false) {
  const codeBlocks = [];
  content = content.replace(/\n/g, "<br>");

  const markdownLanguages = [
    "asciidoc", "autohotkey", "bash", "coffeescript", "cpp", "cs", "css",
    "diff", "fix", "glsl", "ini", "json", "md", "ml", "prolog", "py",
    "tex", "xl", "xml", "js", "html",
  ];

  // ```code```
  content = content.replace(/```(.*?)```/gs, (_, inner) => {
    let languageClass = "nohighlight";
    let text = inner;

    for (const lang of markdownLanguages) {
      if (text.toLowerCase().startsWith(lang)) {
        languageClass = `language-${lang}`;
        const idx = text.indexOf("<br>");
        if (idx !== -1) text = text.slice(idx + 4);
        break;
      }
    }

    text = returnToMarkdown(text);
    text = text.replace(/^<br>|<br>$/g, "");
    text = text.replace(/  /g, "&nbsp;&nbsp;");

    codeBlocks.push(text);
    const idx = codeBlocks.length;
    if (!isReference) {
      return `<div class="pre pre--multiline ${languageClass}">%s${idx}</div>`;
    }
    return `<span class="pre pre-inline">%s${idx}</span>`;
  });

  // ``code``
  content = content.replace(/``(.*?)``/gs, (_, inner) => {
    const text = returnToMarkdown(inner);
    codeBlocks.push(text);
    return `<span class="pre pre-inline">%s${codeBlocks.length}</span>`;
  });

  // `code`
  content = content.replace(/`(.*?)`/gs, (_, inner) => {
    const text = returnToMarkdown(inner);
    codeBlocks.push(text);
    return `<span class="pre pre-inline">%s${codeBlocks.length}</span>`;
  });

  content = content.replace(/<br>/g, "\n");
  return { content, codeBlocks };
}

function reverseCodeBlockMarkdown(content, codeBlocks) {
  for (let i = 0; i < codeBlocks.length; i++) {
    content = content.replace(`%s${i + 1}`, codeBlocks[i]);
  }
  return content;
}

function returnToMarkdown(content) {
  const holders = [
    [/<strong>(.*?)<\/strong>/g, "**$1**"],
    [/<em>([^<>]+)<\/em>/g, "*$1*"],
    [/<h1>([^<>]+)<\/h1>/g, "# $1"],
    [/<h2>([^<>]+)<\/h2>/g, "## $1"],
    [/<h3>([^<>]+)<\/h3>/g, "### $1"],
    [/<span style="text-decoration: underline">([^<>]+)<\/span>/g, "__$1__"],
    [/<span style="text-decoration: line-through">([^<>]+)<\/span>/g, "~~$1~~"],
    [/<div class="quote">(.*?)<\/div>/g, "> $1"],
    [/<span class="spoiler spoiler--hidden" onclick="showSpoiler\(event, this\)"> <span class="spoiler-text">(.*?)<\/span><\/span>/g, "||$1||"],
    [/<span class="unix-timestamp" data-timestamp=".*?" raw-content="(.*?)">.*?<\/span>/g, "$1"],
  ];

  for (const [pattern, replacement] of holders) {
    content = content.replace(pattern, replacement);
  }

  content = content.replace(/<a href="(.*?)">(.*?)<\/a>/g, (_, url, text) => {
    return url !== text ? `[${text}](${url})` : url;
  });

  return content.trim();
}

function parseDiscordEmoji(content) {
  const holders = [
    [/&lt;:.*?:(\d*)&gt;/g, '<img class="emoji emoji--small" src="https://cdn.discordapp.com/emojis/$1.png">'],
    [/&lt;a:.*?:(\d*)&gt;/g, '<img class="emoji emoji--small" src="https://cdn.discordapp.com/emojis/$1.gif">'],
    [/<:.*?:(\d*)>/g, '<img class="emoji emoji--small" src="https://cdn.discordapp.com/emojis/$1.png">'],
    [/<a:.*?:(\d*)>/g, '<img class="emoji emoji--small" src="https://cdn.discordapp.com/emojis/$1.gif">'],
  ];

  content = convertEmoji(content);

  for (const [pattern, replacement] of holders) {
    content = content.replace(pattern, replacement);
  }

  return content;
}

export function parseMarkdown(content, flow = "standard") {
  if (flow === "emoji") {
    return parseDiscordEmoji(content);
  }

  if (flow === "reference") {
    content = content.replace(/<span class="chatlog__markdown-preserve">(.*?)<\/span>/g, "$1");
    const { content: parsed, codeBlocks } = parseCodeBlockMarkdown(content, true);
    content = parsed;
    content = httpsHttpLinks(content);
    content = parseEmbedMarkdown(content);
    content = parseNormalMarkdown(content);
    content = reverseCodeBlockMarkdown(content, codeBlocks);
    content = content.replace(/<br>/g, " ");
    return content;
  }

  if (flow === "special_embed") {
    content = httpsHttpLinks(content);
    const { content: parsed, codeBlocks } = parseCodeBlockMarkdown(content);
    content = parsed;
    content = parseNormalMarkdown(content);
    content = parseDiscordEmoji(content);
    content = reverseCodeBlockMarkdown(content, codeBlocks);
    return content;
  }

  // standard + embed
  const { content: parsed, codeBlocks } = parseCodeBlockMarkdown(content);
  content = parsed;
  content = httpsHttpLinks(content);
  content = parseEmbedMarkdown(content);
  content = parseNormalMarkdown(content);
  content = parseDiscordEmoji(content);
  content = reverseCodeBlockMarkdown(content, codeBlocks);
  return content;
}
