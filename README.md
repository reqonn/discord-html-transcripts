# discord-html-transcripts

Node.js port of [DiscordChatExporterPy](https://github.com/mahtoid/DiscordChatExporterPy) for discord.js v14+.

Generates beautiful HTML transcripts of Discord channels with full support for messages, embeds, attachments, components, reactions, and more.

## Installation

```bash
npm install github:YourUsername/discord-html-transcripts
```

## Usage

```js
import { createTranscript } from "discord-html-transcripts";

const { html, messageCount } = await createTranscript(channel, {
  limit: null,        // null = all messages
  bot: client,        // discord.js Client (for user lookups)
  militaryTime: true, // 24h clock
  fancyTimes: true,   // JS-based relative timestamps
});

// Send as file
const attachment = new AttachmentBuilder(Buffer.from(html, "utf-8"), {
  name: `transcript-${channel.name}.html`,
});
await logChannel.send({ files: [attachment] });
```

## Requirements

- Node.js 18+
- discord.js v14+

## Credits

HTML templates and design from [DiscordChatExporterPy](https://github.com/mahtoid/DiscordChatExporterPy) by mahtoid.
