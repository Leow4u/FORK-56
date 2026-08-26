/** Extract embedded data-URL images and @image: refs from message text. */

const DATA_IMAGE_PREFIX = "data:image/";
const BASE64_MARKER = ";base64,";
const MIN_EMBEDDED_IMAGE_BASE64_LENGTH = 64;
const JSON_IMAGE_OPEN_RE =
  /\{\s*"type"\s*:\s*"image_url"\s*,\s*"image_url"\s*:\s*\{\s*"url"\s*:\s*"$/;
const JSON_IMAGE_CLOSE_RE = /^"\s*\}\s*\}/;
const JSON_IMAGE_OPEN_MAX = 96;
const JSON_IMAGE_CLOSE_MAX = 16;
const IMAGE_REF_LINE_RE = /^@image:[^\n]*\n?/gm;
const SCREENSHOT_PLACEHOLDER_LINE_RE = /^\[screenshot\]\n?/gm;

export interface EmbeddedImageExtraction {
  cleanedText: string;
  images: string[];
}

function isImageMimeCode(code: number): boolean {
  return (
    (code >= 48 && code <= 57) ||
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122) ||
    code === 43 ||
    code === 45 ||
    code === 46 ||
    code === 95
  );
}

function isBase64Code(code: number): boolean {
  return (
    (code >= 48 && code <= 57) ||
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122) ||
    code === 43 ||
    code === 47 ||
    code === 61
  );
}

function readDataImageUrl(
  text: string,
  start: number,
): { end: number; url: string } | null {
  if (!text.startsWith(DATA_IMAGE_PREFIX, start)) return null;
  let cursor = start + DATA_IMAGE_PREFIX.length;
  while (cursor < text.length && isImageMimeCode(text.charCodeAt(cursor))) {
    cursor += 1;
  }
  if (
    cursor === start + DATA_IMAGE_PREFIX.length ||
    !text.startsWith(BASE64_MARKER, cursor)
  ) {
    return null;
  }
  cursor += BASE64_MARKER.length;
  const base64Start = cursor;
  while (cursor < text.length && isBase64Code(text.charCodeAt(cursor))) {
    cursor += 1;
  }
  if (cursor - base64Start < MIN_EMBEDDED_IMAGE_BASE64_LENGTH) return null;
  return { end: cursor, url: text.slice(start, cursor) };
}

function embeddedImageRemovalRange(
  text: string,
  dataStart: number,
  dataEnd: number,
): { end: number; start: number } {
  let start = dataStart;
  let end = dataEnd;
  const openSearchStart = Math.max(0, dataStart - JSON_IMAGE_OPEN_MAX);
  const openMatch = text.slice(openSearchStart, dataStart).match(JSON_IMAGE_OPEN_RE);
  if (openMatch?.index !== undefined) {
    const close = text
      .slice(dataEnd, dataEnd + JSON_IMAGE_CLOSE_MAX)
      .match(JSON_IMAGE_CLOSE_RE);
    if (close) {
      start = openSearchStart + openMatch.index;
      end = dataEnd + close[0].length;
    }
  }
  return { end, start };
}

function normalizeCleanedText(text: string): string {
  return text
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extractEmbeddedImages(text: string): EmbeddedImageExtraction {
  if (!text || !text.includes(DATA_IMAGE_PREFIX)) {
    return { cleanedText: text, images: [] };
  }
  const images: string[] = [];
  const pieces: string[] = [];
  let appendCursor = 0;
  let searchCursor = 0;
  while (searchCursor < text.length) {
    const dataStart = text.indexOf(DATA_IMAGE_PREFIX, searchCursor);
    if (dataStart === -1) break;
    const dataUrl = readDataImageUrl(text, dataStart);
    if (!dataUrl) {
      searchCursor = dataStart + DATA_IMAGE_PREFIX.length;
      continue;
    }
    const range = embeddedImageRemovalRange(text, dataStart, dataUrl.end);
    pieces.push(text.slice(appendCursor, range.start));
    images.push(dataUrl.url);
    appendCursor = range.end;
    searchCursor = range.end;
  }
  if (!images.length) return { cleanedText: text, images: [] };
  pieces.push(text.slice(appendCursor));
  return { cleanedText: normalizeCleanedText(pieces.join("")), images };
}

export function extractImageRefs(text: string): {
  cleanedText: string;
  refs: string[];
} {
  const refs: string[] = [];
  let cleanedText = text.replace(IMAGE_REF_LINE_RE, (match) => {
    refs.push(match.trim());
    return "";
  });
  if (refs.length) {
    cleanedText = cleanedText.replace(SCREENSHOT_PLACEHOLDER_LINE_RE, "");
  }
  return { cleanedText: cleanedText.trim(), refs };
}

/** Parse `@image:/abs/path` → absolute path (strip optional backticks). */
export function imageRefPath(ref: string): string {
  const raw = ref.replace(/^@image:/, "").trim();
  if (raw.startsWith("`") && raw.endsWith("`") && raw.length >= 2) {
    return raw.slice(1, -1);
  }
  return raw;
}
