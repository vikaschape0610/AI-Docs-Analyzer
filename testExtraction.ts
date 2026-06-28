import fs from 'fs';
import path from 'path';
const pdfParse = require('pdf-parse');
import { parseExtractedText } from './src/lib/extraction/textParser';

async function testPdf(filepath: string) {
  try {
    const dataBuffer = fs.readFileSync(filepath);
    const data = await pdfParse(dataBuffer);
    const text = data.text;
    const filename = path.basename(filepath);
    console.log(`\n--- Testing ${filename} ---`);
    const result = parseExtractedText(text, filename);
    console.log('Document Type:', result.documentType);
    console.log('Extracted Fields:', result.extractedFields);
    
    // Log text to debug regex
    if (result.extractedFields.length < 3) {
      console.log('Raw text:\n', text.substring(0, 500));
    }
  } catch (error) {
    console.error(`Error parsing ${filepath}:`, error);
  }
}

async function run() {
  const docsDir = 'C:\\Users\\VIKAS\\OneDrive\\ドキュメント\\Desktop\\Documents';
  const files = [
    'Aadhaar Card.pdf',
    'Pan card .pdf',
    'SSC marksheet.pdf',
    'Income Certificate.pdf'
  ];

  for (const file of files) {
    await testPdf(path.join(docsDir, file));
  }
}

run();
