import mammoth from 'mammoth';
import { extractText, getDocumentProxy } from 'unpdf';

export class CvError extends Error {}
const MAX_BYTES = 5_000_000;

/** Turns an uploaded CV into plain text. The file is never stored; only the text goes back to the app. */
export async function parseCv(name: string, data: Buffer): Promise<string> {
  if (data.length === 0) throw new CvError('That file is empty.');
  if (data.length > MAX_BYTES) throw new CvError('That file is larger than 5 MB.');
  const ext = name.toLowerCase().split('.').pop();
  let text: string;
  try {
    if (ext === 'pdf') text = (await extractText(await getDocumentProxy(new Uint8Array(data)), { mergePages: true })).text;
    else if (ext === 'docx') text = (await mammoth.extractRawText({ buffer: data })).value;
    else if (ext === 'txt' || ext === 'md') text = data.toString('utf8');
    else throw new CvError('Use a PDF, DOCX or TXT file. For an old .doc file, save it as DOCX first.');
  } catch (e) {
    if (e instanceof CvError) throw e;
    throw new CvError('Could not read that file. Paste your CV text instead.');
  }
  text = text.replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (text.length < 40) throw new CvError('No readable text found (scanned PDFs have none). Paste your CV text instead.');
  return text.slice(0, 60_000);
}
