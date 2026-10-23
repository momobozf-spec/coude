/**
 * Tekstextractie uit een PDF.
 *
 * Gebruik: node scripts/extract-pdf.mjs <input.pdf> [output.txt]
 *
 * Dezelfde extractie wordt in de app gebruikt voor de contractscan
 * (src/lib/contract/extract.ts). Dit script is de handmatige variant, om
 * referentiedocumenten in te lezen.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const [, , input, output] = process.argv;

if (!input) {
  console.error('Gebruik: node scripts/extract-pdf.mjs <input.pdf> [output.txt]');
  process.exit(1);
}

const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

const data = new Uint8Array(readFileSync(input));
const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;

let text = '';
for (let page = 1; page <= doc.numPages; page += 1) {
  const content = await (await doc.getPage(page)).getTextContent();
  text += `\n===== PAGINA ${page} =====\n`;
  text += content.items
    .map((item) => ('str' in item ? item.str : ''))
    .join(' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

if (output) {
  writeFileSync(output, text, 'utf8');
  console.error(`${doc.numPages} pagina's, ${text.length} tekens -> ${output}`);
} else {
  process.stdout.write(text);
}
