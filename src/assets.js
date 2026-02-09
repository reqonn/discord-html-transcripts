// src/assets.js
import { MessageType } from "discord.js";
import { fillOut, escapeHtml } from "./fill-out.js";
import { convertEmoji } from "./emoji.js";
import { DiscordUtils } from "./utils.js";
import {
  PARSE_MODE_NONE, PARSE_MODE_MARKDOWN, PARSE_MODE_EMBED,
  PARSE_MODE_SPECIAL_EMBED, PARSE_MODE_EMOJI,
  img_attachment, msg_attachment, audio_attachment, video_attachment,
  embed_body, embed_title, embed_description, embed_field, embed_field_inline,
  embed_footer, embed_footer_icon, embed_image, embed_thumbnail, embed_author, embed_author_icon,
  emoji_template, custom_emoji_template,
  component_button, component_menu, component_menu_options, component_menu_options_emoji,
  component_container, component_section, component_text_display,
  component_thumbnail as component_thumbnail_tmpl, component_media_gallery,
  component_media_gallery_item, component_separator, component_file,
} from "./templates.js";

// ─── File size helper ─────────────────────────────────────────────────────────

function getFileSize(bytes) {
  if (!bytes || bytes === 0) return "0 bytes";
  const names = ["bytes", "KB", "MB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), names.length - 1);
  const s = (bytes / Math.pow(1024, i)).toFixed(2);
  return `${s} ${names[i]}`;
}

function resolveFileIcon(name = "", contentType = "", url = "") {
  contentType = (contentType || "").toLowerCase();
  if (contentType.startsWith("audio/")) return DiscordUtils.file_attachment_audio;

  function ext(value) {
    if (!value) return "";
    const cleaned = String(value).split("?")[0].split("#")[0];
    if (!cleaned.includes(".")) return "";
    return cleaned.split(".").pop().toLowerCase();
  }

  let extension = ext(name) || ext(url);
  if (!extension && contentType) {
    if (contentType.includes("html")) extension = "html";
    else if (contentType.includes("pdf")) extension = "pdf";
  }

  const acrobat = ["pdf"];
  const webcode = ["html", "htm", "css", "rss", "xhtml", "xml"];
  const code = ["py", "cgi", "pl", "gadget", "jar", "msi", "wsf", "bat", "php", "js"];
  const document = ["txt", "doc", "docx", "rtf", "xls", "xlsx", "ppt", "pptx", "odt", "odp", "ods", "odg", "odf", "swx", "sxi", "sxc", "sxd", "stw"];
  const archive = ["br", "rpm", "dcm", "epub", "zip", "tar", "rar", "gz", "bz2", "7x", "7z", "deb", "ar", "z", "lzo", "lz", "lz4", "arj", "pkg"];

  if (acrobat.includes(extension)) return DiscordUtils.file_attachment_acrobat;
  if (webcode.includes(extension)) return DiscordUtils.file_attachment_webcode;
  if (code.includes(extension)) return DiscordUtils.file_attachment_code;
  if (document.includes(extension)) return DiscordUtils.file_attachment_document;
  if (archive.includes(extension)) return DiscordUtils.file_attachment_archive;
  return DiscordUtils.file_attachment_unknown;
}

// ─── Attachment ───────────────────────────────────────────────────────────────

export async function buildAttachment(attachment, guild) {
  const ct = attachment.contentType || "";
  const url = attachment.proxyURL || attachment.url;
  const isSpoiler = attachment.spoiler || (attachment.name && attachment.name.startsWith("SPOILER_"));

  let html;
  if (ct.includes("image")) {
    html = await fillOut(guild, img_attachment, [
      ["ATTACH_URL", url, PARSE_MODE_NONE],
      ["ATTACH_URL_THUMB", url, PARSE_MODE_NONE],
    ]);
  } else if (ct.includes("video")) {
    html = await fillOut(guild, video_attachment, [
      ["ATTACH_URL", url, PARSE_MODE_NONE],
    ]);
  } else if (ct.includes("audio")) {
    html = await fillOut(guild, audio_attachment, [
      ["ATTACH_ICON", DiscordUtils.file_attachment_audio, PARSE_MODE_NONE],
      ["ATTACH_URL", url, PARSE_MODE_NONE],
      ["ATTACH_BYTES", getFileSize(attachment.size), PARSE_MODE_NONE],
      ["ATTACH_AUDIO", url, PARSE_MODE_NONE],
      ["ATTACH_FILE", attachment.name || "audio", PARSE_MODE_NONE],
    ]);
  } else {
    const icon = resolveFileIcon(attachment.name, ct, url);
    html = await fillOut(guild, msg_attachment, [
      ["ATTACH_ICON", icon, PARSE_MODE_NONE],
      ["ATTACH_URL", url, PARSE_MODE_NONE],
      ["ATTACH_BYTES", getFileSize(attachment.size), PARSE_MODE_NONE],
      ["ATTACH_FILE", attachment.name || "file", PARSE_MODE_NONE],
    ]);
  }

  if (isSpoiler && typeof html === "string") {
    html = html.replace(
      'class="chatlog__attachment"',
      'class="chatlog__attachment chatlog__attachment-spoiler"'
    ).replace(
      "class=chatlog__attachment>",
      'class="chatlog__attachment chatlog__attachment-spoiler">'
    );
  }

  return html;
}

// ─── Embed ────────────────────────────────────────────────────────────────────

export async function buildEmbed(embed, guild) {
  const colour = embed.color ?? 0x4a4a50;
  const r = (colour >> 16) & 0xff;
  const g = (colour >> 8) & 0xff;
  const b = colour & 0xff;

  // Title
  let titleHtml = "";
  if (embed.title) {
    let rawTitle = escapeHtml(embed.title);
    let titleContent = await fillOut(guild, "{{EMBED_TITLE}}", [
      ["EMBED_TITLE", rawTitle, PARSE_MODE_MARKDOWN],
    ]);
    if (embed.url) {
      titleContent = `<a href="${escapeHtml(embed.url)}">${titleContent}</a>`;
    }
    titleHtml = await fillOut(guild, embed_title, [
      ["EMBED_TITLE", titleContent, PARSE_MODE_NONE],
    ]);
  }

  // Description
  let descHtml = "";
  if (embed.description) {
    descHtml = await fillOut(guild, embed_description, [
      ["EMBED_DESC", embed.description, PARSE_MODE_EMBED],
    ]);
  }

  // Fields
  let fieldsHtml = "";
  if (embed.fields?.length) {
    for (const field of embed.fields) {
      const tmpl = field.inline ? embed_field_inline : embed_field;
      fieldsHtml += await fillOut(guild, tmpl, [
        ["FIELD_NAME", escapeHtml(field.name), PARSE_MODE_SPECIAL_EMBED],
        ["FIELD_VALUE", escapeHtml(field.value), PARSE_MODE_EMBED],
      ]);
    }
  }

  // Author
  let authorHtml = "";
  if (embed.author?.name) {
    let authorName = escapeHtml(embed.author.name);
    if (embed.author.url) {
      authorName = `<a class="chatlog__embed-author-name-link" href="${embed.author.url}">${authorName}</a>`;
    }
    if (embed.author.iconURL) {
      authorHtml = await fillOut(guild, embed_author_icon, [
        ["AUTHOR", authorName, PARSE_MODE_NONE],
        ["AUTHOR_ICON", embed.author.iconURL, PARSE_MODE_NONE],
      ]);
    } else {
      authorHtml = await fillOut(guild, embed_author, [
        ["AUTHOR", authorName, PARSE_MODE_NONE],
      ]);
    }
  }

  // Image
  let imageHtml = "";
  if (embed.image?.url) {
    imageHtml = await fillOut(guild, embed_image, [
      ["EMBED_IMAGE", embed.image.proxyURL || embed.image.url, PARSE_MODE_NONE],
    ]);
  }

  // Thumbnail
  let thumbnailHtml = "";
  if (embed.thumbnail?.url) {
    thumbnailHtml = await fillOut(guild, embed_thumbnail, [
      ["EMBED_THUMBNAIL", embed.thumbnail.url, PARSE_MODE_NONE],
    ]);
  }

  // Footer
  let footerHtml = "";
  let footerText = embed.footer?.text ? escapeHtml(embed.footer.text) : "";
  if (embed.timestamp) {
    const ts = new Date(embed.timestamp).toLocaleString("en-GB", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", timeZone: "UTC",
    });
    footerText = footerText ? `${footerText} | ${ts}` : ts;
  }
  if (footerText) {
    if (embed.footer?.iconURL) {
      footerHtml = await fillOut(guild, embed_footer_icon, [
        ["EMBED_FOOTER", footerText, PARSE_MODE_NONE],
        ["EMBED_FOOTER_ICON", embed.footer.iconURL, PARSE_MODE_NONE],
      ]);
    } else {
      footerHtml = await fillOut(guild, embed_footer, [
        ["EMBED_FOOTER", footerText, PARSE_MODE_NONE],
      ]);
    }
  }

  return fillOut(guild, embed_body, [
    ["EMBED_R", String(r)],
    ["EMBED_G", String(g)],
    ["EMBED_B", String(b)],
    ["EMBED_AUTHOR", authorHtml, PARSE_MODE_NONE],
    ["EMBED_TITLE", titleHtml, PARSE_MODE_NONE],
    ["EMBED_IMAGE", imageHtml, PARSE_MODE_NONE],
    ["EMBED_THUMBNAIL", thumbnailHtml, PARSE_MODE_NONE],
    ["EMBED_DESC", descHtml, PARSE_MODE_NONE],
    ["EMBED_FIELDS", fieldsHtml, PARSE_MODE_NONE],
    ["EMBED_FOOTER", footerHtml, PARSE_MODE_NONE],
  ]);
}

// ─── Reaction ─────────────────────────────────────────────────────────────────

export async function buildReaction(reaction, guild) {
  const emojiStr = String(reaction.emoji);
  if (emojiStr.includes(":")) {
    const animated = /^<a:/.test(emojiStr);
    const idMatch = /:(\d+)>?$/.exec(emojiStr);
    if (idMatch) {
      return fillOut(guild, custom_emoji_template, [
        ["EMOJI", idMatch[1], PARSE_MODE_NONE],
        ["EMOJI_COUNT", String(reaction.count), PARSE_MODE_NONE],
        ["EMOJI_FILE", animated ? "gif" : "png", PARSE_MODE_NONE],
      ]);
    }
  }

  const reactEmoji = convertEmoji(emojiStr);
  return fillOut(guild, emoji_template, [
    ["EMOJI", reactEmoji, PARSE_MODE_NONE],
    ["EMOJI_COUNT", String(reaction.count), PARSE_MODE_NONE],
  ]);
}

// ─── Component ────────────────────────────────────────────────────────────────

const BUTTON_STYLES = {
  primary: "#5865F2", secondary: "#4F545C", success: "#2D7D46",
  danger: "#D83C3E", blurple: "#5865F2", grey: "#4F545C",
  gray: "#4F545C", green: "#2D7D46", red: "#D83C3E", link: "#4F545C",
};

const STYLE_MAP = { 1: "primary", 2: "secondary", 3: "success", 4: "danger", 5: "link" };

let menuDivId = 0;
export function resetMenuDivId() { menuDivId = 0; }

function stringifyEmoji(emojiObj) {
  if (!emojiObj) return "";
  if (typeof emojiObj === "string") return emojiObj;
  if (emojiObj.id) return `<:${emojiObj.name || "_"}:${emojiObj.id}>`;
  return emojiObj.name || "";
}

function getMediaUrl(media) {
  if (!media) return "";
  if (typeof media === "string") return media;
  if (typeof media === "object" && media.url) return String(media.url);
  return "";
}

function fileDisplayName(url) {
  if (!url) return "";
  if (url.startsWith("attachment://")) return url.replace("attachment://", "");
  try {
    const path = new URL(url).pathname;
    return path.split("/").pop() || url;
  } catch {
    return url;
  }
}

async function buildButton(c, guild) {
  const url = c.url || "javascript:;";
  const target = c.url && !c.disabled ? " target='_blank'" : "";
  const icon = c.url && !c.disabled ? DiscordUtils.button_external_link : "";
  const label = c.label || "";
  const rawStyle = typeof c.style === "number" ? STYLE_MAP[c.style] || "" : String(c.style || "").split(".").pop().toLowerCase();
  const style = BUTTON_STYLES[rawStyle] || "#4F545C";
  const variant = rawStyle === "link" ? "chatlog__component-button--link" : "chatlog__component-button--filled";
  const emoji = stringifyEmoji(c.emoji);

  return fillOut(guild, component_button, [
    ["DISABLED", c.disabled ? "chatlog__component-disabled" : "", PARSE_MODE_NONE],
    ["URL", url, PARSE_MODE_NONE],
    ["BUTTON_VARIANT", variant, PARSE_MODE_NONE],
    ["ARIA_DISABLED", c.disabled ? "true" : "false", PARSE_MODE_NONE],
    ["LABEL", label, PARSE_MODE_MARKDOWN],
    ["EMOJI", emoji, PARSE_MODE_EMOJI],
    ["ICON", icon, PARSE_MODE_NONE],
    ["TARGET", target, PARSE_MODE_NONE],
    ["STYLE", style, PARSE_MODE_NONE],
  ]);
}

async function buildMenu(c, guild) {
  const placeholder = c.placeholder || "Select an option";
  const options = c.options || [];
  const disabled = !!c.disabled;

  const defaultLabels = [];
  for (const opt of options) {
    if (opt.default) {
      let label = opt.label || "";
      const emoji = stringifyEmoji(opt.emoji);
      if (emoji) label = `${emoji} ${label}`.trim();
      defaultLabels.push(label);
    }
  }
  const selectedLabel = defaultLabels.length ? defaultLabels.join(", ") : placeholder;

  let content = "";
  if (!disabled) {
    const optHtmls = [];
    for (const opt of options) {
      const emoji = stringifyEmoji(opt.emoji);
      const isDefault = !!opt.default;
      const defaultClass = isDefault ? "dropdownContentSelected" : "";
      const check = isDefault ? "✓" : "";

      if (emoji) {
        optHtmls.push(await fillOut(guild, component_menu_options_emoji, [
          ["EMOJI", emoji, PARSE_MODE_EMOJI],
          ["TITLE", opt.label || "", PARSE_MODE_MARKDOWN],
          ["DESCRIPTION", opt.description || "", PARSE_MODE_MARKDOWN],
          ["DEFAULT_CLASS", defaultClass, PARSE_MODE_NONE],
          ["CHECK", check, PARSE_MODE_NONE],
        ]));
      } else {
        optHtmls.push(await fillOut(guild, component_menu_options, [
          ["TITLE", opt.label || "", PARSE_MODE_MARKDOWN],
          ["DESCRIPTION", opt.description || "", PARSE_MODE_MARKDOWN],
          ["DEFAULT_CLASS", defaultClass, PARSE_MODE_NONE],
          ["CHECK", check, PARSE_MODE_NONE],
        ]));
      }
    }
    if (optHtmls.length) {
      content = `<div id="dropdownMenu${menuDivId}" class="dropdownContent">${optHtmls.join("")}</div>`;
    }
  }

  const html = await fillOut(guild, component_menu, [
    ["DISABLED", disabled ? "chatlog__component-disabled" : "", PARSE_MODE_NONE],
    ["ID", String(menuDivId), PARSE_MODE_NONE],
    ["PLACEHOLDER", selectedLabel, PARSE_MODE_MARKDOWN],
    ["PLACEHOLDER_TITLE", placeholder, PARSE_MODE_MARKDOWN],
    ["CONTENT", content, PARSE_MODE_NONE],
    ["ICON", DiscordUtils.interaction_dropdown_icon, PARSE_MODE_NONE],
  ]);
  menuDivId++;
  return html;
}

async function buildComponentItem(c, guild, attachments = []) {
  const type = c.type?.valueOf?.() ?? c.type;

  // Button
  if (type === 2) return buildButton(c, guild);
  // StringSelect
  if (type === 3) return buildMenu(c, guild);
  // Section (9)
  if (type === 9) {
    const children = c.components || c.children || [];
    let contentHtml = "";
    for (const child of children) contentHtml += await buildComponentItem(child, guild, attachments);
    let accessoryHtml = "";
    if (c.accessory) accessoryHtml = await buildComponentItem(c.accessory, guild, attachments);
    return fillOut(guild, component_section, [
      ["CONTENT", contentHtml, PARSE_MODE_NONE],
      ["ACCESSORY", accessoryHtml, PARSE_MODE_NONE],
      ["HAS_ACCESSORY_CLASS", c.accessory ? "chatlog__component-section--has-accessory" : "", PARSE_MODE_NONE],
    ]);
  }
  // TextDisplay (10)
  if (type === 10) {
    return fillOut(guild, component_text_display, [
      ["CONTENT", c.content || "", PARSE_MODE_EMBED],
    ]);
  }
  // Thumbnail (11)
  if (type === 11) {
    const url = getMediaUrl(c.media);
    if (!url) return "";
    return fillOut(guild, component_thumbnail_tmpl, [
      ["URL", url, PARSE_MODE_NONE],
      ["TITLE", c.description || "", PARSE_MODE_MARKDOWN],
      ["ALT", c.description || fileDisplayName(url), PARSE_MODE_MARKDOWN],
      ["DESCRIPTION", c.description || "", PARSE_MODE_MARKDOWN],
      ["SPOILER_CLASS", c.spoiler ? "chatlog__component-spoiler" : "", PARSE_MODE_NONE],
      ["SPOILER_TAG", c.spoiler ? '<div class="chatlog__component-spoiler-label">SPOILER</div>' : "", PARSE_MODE_NONE],
      ["DESCRIPTION_OVERLAY", c.description && !c.spoiler ? `<div class="chatlog__component-thumbnail-description">${c.description}</div>` : "", PARSE_MODE_NONE],
    ]);
  }
  // MediaGallery (12)
  if (type === 12) {
    const items = c.items || c.components || c.children || [];
    let itemsHtml = "";
    for (const item of items) {
      const url = getMediaUrl(item.media);
      if (!url) continue;
      itemsHtml += await fillOut(guild, component_media_gallery_item, [
        ["URL", url, PARSE_MODE_NONE],
        ["TITLE", item.description || "", PARSE_MODE_MARKDOWN],
        ["ALT", item.description || fileDisplayName(url), PARSE_MODE_MARKDOWN],
        ["DESCRIPTION", item.description || "", PARSE_MODE_MARKDOWN],
        ["SPOILER_CLASS", item.spoiler ? "chatlog__component-spoiler" : "", PARSE_MODE_NONE],
        ["SPOILER_TAG", item.spoiler ? '<div class="chatlog__component-spoiler-label">SPOILER</div>' : "", PARSE_MODE_NONE],
        ["DESCRIPTION_OVERLAY", item.description && !item.spoiler ? `<div class="chatlog__component-media-description">${item.description}</div>` : "", PARSE_MODE_NONE],
      ]);
    }
    const count = items.length;
    const cls = count === 1 ? "chatlog__media-gallery-single" : count === 2 ? "chatlog__media-gallery-double" : count === 3 ? "chatlog__media-gallery-triple" : count >= 4 ? "chatlog__media-gallery-grid" : "";
    return fillOut(guild, component_media_gallery, [
      ["ITEMS", itemsHtml, PARSE_MODE_NONE],
      ["GALLERY_CLASS", cls, PARSE_MODE_NONE],
    ]);
  }
  // File (13)
  if (type === 13) {
    const file = c.file || c.media;
    const url = getMediaUrl(file);
    if (!url) return "";
    const fileName = c.name || fileDisplayName(url);
    const fileIcon = resolveFileIcon(fileName, "", url);
    return fillOut(guild, component_file, [
      ["FILE_NAME", fileName, PARSE_MODE_NONE],
      ["FILE_URL", url, PARSE_MODE_NONE],
      ["FILE_ICON", fileIcon, PARSE_MODE_NONE],
      ["FILE_SIZE", "Unknown size", PARSE_MODE_NONE],
      ["SPOILER_CLASS", c.spoiler ? "chatlog__component-spoiler" : "", PARSE_MODE_NONE],
    ]);
  }
  // Separator (14)
  if (type === 14) {
    const spacing = typeof c.spacing === "number" ? c.spacing : c.spacing?.value ?? 1;
    return fillOut(guild, component_separator, [
      ["SPACING_CLASS", spacing === 2 ? "chatlog__separator-large" : "chatlog__separator-small", PARSE_MODE_NONE],
      ["DIVIDER", c.divider !== false ? '<div class="chatlog__separator-line"></div>' : "", PARSE_MODE_NONE],
    ]);
  }
  // Container (17)
  if (type === 17) {
    const children = c.components || c.children || [];
    let contentHtml = "";
    for (const child of children) contentHtml += await buildComponentItem(child, guild, attachments);
    let accentStyle = "";
    let accentClass = "";
    const accentColor = c.accent_color ?? c.accent_colour ?? c.accentColor;
    if (accentColor != null) {
      try {
        const val = typeof accentColor === "object" && accentColor.value != null ? accentColor.value : Number(accentColor);
        accentStyle = `--component-accent:#${val.toString(16).padStart(6, "0")};`;
        accentClass = "chatlog__component-container--accent";
      } catch {}
    }
    return fillOut(guild, component_container, [
      ["SPOILER_CLASS", c.spoiler ? "chatlog__component-spoiler" : "", PARSE_MODE_NONE],
      ["SPOILER_TAG", c.spoiler ? '<div class="chatlog__component-spoiler-label">SPOILER</div>' : "", PARSE_MODE_NONE],
      ["ACCENT_CLASS", accentClass, PARSE_MODE_NONE],
      ["ACCENT_COLOR_STYLE", accentStyle, PARSE_MODE_NONE],
      ["CONTENT", contentHtml, PARSE_MODE_NONE],
    ]);
  }

  // ActionRow (1) or unknown — recurse into children
  const children = c.components || c.children || [];
  if (!children.length) return "";

  let buttonsHtml = "";
  for (const child of children) {
    buttonsHtml += await buildComponentItem(child, guild, attachments);
  }
  return buttonsHtml ? `<div class="chatlog__components">${buttonsHtml}</div>` : "";
}

export async function buildComponent(component, guild, attachments = []) {
  return buildComponentItem(component, guild, attachments);
}

export { getFileSize, resolveFileIcon };
