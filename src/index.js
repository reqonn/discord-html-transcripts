// src/index.js
import { fillOut, escapeHtml } from "./fill-out.js";
import { gatherMessages } from "./message.js";
import { resetMenuDivId } from "./assets.js";
import { passBot } from "./mention.js";
import { DiscordUtils } from "./utils.js";
import {
  PARSE_MODE_NONE, PARSE_MODE_HTML_SAFE,
  total, fancy_time, channel_topic, channel_subject, meta_data_temp,
} from "./templates.js";

const IMAGE_TIMEOUT_MS = 5000;
const MAX_CONCURRENT_DOWNLOADS = 10;

// Regex to find image URLs in src/href attributes (Discord CDN + media proxy)
const IMAGE_URL_RE = /(?:src|href)=["'](https:\/\/(?:cdn\.discordapp\.com|media\.discordapp\.net)\/[^"']+\.(?:png|jpg|jpeg|gif|webp)(?:\?[^"']*)?)["']/gi;

function getContentType(ext) {
  const map = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp" };
  return map[ext] || "image/png";
}

async function downloadAsBase64(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    const ext = url.split("?")[0].split(".").pop().toLowerCase();
    const mime = getContentType(ext);
    return `data:${mime};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function embedImages(html) {
  // Collect unique URLs
  const urls = new Set();
  let match;
  while ((match = IMAGE_URL_RE.exec(html)) !== null) {
    urls.add(match[1]);
  }
  if (!urls.size) return html;

  // Download in batches to limit concurrency
  const urlList = [...urls];
  const dataUris = new Map();

  for (let i = 0; i < urlList.length; i += MAX_CONCURRENT_DOWNLOADS) {
    const batch = urlList.slice(i, i + MAX_CONCURRENT_DOWNLOADS);
    const results = await Promise.all(batch.map(async (url) => {
      const dataUri = await downloadAsBase64(url);
      return { url, dataUri };
    }));
    for (const { url, dataUri } of results) {
      if (dataUri) dataUris.set(url, dataUri);
    }
  }

  // Replace URLs with data URIs
  for (const [url, dataUri] of dataUris) {
    html = html.replaceAll(url, dataUri);
  }

  return html;
}

/**
 * Generate an HTML transcript from a Discord channel.
 * @param {import("discord.js").TextChannel} channel - The channel to export
 * @param {object} [options]
 * @param {number|null} [options.limit] - Max messages to fetch (null = all)
 * @param {import("discord.js").Client} [options.bot] - Bot client for user lookups
 * @param {boolean} [options.militaryTime] - Use 24h clock (default: true)
 * @param {boolean} [options.fancyTimes] - Use JS-based relative timestamps (default: true)
 * @param {boolean} [options.saveImages] - Embed images as base64 (default: true)
 * @returns {Promise<{ html: string, messageCount: number, metaData: object }>}
 */
export async function createTranscript(channel, options = {}) {
  const {
    limit = null,
    bot = null,
    militaryTime = true,
    fancyTimes = true,
    saveImages = true,
  } = options;

  if (bot) passBot(bot);
  resetMenuDivId();

  // Fetch messages
  const messages = [];
  let lastId = null;
  const fetchLimit = limit || Infinity;

  while (messages.length < fetchLimit) {
    const batchSize = Math.min(100, fetchLimit - messages.length);
    const opts = { limit: batchSize };
    if (lastId) opts.before = lastId;

    const batch = await channel.messages.fetch(opts);
    if (batch.size === 0) break;

    messages.push(...batch.values());
    lastId = batch.last().id;
    if (batch.size < batchSize) break;
  }

  // Reverse to chronological order
  messages.reverse();

  if (!messages.length) {
    return { html: "<p>No messages found.</p>", messageCount: 0 };
  }

  // Build message HTML + metadata
  const { messageHtml, metaData } = await gatherMessages(messages, channel.guild, militaryTime);

  // Build metadata popouts
  const guild = channel.guild;
  const guildIcon = guild.icon && guild.iconURL() ? guild.iconURL() : DiscordUtils.default_avatar;
  const guildName = escapeHtml(guild.name);

  const now = new Date();
  const timeNow = militaryTime
    ? now.toLocaleString("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "UTC" })
    : now.toLocaleString("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true, timeZone: "UTC" });

  let metaDataHtml = "";
  for (const [userId, data] of Object.entries(metaData)) {
    const createdAt = data.createdAt
      ? new Date(data.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
      : "Unknown";
    const joinedAt = data.joinedAt
      ? new Date(data.joinedAt).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
      : "Unknown";

    const nameStr = String(data.name);
    const discrimMatch = nameStr.match(/#(\d{4})$/);
    const username = discrimMatch ? nameStr.slice(0, -5) : nameStr;
    const discrim = discrimMatch ? discrimMatch[1] : "";

    metaDataHtml += await fillOut(guild, meta_data_temp, [
      ["USER_ID", userId, PARSE_MODE_NONE],
      ["USERNAME", username, PARSE_MODE_NONE],
      ["DISCRIMINATOR", discrim],
      ["BOT", data.botTag, PARSE_MODE_NONE],
      ["CREATED_AT", createdAt, PARSE_MODE_NONE],
      ["JOINED_AT", joinedAt, PARSE_MODE_NONE],
      ["GUILD_ICON", String(guildIcon), PARSE_MODE_NONE],
      ["DISCORD_ICON", DiscordUtils.logo, PARSE_MODE_NONE],
      ["MEMBER_ID", userId, PARSE_MODE_NONE],
      ["USER_AVATAR", String(data.avatar), PARSE_MODE_NONE],
      ["DISPLAY", data.displayName, PARSE_MODE_NONE],
      ["MESSAGE_COUNT", String(data.messageCount)],
    ]);
  }

  // Channel creation time
  const channelCreatedAt = militaryTime
    ? channel.createdAt.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "UTC" })
    : channel.createdAt.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true, timeZone: "UTC" });

  // Channel topic
  const rawTopic = channel.topic || "";
  let channelTopicHtml = "";
  if (rawTopic) {
    channelTopicHtml = await fillOut(guild, channel_topic, [
      ["CHANNEL_TOPIC", escapeHtml(rawTopic)],
    ]);
  }

  // Subject
  const limitText = limit ? `latest ${limit} messages` : "start";
  const subject = await fillOut(guild, channel_subject, [
    ["LIMIT", limitText, PARSE_MODE_NONE],
    ["CHANNEL_NAME", channel.name],
    ["RAW_CHANNEL_TOPIC", rawTopic],
  ]);

  // Fancy time script
  let fancyTimeHtml = "";
  if (fancyTimes) {
    const timeFormat = militaryTime ? "HH:mm" : "hh:mm A";
    fancyTimeHtml = await fillOut(guild, fancy_time, [
      ["TIME_FORMAT", timeFormat, PARSE_MODE_NONE],
      ["TIMEZONE", "UTC", PARSE_MODE_NONE],
    ]);
  }

  // Build final HTML
  const html = await fillOut(guild, total, [
    ["SERVER_NAME", guildName],
    ["GUILD_ID", String(guild.id), PARSE_MODE_NONE],
    ["SERVER_AVATAR_URL", String(guildIcon), PARSE_MODE_NONE],
    ["CHANNEL_NAME", channel.name],
    ["MESSAGE_COUNT", String(messages.length)],
    ["MESSAGES", messageHtml, PARSE_MODE_NONE],
    ["META_DATA", metaDataHtml, PARSE_MODE_NONE],
    ["DATE_TIME", timeNow],
    ["SUBJECT", subject, PARSE_MODE_NONE],
    ["CHANNEL_CREATED_AT", channelCreatedAt, PARSE_MODE_NONE],
    ["CHANNEL_TOPIC", channelTopicHtml, PARSE_MODE_NONE],
    ["CHANNEL_ID", String(channel.id), PARSE_MODE_NONE],
    ["MESSAGE_PARTICIPANTS", String(Object.keys(metaData).length), PARSE_MODE_NONE],
    ["FANCY_TIME", fancyTimeHtml, PARSE_MODE_NONE],
    ["SD", "", PARSE_MODE_NONE],
    ["SERVER_NAME_SAFE", guildName, PARSE_MODE_HTML_SAFE],
    ["CHANNEL_NAME_SAFE", escapeHtml(channel.name), PARSE_MODE_HTML_SAFE],
  ]);

  const finalHtml = saveImages ? await embedImages(html) : html;
  return { html: finalHtml, messageCount: messages.length, metaData };
}
