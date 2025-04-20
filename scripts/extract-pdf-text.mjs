// scripts/extract-pdf-text.mjs
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';

// Get the directory name of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Set up worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = path.resolve(__dirname, '../node_modules/pdfjs-dist/legacy/build/pdf.worker.js');

async function extractTextFromPage(page) {
  const textContent = await page.getTextContent();
  
  // Extract text items and join them
  return textContent.items
    .map(item => item.str)
    .join(' ');
}

async function extractTextFromPDF(pdfPath) {
  try {
    console.log(`Reading PDF file: ${pdfPath}`);
    
    // Read the PDF file
    const data = await fs.readFile(pdfPath);
    const buffer = new Uint8Array(data);
    
    // Load the PDF document
    const loadingTask = pdfjsLib.getDocument(buffer);
    const pdfDocument = await loadingTask.promise;
    
    console.log(`PDF loaded. Number of pages: ${pdfDocument.numPages}`);
    
    // Extract text from all pages
    let text = '';
    
    for (let i = 1; i <= pdfDocument.numPages; i++) {
      try {
        // Get the page
        const page = await pdfDocument.getPage(i);
        
        // Extract text from the page
        const pageText = await extractTextFromPage(page);
        
        // Log progress every 10 pages
        if (i % 10 === 0 || i === 1 || i === pdfDocument.numPages) {
          console.log(`Processed page ${i}/${pdfDocument.numPages}`);
        }
        
        // Add page text to the full text
        text += `-- Page ${i} --\n${pageText}\n\n`;
      } catch (pageError) {
        console.error(`Error processing page ${i}:`, pageError.message);
        text += `[Error extracting text from page ${i}]\n\n`;
      }
    }
    
    console.log(`Text extraction completed. Total characters: ${text.length}`);
    return text;
  } catch (error) {
    console.error("Error extracting text from PDF:", error);
    throw error;
  }
}

async function main() {
  try {
    // Get PDF path from command line arguments
    const args = process.argv.slice(2);
    let pdfPath;
    
    if (args.length > 0) {
      // If a path is provided as an argument, use it
      pdfPath = args[0];
    } else {
      // Default to the testcourse.pdf in the public directory
      pdfPath = path.join(__dirname, '..', 'public', 'testcourse.pdf');
    }
    
    // Check if file exists
    try {
      await fs.access(pdfPath);
      console.log(`PDF file found: ${pdfPath}`);
    } catch (e) {
      console.error(`PDF file not found: ${pdfPath}`);
      console.log(`Available files in directory:`);
      const dir = path.dirname(pdfPath);
      const files = await fs.readdir(dir);
      console.log(files.join('\n'));
      process.exit(1);
    }
    
    // Extract text from PDF
    const pdfText = await extractTextFromPDF(pdfPath);
    
    // Save the extracted text to a file for inspection
    const outputPath = path.join(__dirname, '..', 'extracted-pdf-text.txt');
    await fs.writeFile(outputPath, pdfText, 'utf8');
    
    console.log(`\nExtracted text saved to: ${outputPath}`);
    
    // Print a preview of the text
    console.log("\nPreview of extracted text:");
    console.log("--------------------------");
    console.log(pdfText.substring(0, 500) + "...");
    console.log("--------------------------");
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the script
main(); 