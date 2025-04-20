import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

// Create require function
const require = createRequire(import.meta.url);

// Get the directory name of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// This function uses a child process to extract text from a PDF using pdftotext
async function extractPDFText(pdfPath) {
  try {
    console.log(`Reading PDF file using child process: ${pdfPath}`);
    
    // Check if file exists
    await fs.access(pdfPath);
    
    // Use the child_process module to call an external PDF text extraction tool
    const { exec } = require('child_process');
    
    return new Promise((resolve, reject) => {
      // First try pdftotext if available on the system
      exec(`pdftotext "${pdfPath}" -`, (error, stdout, stderr) => {
        if (error) {
          console.log('pdftotext not available or error, trying another method...');
          // Try to use pdf2text if available
          exec(`pdf2text "${pdfPath}"`, (error2, stdout2, stderr2) => {
            if (error2) {
              console.log('External PDF extraction tools not available.');
              // If external tools fail, return a message
              resolve(`External PDF extraction tools (pdftotext, pdf2text) are not available on your system. 
                      Please install them or use the topic-based generation method.
                      
                      You can install pdftotext on macOS using: brew install poppler
                      On Ubuntu: sudo apt-get install poppler-utils`);
            } else {
              resolve(stdout2);
            }
          });
        } else {
          resolve(stdout);
        }
      });
    });
  } catch (error) {
    console.error('Error extracting PDF text:', error);
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
      // Default to the test.pdf in the public directory
      pdfPath = path.join(__dirname, '..', 'public', 'test.pdf');
    }
    
    // Check if file exists
    try {
      await fs.access(pdfPath);
      console.log(`PDF file found: ${pdfPath}`);
    } catch (e) {
      console.error(`PDF file not found: ${pdfPath}`);
      process.exit(1);
    }
    
    // Extract text from PDF
    const extractedText = await extractPDFText(pdfPath);
    
    // Save the extracted text to a file for inspection
    const outputPath = path.join(__dirname, '..', 'extracted-pdf-text.txt');
    await fs.writeFile(outputPath, extractedText, 'utf8');
    
    console.log(`\nExtracted text saved to: ${outputPath}`);
    console.log(`Text length: ${extractedText.length} characters`);
    
    // Print a preview of the text
    console.log("\nPreview of extracted text:");
    console.log("--------------------------");
    console.log(extractedText.substring(0, 500) + "...");
    console.log("--------------------------");
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the script
main(); 