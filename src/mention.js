// src/lib/transcript/mention.js
import { parseMarkdown } from "./markdown.js";

let _bot = null;

export function passBot(bot) {
  _bot = bot;
}

const ESCAPE_LT = "______lt______";
const ESCAPE_GT = "______gt______";
const ESCAPE_AMP = "______amp______";

const REGEX_ROLES = /&lt;@&amp;(\d+)&gt;/g;
const REGEX_ROLES_2 = /<@&(\d+)>/g;
const REGEX_EVERYONE = /@(everyone)(?:[$\s\t\n\f\r\0]|$)/g;
const REGEX_HERE = /@(here)(?:[$\s\t\n\f\r\0]|$)/g;
const REGEX_MEMBERS = /&lt;@!?(\d+)&gt;/g;
const REGEX_MEMBERS_2 = /<@!?(\d+)>/g;
const REGEX_CHANNELS = /&lt;#(\d+)&gt;/g;
const REGEX_CHANNELS_2 = /<#(\d+)>/g;
const REGEX_SLASH_COMMAND = /&lt;\/([\w]+ ?[\w]*):(\d+)&gt;/g;

const REGEX_TIME_HOLDER = [
  [/&lt;t:(\d{1,13}):t&gt;/g, { hour: "2-digit", minute: "2-digit" }],
  [/&lt;t:(\d{1,13}):T&gt;/g, { hour: "2-digit", minute: "2-digit", second: "2-digit" }],
  [/&lt;t:(\d{1,13}):d&gt;/g, { day: "2-digit", month: "2-digit", year: "numeric" }],
  [/&lt;t:(\d{1,13}):D&gt;/g, { day: "numeric", month: "long", year: "numeric" }],
  [/&lt;t:(\d{1,13}):f&gt;/g, { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }],
  [/&lt;t:(\d{1,13}):F&gt;/g, { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }],
  [/&lt;t:(\d{1,13}):R&gt;/g, { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }],
  [/&lt;t:(\d{1,13})&gt;/g, { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }],
];

const MENTION_ESCAPE_RE = new RegExp(
  `(${[
    "&lt;@&amp;\\d+&gt;", "&lt;@!?\\d+&gt;", "&lt;#\\d+&gt;", "&lt;a?:[^\\n:]+:\\d+&gt;",
    "<@&\\d+>", "<@!?\\d+>", "<#\\d+>", "<a?:[^\\n:]+:\\d+>",
  ].join("|")})`,
  "g"
);

function escapeMentions(content) {
  return content.replace(MENTION_ESCAPE_RE, (m) =>
    m.replace(/</g, ESCAPE_LT).replace(/>/g, ESCAPE_GT).replace(/&/g, ESCAPE_AMP)
  );
}

function unescapeMentions(content) {
  return content.replaceAll(ESCAPE_LT, "<").replaceAll(ESCAPE_GT, ">").replaceAll(ESCAPE_AMP, "&");
}

function channelMention(content, guild) {
  for (const regex of [REGEX_CHANNELS, REGEX_CHANNELS_2]) {
    content = content.replace(new RegExp(regex.source, regex.flags), (_, id) => {
      const channel = guild.channels?.cache?.get(id);
      if (!channel) return "#deleted-channel";
      return `<span class="mention" title="${channel.id}">#${channel.name}</span>`;
    });
  }
  return content;
}

function roleMention(content, guild) {
  for (const regex of [REGEX_EVERYONE, REGEX_HERE]) {
    content = content.replace(new RegExp(regex.source, regex.flags), (_, name) =>
      `<span class="mention" title="${name}">@${name}</span> `
    );
  }
  for (const regex of [REGEX_ROLES, REGEX_ROLES_2]) {
    content = content.replace(new RegExp(regex.source, regex.flags), (_, id) => {
      const role = guild.roles?.cache?.get(id);
      if (!role) return "@deleted-role";
      const colour = role.color === 0 ? "#dee0fc" : `#${role.color.toString(16).padStart(6, "0")}`;
      return `<span style="color: ${colour};">@${role.name}</span>`;
    });
  }
  return content;
}

function memberMention(content, guild) {
  for (const regex of [REGEX_MEMBERS, REGEX_MEMBERS_2]) {
    content = content.replace(new RegExp(regex.source, regex.flags), (_, id) => {
      const member = guild.members?.cache?.get(id) || _bot?.users?.cache?.get(id);
      if (member) {
        const name = member.displayName || member.username || id;
        return `<span class="mention" title="${id}">@${name}</span>`;
      }
      return `<span class="mention" title="${id}">&lt;@${id}></span>`;
    });
  }
  return content;
}

function timeMention(content) {
  for (const [regex, opts] of REGEX_TIME_HOLDER) {
    content = content.replace(new RegExp(regex.source, regex.flags), (full, ts) => {
      try {
        const timestamp = parseInt(ts, 10);
        const date = new Date(timestamp * 1000);
        const uiTime = date.toLocaleString("en-GB", { ...opts, timeZone: "UTC" });
        const tooltip = date.toLocaleString("en-GB", {
          weekday: "long", day: "numeric", month: "long", year: "numeric",
          hour: "2-digit", minute: "2-digit", timeZone: "UTC",
        });
        const original = full.replace(/&lt;/g, "<").replace(/&gt;/g, ">");
        return `<span class="unix-timestamp" data-timestamp="${tooltip}" raw-content="${original}">${uiTime}</span>`;
      } catch {
        return full;
      }
    });
  }
  return content;
}

function slashCommandMention(content) {
  content = content.replace(new RegExp(REGEX_SLASH_COMMAND.source, REGEX_SLASH_COMMAND.flags), (_, name) =>
    `<span class="mention" title="${name}">/${name}</span>`
  );
  return content;
}

export async function parseMention(content, guild) {
  content = escapeMentions(content);
  content = escapeMentions(content);
  content = unescapeMentions(content);
  content = channelMention(content, guild);
  content = memberMention(content, guild);
  content = roleMention(content, guild);
  content = timeMention(content);
  content = slashCommandMention(content);
  return content;
}
