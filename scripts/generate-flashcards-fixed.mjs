import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { VertexAI } from '@google-cloud/vertexai';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// Configuration
const projectId = process.env.GCP_PROJECT_ID;
const location = 'us-central1'; // Match the location from test-gcp-apis-adc.mjs
const modelName = 'gemini-2.0-flash-lite-001'; // Use the working model from the test scripts

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
  // Use Application Default Credentials (ADC) like in test-gcp-apis-adc.mjs
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

async function main() {
  try {
    // Simple test with hardcoded text to avoid PDF parsing issues
    const sampleText = `
    Next.js is a React framework for building full-stack web applications. 
    You use React Components to build user interfaces, and Next.js for 
    additional features and optimizations.

    Under the hood, Next.js also abstracts and automatically configures 
    tooling needed for React, like bundling, compiling, and more. This 
    allows you to focus on building your application instead of spending 
    time with configuration.
    `;
    
    console.log(`Project ID: ${projectId}`);
    console.log(`Location: ${location}`);
    console.log(`Model: ${modelName}`);
    console.log('Using Application Default Credentials');
    console.log('\nGenerating flashcards from sample text...');
    
    const flashcards = await generateFlashcards(sampleText);
    
    // Log results
    console.log('\nResults:');
    console.log(`Total flashcards generated: ${flashcards.length}`);
    
    if (flashcards.length > 0) {
      // Save results
      const outputPath = path.join(__dirname, '..', 'generated-flashcards.json');
      await fs.writeFile(
        outputPath,
        JSON.stringify(flashcards, null, 2),
        'utf8'
      );
      
      console.log(`Output saved to: ${outputPath}`);
      
      // Print examples
      console.log('\nGenerated flashcards:');
      flashcards.forEach((card, i) => {
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