import { readFile, stat } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { PDFParse } from 'pdf-parse';
import { config } from '../config/config';

function assertPathUnderIngestRoot(filePath: string): string {
  const root = config.ingestFilesRoot;
  if (!root) {
    throw new Error(
      'BAD_REQUEST: PDF ingest requires INGEST_FILES_ROOT pointing at the directory that contains upload files.',
    );
  }
  const resolvedFile = resolve(filePath);
  const resolvedRoot = resolve(root);
  if (
    resolvedFile !== resolvedRoot &&
    !resolvedFile.startsWith(resolvedRoot + sep)
  ) {
    throw new Error(
      'BAD_REQUEST: filePath must resolve inside INGEST_FILES_ROOT.',
    );
  }
  return resolvedFile;
}

export async function parsePdf(filePath: string): Promise<string> {
  const safePath = assertPathUnderIngestRoot(filePath);
  let st;
  try {
    st = await stat(safePath);
  } catch (e) {
    const code = (e as NodeJS.ErrnoException)?.code;
    if (code === 'ENOENT') {
      throw new Error('BAD_REQUEST: File not found.');
    }
    throw e;
  }
  if (!st.isFile()) {
    throw new Error('BAD_REQUEST: filePath is not a regular file.');
  }

  const data = await readFile(safePath);
  const parser = new PDFParse({ data });
  try {
    const result = await parser.getText();
    return result.text.trim();
  } finally {
    await parser.destroy();
  }
}
