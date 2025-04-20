// scripts/check-pdf-content.mjs
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import pdfParse from 'pdf-parse';

// Get the directory name of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  try {
    // Path to the PDF file
    const pdfPath = path.join(__dirname, '..', 'public', 'testcourse.pdf');
    
    // Read the PDF file
    console.log(`Reading PDF file: ${pdfPath}`);
    const dataBuffer = await fs.readFile(pdfPath);
    
    // Parse the PDF
    const data = await pdfParse(dataBuffer);
    
    // Log information about the parsed PDF
    console.log(`PDF loaded. Page count: ${data.numpages}`);
    console.log(`Text length: ${data.text.length} characters`);
    
    // Print the first 500 characters of the extracted text
    console.log("\nPreview of extracted text:");
    console.log("--------------------------");
    console.log(data.text.substring(0, 500));
    console.log("--------------------------");
    
    // Save the extracted text to a file for inspection
    const outputPath = path.join(__dirname, '..', 'extracted-pdf-text.txt');
    await fs.writeFile(outputPath, data.text, 'utf8');
    console.log(`\nFull text saved to: ${outputPath}`);
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the script
main(); 