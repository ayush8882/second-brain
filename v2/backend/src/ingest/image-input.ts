import type { Base64ImageSource, ImageBlockParam } from '@anthropic-ai/sdk/resources/messages';

export type ImageMediaType = Base64ImageSource['media_type'];

const MAX_IMAGES = 10;
/** ~5 MB decoded per image */
const MAX_BASE64_BYTES = 5 * 1024 * 1024;

const DATA_URI_RE =
  /^data:(image\/(?:jpeg|jpg|png|gif|webp));base64,([\s\S]+)$/i;

const URL_RE = /^https?:\/\/.+/i;

const MIME_MAP: Record<string, ImageMediaType> = {
  'image/jpeg': 'image/jpeg',
  'image/jpg': 'image/jpeg',
  'image/png': 'image/png',
  'image/gif': 'image/gif',
  'image/webp': 'image/webp',
};

export function normalizeImageInputs(
  images: string[],
): ImageBlockParam[] {
  if (!images.length) {
    throw new Error('BAD_REQUEST: At least one image is required.');
  }
  if (images.length > MAX_IMAGES) {
    throw new Error(
      `BAD_REQUEST: At most ${MAX_IMAGES} images per request.`,
    );
  }

  return images.map((raw, index) => {
    try {
      return toImageBlock(raw);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Invalid image';
      throw new Error(`BAD_REQUEST: Image ${index + 1}: ${msg}`);
    }
  });
}

function toImageBlock(raw: string): ImageBlockParam {
  const input = raw.trim();
  if (!input) {
    throw new Error('Empty image input');
  }

  if (URL_RE.test(input)) {
    return {
      type: 'image',
      source: { type: 'url', url: input },
    };
  }

  const dataUri = DATA_URI_RE.exec(input);
  if (dataUri) {
    const mime = MIME_MAP[dataUri[1]!.toLowerCase()] ?? 'image/jpeg';
    const data = stripBase64(dataUri[2]!);
    assertBase64Size(data);
    return {
      type: 'image',
      source: { type: 'base64', media_type: mime, data },
    };
  }

  const data = stripBase64(input);
  assertBase64Size(data);
  const mediaType = detectMediaTypeFromBase64(data);
  return {
    type: 'image',
    source: { type: 'base64', media_type: mediaType, data },
  };
}

function stripBase64(data: string): string {
  return data.replace(/\s/g, '');
}

function assertBase64Size(data: string): void {
  const bytes = Buffer.byteLength(data, 'base64');
  if (bytes > MAX_BASE64_BYTES) {
    throw new Error(
      `Image exceeds ${MAX_BASE64_BYTES / (1024 * 1024)}MB size limit`,
    );
  }
  if (bytes < 16) {
    throw new Error('Image data is too small or invalid base64');
  }
}

function detectMediaTypeFromBase64(data: string): ImageMediaType {
  let buf: Buffer;
  try {
    buf = Buffer.from(data.slice(0, 48), 'base64');
  } catch {
    throw new Error('Invalid base64 image data');
  }

  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return 'image/png';
  }
  if (
    buf.length >= 6 &&
    buf[0] === 0x47 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46
  ) {
    return 'image/gif';
  }
  if (
    buf.length >= 12 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }

  throw new Error(
    'Could not detect image type; use a data URI (data:image/...;base64,...) or a supported format (JPEG, PNG, GIF, WebP)',
  );
}

/** Short label for source_ref / logging */
export function summarizeImageSources(images: string[]): string {
  const trimmed = images.map((i) => i.trim()).filter(Boolean);
  const urls = trimmed.filter((i) => URL_RE.test(i));
  if (urls.length === trimmed.length) {
    return urls.length === 1 ? urls[0]! : `${urls.length} image URLs`;
  }
  if (trimmed.every((i) => DATA_URI_RE.test(i) || !URL_RE.test(i))) {
    return `${trimmed.length} image(s) (base64)`;
  }
  return `${trimmed.length} image(s)`;
}
