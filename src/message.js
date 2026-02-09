// src/lib/transcript/message.js
import { MessageType } from "discord.js";
import { fillOut, escapeHtml } from "./fillOut.js";
import { DiscordUtils } from "./discordUtils.js";
import { buildAttachment, buildEmbed, buildReaction, buildComponent } from "./assets.js";
import {
  PARSE_MODE_NONE, PARSE_MODE_MARKDOWN, PARSE_MODE_REFERENCE,
  start_message, end_message, message_body, message_content,
  message_reference, message_reference_unknown, message_reference_forwarded,
  message_interaction, message_pin, message_thread,
  message_thread_remove, message_thread_add,
  bot_tag, bot_tag_verified, img_attachment,
} from "./templates.js";

function gatherUserBot(author) {
  if (author.bot && author.flags?.has?.("VerifiedBot")) return bot_tag_verified;
  if (author.bot) return bot_tag;
  return "";
}

function discriminator(name, discrim) {
  if (discrim && discrim !== "0") return `${name}#${discrim}`;
  return name;
}

function setEditAt(editedAt) {
  return `<span class="chatlog__reference-edited-timestamp" data-timestamp="${editedAt}">(edited)</span>`;
}

function formatTimestamp(date, military = true) {
  if (!date) return "";
  const d = new Date(date);
  if (military) {
    return d.toLocaleString("en-GB", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC",
    });
  }
  return d.toLocaleString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "UTC",
  });
}

function formatDefaultTimestamp(date, military = true) {
  if (!date) return "";
  const d = new Date(date);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  if (military) {
    const h = String(d.getUTCHours()).padStart(2, "0");
    const m = String(d.getUTCMinutes()).padStart(2, "0");
    return `${day}-${month}-${year} ${h}:${m}`;
  }
  let h = d.getUTCHours();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  const m = String(d.getUTCMinutes()).padStart(2, "0");
  return `${day}-${month}-${year} ${h}:${m} ${ampm}`;
}

async function gatherUserColour(author, guild) {
  const member = guild.members?.cache?.get(author.id);
  if (member && member.displayColor !== 0) {
    return `color: #${member.displayColor.toString(16).padStart(6, "0")};`;
  }
  return "color: #FFFFFF;";
}

async function gatherUserIcon(author, guild) {
  const member = guild.members?.cache?.get(author.id);
  if (!member) return "";
  if (member.displayIcon) {
    return `<img class='chatlog__role-icon' src='${member.displayIcon}' alt='Role Icon'>`;
  }
  if (member.roles?.highest?.icon) {
    return `<img class='chatlog__role-icon' src='${member.roles.highest.iconURL()}' alt='Role Icon'>`;
  }
  return "";
}

function collectAttachmentUrls(attachment) {
  const urls = new Set();
  if (attachment.url) urls.add(String(attachment.url));
  if (attachment.proxyURL) urls.add(String(attachment.proxyURL));
  return urls;
}

function embedHasNonImageContent(embed) {
  if (embed.title) return true;
  if (embed.description) return true;
  if (embed.fields?.length) return true;
  if (embed.author?.name) return true;
  if (embed.footer?.text) return true;
  if (embed.thumbnail?.url) return true;
  return false;
}

function isDuplicateImageEmbed(embed, attachmentUrls) {
  if (!attachmentUrls.size) return false;
  const imageUrl = embed.image?.proxyURL || embed.image?.url;
  if (!imageUrl || !attachmentUrls.has(String(imageUrl))) return false;
  return !embedHasNonImageContent(embed);
}

export async function gatherMessages(messages, guild, militaryTime = true) {
  let messageHtml = "";
  const metaData = {};
  let previousMessage = null;
  const messageDict = new Map(messages.map((m) => [m.id, m]));

  for (const message of messages) {
    const { html, meta } = await constructMessage(message, previousMessage, guild, metaData, messageDict, militaryTime);
    messageHtml += html;
    previousMessage = message;
  }

  messageHtml += "</div>";
  return { messageHtml, metaData };
}

async function constructMessage(message, previousMessage, guild, metaData, messageDict, militaryTime) {
  if (message.type === MessageType.ChannelPinnedMessage) {
    return buildPin(message, previousMessage, guild, metaData, militaryTime);
  }
  if (message.type === MessageType.ThreadCreated) {
    return buildThread(message, previousMessage, guild, metaData, militaryTime);
  }
  if (message.type === MessageType.RecipientRemove) {
    return buildThreadRemove(message, previousMessage, guild, metaData, militaryTime);
  }
  if (message.type === MessageType.RecipientAdd) {
    return buildThreadAdd(message, previousMessage, guild, metaData, militaryTime);
  }
  return buildFullMessage(message, previousMessage, guild, metaData, messageDict, militaryTime);
}

async function buildFullMessage(message, previousMessage, guild, metaData, messageDict, militaryTime) {
  let html = "";
  const createdAt = formatTimestamp(message.createdAt, militaryTime);
  let editedAt = message.editedAt ? formatTimestamp(message.editedAt, militaryTime) : "";

  // Content
  let contentHtml = "";
  if (message.content) {
    if (editedAt) editedAt = setEditAt(editedAt);
    const escaped = escapeHtml(message.content);
    contentHtml = await fillOut(guild, message_content, [
      ["MESSAGE_CONTENT", escaped, PARSE_MODE_MARKDOWN],
      ["EDIT", editedAt, PARSE_MODE_NONE],
    ]);
  }

  // Reference
  let referenceHtml = "";
  if (message.reference?.messageId) {
    const refMsg = messageDict.get(message.reference.messageId);
    if (refMsg) {
      const isBot = gatherUserBot(refMsg.author);
      const userColour = await gatherUserColour(refMsg.author, guild);
      const avatarUrl = refMsg.author.displayAvatarURL?.() || DiscordUtils.default_avatar;

      let icon = "";
      let dummy = "";
      const interaction = refMsg.interaction || refMsg.interactionMetadata;
      if (!interaction && (refMsg.embeds?.length || refMsg.attachments?.size)) {
        icon = DiscordUtils.reference_attachment_icon;
        dummy = "Click to see attachment";
      } else if (interaction) {
        icon = DiscordUtils.interaction_command_icon;
        dummy = "Click to see command";
      }

      const refContent = refMsg.content || dummy;
      let refEditedAt = refMsg.editedAt ? setEditAt(formatTimestamp(refMsg.editedAt, militaryTime)) : "";

      referenceHtml = await fillOut(guild, message_reference, [
        ["AVATAR_URL", avatarUrl, PARSE_MODE_NONE],
        ["BOT_TAG", isBot, PARSE_MODE_NONE],
        ["NAME_TAG", discriminator(refMsg.author.username, refMsg.author.discriminator), PARSE_MODE_NONE],
        ["NAME", escapeHtml(refMsg.author.displayName || refMsg.author.username)],
        ["USER_COLOUR", userColour, PARSE_MODE_NONE],
        ["CONTENT", refContent.replace(/\n/g, "").replace(/<br>/g, ""), PARSE_MODE_REFERENCE],
        ["EDIT", refEditedAt, PARSE_MODE_NONE],
        ["ICON", icon, PARSE_MODE_NONE],
        ["USER_ID", String(refMsg.author.id), PARSE_MODE_NONE],
        ["MESSAGE_ID", String(message.reference.messageId), PARSE_MODE_NONE],
      ]);
    } else {
      referenceHtml = message_reference_unknown;
    }
  }

  // Interaction
  let interactionHtml = "";
  const interactionData = message.interaction || message.interactionMetadata;
  if (interactionData) {
    const user = interactionData.user;
    if (user) {
      const isBot = gatherUserBot(user);
      const userColour = await gatherUserColour(user, guild);
      const avatarUrl = user.displayAvatarURL?.() || DiscordUtils.default_avatar;
      const command = interactionData.commandName ? `/${interactionData.commandName}` : "a slash command";

      interactionHtml = await fillOut(guild, message_interaction, [
        ["AVATAR_URL", avatarUrl, PARSE_MODE_NONE],
        ["BOT_TAG", isBot, PARSE_MODE_NONE],
        ["NAME_TAG", discriminator(user.username, user.discriminator), PARSE_MODE_NONE],
        ["NAME", escapeHtml(user.displayName || user.username)],
        ["COMMAND", command, PARSE_MODE_NONE],
        ["USER_COLOUR", userColour, PARSE_MODE_NONE],
        ["FILLER", "used ", PARSE_MODE_NONE],
        ["USER_ID", String(user.id), PARSE_MODE_NONE],
        ["INTERACTION_ID", String(interactionData.id), PARSE_MODE_NONE],
      ]);
    }
  }

  // Sticker
  let stickerHtml = "";
  if (message.stickers?.size) {
    const sticker = message.stickers.first();
    if (sticker.url) {
      stickerHtml = await fillOut(guild, img_attachment, [
        ["ATTACH_URL", sticker.url, PARSE_MODE_NONE],
        ["ATTACH_URL_THUMB", sticker.url, PARSE_MODE_NONE],
      ]);
    }
  }

  // Assets
  let embedsHtml = "";
  let attachmentsHtml = "";
  let componentsHtml = "";
  let reactionsHtml = "";

  const attachmentUrls = new Set();
  const attachments = [...(message.attachments?.values() || [])];
  for (const a of attachments) {
    collectAttachmentUrls(a).forEach((u) => attachmentUrls.add(u));
  }

  for (const e of message.embeds || []) {
    if (isDuplicateImageEmbed(e, attachmentUrls)) continue;
    embedsHtml += await buildEmbed(e, guild);
  }

  for (const a of attachments) {
    attachmentsHtml += await buildAttachment(a, guild);
  }

  for (const c of message.components || []) {
    componentsHtml += await buildComponent(c, guild, attachments);
  }

  for (const r of message.reactions?.cache?.values() || []) {
    reactionsHtml += await buildReaction(r, guild);
  }
  if (reactionsHtml) {
    reactionsHtml = `<div class="chatlog__reactions">${reactionsHtml}</div>`;
  }

  // Use sticker as content if present
  if (stickerHtml) contentHtml = stickerHtml;

  // Message divider check
  const needsDivider = !previousMessage ||
    referenceHtml !== "" ||
    interactionHtml !== "" ||
    previousMessage.type !== MessageType.Default ||
    previousMessage.author.id !== message.author.id ||
    message.webhookId != null ||
    (message.createdTimestamp - previousMessage.createdTimestamp) > 4 * 60 * 1000;

  if (needsDivider) {
    if (previousMessage) html += await fillOut(guild, end_message, []);

    const isBot = gatherUserBot(message.author);
    const avatarUrl = message.author.displayAvatarURL?.() || DiscordUtils.default_avatar;
    const followupSymbol = (referenceHtml || interactionHtml) ? "<div class='chatlog__followup-symbol'></div>" : "";
    const defaultTimestamp = formatDefaultTimestamp(message.createdAt, militaryTime);

    html += await fillOut(guild, start_message, [
      ["REFERENCE_SYMBOL", followupSymbol, PARSE_MODE_NONE],
      ["REFERENCE", referenceHtml || interactionHtml, PARSE_MODE_NONE],
      ["AVATAR_URL", avatarUrl, PARSE_MODE_NONE],
      ["NAME_TAG", discriminator(message.author.username, message.author.discriminator), PARSE_MODE_NONE],
      ["USER_ID", String(message.author.id)],
      ["USER_COLOUR", await gatherUserColour(message.author, guild)],
      ["USER_ICON", await gatherUserIcon(message.author, guild), PARSE_MODE_NONE],
      ["NAME", escapeHtml(message.author.displayName || message.author.username)],
      ["BOT_TAG", isBot, PARSE_MODE_NONE],
      ["TIMESTAMP", createdAt],
      ["DEFAULT_TIMESTAMP", defaultTimestamp, PARSE_MODE_NONE],
      ["MESSAGE_ID", String(message.id)],
      ["MESSAGE_CONTENT", contentHtml, PARSE_MODE_NONE],
      ["EMBEDS", embedsHtml, PARSE_MODE_NONE],
      ["ATTACHMENTS", attachmentsHtml, PARSE_MODE_NONE],
      ["COMPONENTS", componentsHtml, PARSE_MODE_NONE],
      ["EMOJI", reactionsHtml, PARSE_MODE_NONE],
    ]);
  } else {
    const timeParts = createdAt.split(/\s+/);
    const shortTime = timeParts.length >= 5 ? timeParts.slice(4).join(" ") : createdAt;

    html += await fillOut(guild, message_body, [
      ["MESSAGE_ID", String(message.id)],
      ["MESSAGE_CONTENT", contentHtml, PARSE_MODE_NONE],
      ["EMBEDS", embedsHtml, PARSE_MODE_NONE],
      ["ATTACHMENTS", attachmentsHtml, PARSE_MODE_NONE],
      ["COMPONENTS", componentsHtml, PARSE_MODE_NONE],
      ["EMOJI", reactionsHtml, PARSE_MODE_NONE],
      ["TIMESTAMP", createdAt, PARSE_MODE_NONE],
      ["TIME", shortTime, PARSE_MODE_NONE],
    ]);
  }

  // Meta data
  buildMetaData(message, metaData, guild);

  return { html, meta: metaData };
}

function buildMetaData(message, metaData, guild) {
  const userId = message.author.id;
  if (metaData[userId]) {
    metaData[userId].messageCount += 1;
  } else {
    const member = guild.members?.cache?.get(userId);
    metaData[userId] = {
      name: discriminator(message.author.username, message.author.discriminator),
      createdAt: message.author.createdAt,
      botTag: gatherUserBot(message.author),
      avatar: message.author.displayAvatarURL?.() || DiscordUtils.default_avatar,
      messageCount: 1,
      joinedAt: member?.joinedAt || null,
      displayName: message.author.displayName !== message.author.username
        ? `<div class="meta__display-name">${message.author.displayName}</div>`
        : "",
    };
  }
}

async function buildPin(message, previousMessage, guild, metaData, militaryTime) {
  let html = "";
  if (previousMessage) html += await fillOut(guild, end_message, []);

  html += await fillOut(guild, message_pin, [
    ["PIN_URL", DiscordUtils.pinned_message_icon, PARSE_MODE_NONE],
    ["USER_COLOUR", await gatherUserColour(message.author, guild)],
    ["NAME", escapeHtml(message.author.displayName || message.author.username)],
    ["NAME_TAG", discriminator(message.author.username, message.author.discriminator), PARSE_MODE_NONE],
    ["MESSAGE_ID", String(message.id), PARSE_MODE_NONE],
    ["REF_MESSAGE_ID", message.reference?.messageId ? String(message.reference.messageId) : "", PARSE_MODE_NONE],
  ]);

  return { html, meta: metaData };
}

async function buildThread(message, previousMessage, guild, metaData, militaryTime) {
  let html = "";
  if (previousMessage) html += await fillOut(guild, end_message, []);

  html += await fillOut(guild, message_thread, [
    ["THREAD_URL", DiscordUtils.thread_channel_icon, PARSE_MODE_NONE],
    ["THREAD_NAME", message.content || "", PARSE_MODE_NONE],
    ["USER_COLOUR", await gatherUserColour(message.author, guild)],
    ["NAME", escapeHtml(message.author.displayName || message.author.username)],
    ["NAME_TAG", discriminator(message.author.username, message.author.discriminator), PARSE_MODE_NONE],
    ["MESSAGE_ID", String(message.id), PARSE_MODE_NONE],
  ]);

  return { html, meta: metaData };
}

async function buildThreadRemove(message, previousMessage, guild, metaData, militaryTime) {
  let html = "";
  if (previousMessage) html += await fillOut(guild, end_message, []);

  const removedMember = message.mentions?.users?.first();
  if (!removedMember) return { html, meta: metaData };

  html += await fillOut(guild, message_thread_remove, [
    ["THREAD_URL", DiscordUtils.thread_remove_recipient, PARSE_MODE_NONE],
    ["USER_COLOUR", await gatherUserColour(message.author, guild)],
    ["NAME", escapeHtml(message.author.displayName || message.author.username)],
    ["NAME_TAG", discriminator(message.author.username, message.author.discriminator), PARSE_MODE_NONE],
    ["RECIPIENT_USER_COLOUR", await gatherUserColour(removedMember, guild)],
    ["RECIPIENT_NAME", escapeHtml(removedMember.displayName || removedMember.username)],
    ["RECIPIENT_NAME_TAG", discriminator(removedMember.username, removedMember.discriminator), PARSE_MODE_NONE],
    ["MESSAGE_ID", String(message.id), PARSE_MODE_NONE],
  ]);

  return { html, meta: metaData };
}

async function buildThreadAdd(message, previousMessage, guild, metaData, militaryTime) {
  let html = "";
  if (previousMessage) html += await fillOut(guild, end_message, []);

  const addedMember = message.mentions?.users?.first();
  if (!addedMember) return { html, meta: metaData };

  html += await fillOut(guild, message_thread_add, [
    ["THREAD_URL", DiscordUtils.thread_add_recipient, PARSE_MODE_NONE],
    ["USER_COLOUR", await gatherUserColour(message.author, guild)],
    ["NAME", escapeHtml(message.author.displayName || message.author.username)],
    ["NAME_TAG", discriminator(message.author.username, message.author.discriminator), PARSE_MODE_NONE],
    ["RECIPIENT_USER_COLOUR", await gatherUserColour(addedMember, guild)],
    ["RECIPIENT_NAME", escapeHtml(addedMember.displayName || addedMember.username)],
    ["RECIPIENT_NAME_TAG", discriminator(addedMember.username, addedMember.discriminator), PARSE_MODE_NONE],
    ["MESSAGE_ID", String(message.id), PARSE_MODE_NONE],
  ]);

  return { html, meta: metaData };
}
