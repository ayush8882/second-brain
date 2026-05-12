import * as cheerio from 'cheerio';
import { PDFParse } from 'pdf-parse';
import { config } from '../config/config';

function htmlToPlainText(html: string): string {
  const $ = cheerio.load(html);
  $('script, style, noscript, iframe, svg').remove();
  const text = $('body').length ? $('body').text() : $.root().text();
  return text.replace(/\s+/g, ' ').trim();
}

export async function parseUrl(urlString: string): Promise<string> {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new Error('BAD_REQUEST: Invalid URL.');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('BAD_REQUEST: Only http and https URLs are allowed.');
  }

  const timeoutMs = config.urlFetchTimeoutMs;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(urlString, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'user-agent': 'SecondBrain-Ingest/1.0',
        accept:
          'text/html,application/xhtml+xml,application/pdf,text/plain;q=0.9,*/*;q=0.8',
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch URL (HTTP ${res.status}).`);
    }

    const rawType = res.headers.get('content-type') ?? '';
    const contentType = rawType.split(';')[0]?.trim().toLowerCase() ?? '';
    const buf = Buffer.from(await res.arrayBuffer());

    const looksPdf =
      contentType === 'application/pdf' ||
      contentType === 'application/x-pdf' ||
      urlString.toLowerCase().split('?')[0]?.endsWith('.pdf');

    if (looksPdf) {
      const parser = new PDFParse({ data: buf });
      try {
        const result = await parser.getText();
        return result.text.trim();
      } finally {
        await parser.destroy();
      }
    }

    if (
      contentType.includes('text/html') ||
      contentType.includes('application/xhtml')
    ) {
      return htmlToPlainText(buf.toString('utf8'));
    }

    return buf.toString('utf8').trim();
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms.`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
