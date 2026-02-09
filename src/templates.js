// src/templates.js
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const htmlDir = join(__dirname, "html");

function read(file) {
  return readFileSync(join(htmlDir, file), "utf-8");
}

// Parse modes
export const PARSE_MODE_NONE = 0;
export const PARSE_MODE_NO_MARKDOWN = 1;
export const PARSE_MODE_MARKDOWN = 2;
export const PARSE_MODE_EMBED = 3;
export const PARSE_MODE_SPECIAL_EMBED = 4;
export const PARSE_MODE_REFERENCE = 5;
export const PARSE_MODE_EMOJI = 6;
export const PARSE_MODE_HTML_SAFE = 7;

// Messages
export const start_message = read("message/start.html");
export const bot_tag = read("message/bot-tag.html");
export const bot_tag_verified = read("message/bot-tag-verified.html");
export const message_content = read("message/content.html");
export const message_reference = read("message/reference.html");
export const message_interaction = read("message/interaction.html");
export const message_pin = read("message/pin.html");
export const message_thread = read("message/thread.html");
export const message_thread_remove = read("message/thread_remove.html");
export const message_thread_add = read("message/thread_add.html");
export const message_reference_unknown = read("message/reference_unknown.html");
export const message_reference_forwarded = read("message/reference_forwarded.html");
export const message_body = read("message/message.html");
export const end_message = read("message/end.html");
export const meta_data_temp = read("message/meta.html");

// Components
export const component_button = read("component/component_button.html");
export const component_menu = read("component/component_menu.html");
export const component_menu_options = read("component/component_menu_options.html");
export const component_menu_options_emoji = read("component/component_menu_options_emoji.html");
export const component_container = read("component/component_container.html");
export const component_section = read("component/component_section.html");
export const component_text_display = read("component/component_text_display.html");
export const component_thumbnail = read("component/component_thumbnail.html");
export const component_media_gallery = read("component/component_media_gallery.html");
export const component_media_gallery_item = read("component/component_media_gallery_item.html");
export const component_separator = read("component/component_separator.html");
export const component_file = read("component/component_file.html");

// Embeds
export const embed_body = read("embed/body.html");
export const embed_title = read("embed/title.html");
export const embed_description = read("embed/description.html");
export const embed_field = read("embed/field.html");
export const embed_field_inline = read("embed/field-inline.html");
export const embed_footer = read("embed/footer.html");
export const embed_footer_icon = read("embed/footer_image.html");
export const embed_image = read("embed/image.html");
export const embed_thumbnail = read("embed/thumbnail.html");
export const embed_author = read("embed/author.html");
export const embed_author_icon = read("embed/author_icon.html");

// Reactions
export const emoji_template = read("reaction/emoji.html");
export const custom_emoji_template = read("reaction/custom_emoji.html");

// Attachments
export const img_attachment = read("attachment/image.html");
export const msg_attachment = read("attachment/message.html");
export const audio_attachment = read("attachment/audio.html");
export const video_attachment = read("attachment/video.html");

// Full transcript
export const total = read("base.html");

// Scripts
export const fancy_time = read("script/fancy_time.html");
export const channel_topic = read("script/channel_topic.html");
export const channel_subject = read("script/channel_subject.html");
