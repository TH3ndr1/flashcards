// scripts/generate-flashcards.mjs
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import pdf from 'pdf-parse';
import { VertexAI } from '@google-cloud/vertexai';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// Configuration
const projectId = process.env.GCP_PROJECT_ID;
const clientEmail = process.env.GCP_SERVICE_ACCOUNT_EMAIL;
const privateKey = process.env.GCP_PRIVATE_KEY?.replace(/\\n/g, '\n');
const location = 'us-central1';
const modelName = 'gemini-pro';

// Get the directory name of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Credentials object for Google Cloud
const credentials = {
  client_email: clientEmail,
  private_key: privateKey,
};

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
  const vertexAI = new VertexAI({
    project: projectId,
    location,
    googleAuthOptions: { credentials }
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

async function main() {
  try {
    // Read and parse PDF
    console.log('Reading PDF file...');
    const pdfPath = path.join(__dirname, '..', 'public', 'testcourse.pdf');
    const pdfBuffer = await fs.readFile(pdfPath);
    const pdfData = await pdf(pdfBuffer);
    
    console.log(`PDF loaded. Length: ${pdfData.text.length} characters`);
    
    // Split text into chunks
    const chunks = chunkText(pdfData.text);
    console.log(`Split into ${chunks.length} chunks`);
    
    // Generate flashcards for each chunk
    let allFlashcards = [];
    console.log('\nGenerating flashcards...');
    
    for (let i = 0; i < chunks.length; i++) {
      console.log(`Processing chunk ${i + 1}/${chunks.length}...`);
      const flashcards = await generateFlashcards(chunks[i]);
      allFlashcards = allFlashcards.concat(flashcards);
      
      // Log progress
      if (flashcards.length > 0) {
        console.log(`✓ Generated ${flashcards.length} flashcards from chunk ${i + 1}`);
      } else {
        console.log(`⚠ No flashcards generated from chunk ${i + 1}`);
      }
      
      // Add a small delay between chunks to avoid rate limiting
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Save results
    const outputPath = path.join(__dirname, '..', 'generated-flashcards.json');
    await fs.writeFile(
      outputPath,
      JSON.stringify(allFlashcards, null, 2),
      'utf8'
    );
    
    console.log('\nResults:');
    console.log(`Total flashcards generated: ${allFlashcards.length}`);
    console.log(`Output saved to: ${outputPath}`);
    
    // Print a few examples
    console.log('\nExample flashcards:');
    allFlashcards.slice(0, 3).forEach((card, i) => {
      console.log(`\nFlashcard ${i + 1}:`);
      console.log(`Q: ${card.question}`);
      console.log(`A: ${card.answer}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the script
main(); 