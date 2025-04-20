// scripts/generate-flashcards-pdf.mjs
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import pdfParse from 'pdf-parse';
import { VertexAI } from '@google-cloud/vertexai';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// Configuration
const projectId = process.env.GCP_PROJECT_ID;
const location = 'us-central1';
const modelName = 'gemini-2.0-flash-lite-001';

// Get the directory name of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Function to chunk text into smaller pieces
function chunkText(text, maxChunkSize = 2000) {
  const sentences = text.split(/[.!?]+\s+/);
  const chunks = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > maxChunkSize) {
      if (currentChunk) chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    }
  }
  
  if (currentChunk) chunks.push(currentChunk.trim());
  return chunks;
}

// Function to generate flashcards from text
async function generateFlashcards(text) {
  // Use Application Default Credentials (ADC)
  const vertexAI = new VertexAI({
    project: projectId,
    location
  });

  const model = vertexAI.getGenerativeModel({ model: modelName });

  const prompt = `
Create flashcard-style question and answer pairs from the following text. 
Format each pair as a JSON object with "question" and "answer" fields.
Make the questions test understanding rather than just recall.
Return an array of these objects.
Keep answers concise but complete.
Create 3-5 high-quality pairs from this chunk of text:

Text: """
${text}
"""

Example format:
[
  {
    "question": "What is the main principle of X?",
    "answer": "X primarily works by doing Y, which enables Z"
  }
]`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) {
      console.error('No text generated');
      return [];
    }

    try {
      // Find the first [ and last ] to extract just the JSON array
      const jsonStr = text.substring(text.indexOf('['), text.lastIndexOf(']') + 1);
      return JSON.parse(jsonStr);
    } catch (e) {
      console.error('Failed to parse generated JSON:', e);
      console.error('Raw text:', text);
      return [];
    }
  } catch (error) {
    console.error('Error generating flashcards:', error);
    return [];
  }
}

// Safe wrapper for the pdf-parse library
async function parsePDF(pdfPath) {
  try {
    // Read the PDF file
    const dataBuffer = await fs.readFile(pdfPath);
    
    // Use a custom options to prevent lookup of test file
    const options = {
      // Version information is collected from package.json, not the test file
      version: '1.1.1'  
    };
    
    // Parse the PDF
    const data = await pdfParse(dataBuffer, options);
    return data.text;
  } catch (error) {
    console.error(`Error parsing PDF at ${pdfPath}:`, error);
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
    
    console.log(`Project ID: ${projectId}`);
    console.log(`Location: ${location}`);
    console.log(`Model: ${modelName}`);
    console.log('Using Application Default Credentials');
    
    // Read and parse PDF
    console.log(`\nReading PDF file: ${pdfPath}`);
    const pdfText = await parsePDF(pdfPath);
    console.log(`PDF loaded. Length: ${pdfText.length} characters`);
    
    // Split text into chunks
    const chunks = chunkText(pdfText);
    console.log(`Split into ${chunks.length} chunks`);
    
    // Generate flashcards for each chunk
    let allFlashcards = [];
    console.log('\nGenerating flashcards...');
    
    // Process only the first 3 chunks for testing/development
    // Remove the slice if you want to process all chunks
    const chunksToProcess = chunks.slice(0, 3);
    
    for (let i = 0; i < chunksToProcess.length; i++) {
      console.log(`Processing chunk ${i + 1}/${chunksToProcess.length}...`);
      
      const flashcards = await generateFlashcards(chunksToProcess[i]);
      
      if (flashcards.length > 0) {
        allFlashcards = allFlashcards.concat(flashcards);
        console.log(`✓ Generated ${flashcards.length} flashcards from chunk ${i + 1}`);
      } else {
        console.log(`⚠ No flashcards generated from chunk ${i + 1}`);
      }
      
      // Add a small delay between chunks to avoid rate limiting
      if (i < chunksToProcess.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Save results
    console.log('\nResults:');
    console.log(`Total flashcards generated: ${allFlashcards.length}`);
    
    if (allFlashcards.length > 0) {
      const outputPath = path.join(__dirname, '..', 'generated-flashcards.json');
      await fs.writeFile(
        outputPath,
        JSON.stringify(allFlashcards, null, 2),
        'utf8'
      );
      
      console.log(`Output saved to: ${outputPath}`);
      
      // Print a few examples
      console.log('\nExample flashcards:');
      allFlashcards.slice(0, 3).forEach((card, i) => {
        console.log(`\nFlashcard ${i + 1}:`);
        console.log(`Q: ${card.question}`);
        console.log(`A: ${card.answer}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the script
main(); 