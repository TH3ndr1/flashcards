// scripts/test-generate.mjs
import dotenv from 'dotenv';
import { VertexAI } from '@google-cloud/vertexai';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// Configuration
const projectId = process.env.GCP_PROJECT_ID;
const clientEmail = process.env.GCP_SERVICE_ACCOUNT_EMAIL;
const privateKey = process.env.GCP_PRIVATE_KEY?.replace(/\\n/g, '\n');
const location = 'us-central1';
const modelName = 'gemini-pro';

// Credentials object for Google Cloud
const credentials = {
  client_email: clientEmail,
  private_key: privateKey,
};

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
    // Test with a simple example text
    const sampleText = `
    Next.js is a React framework for building full-stack web applications. 
    You use React Components to build user interfaces, and Next.js for 
    additional features and optimizations.

    Under the hood, Next.js also abstracts and automatically configures 
    tooling needed for React, like bundling, compiling, and more. This 
    allows you to focus on building your application instead of spending 
    time with configuration.
    `;
    
    console.log('Generating flashcards from sample text...');
    const flashcards = await generateFlashcards(sampleText);
    
    // Print results
    console.log('\nResults:');
    console.log(`Total flashcards generated: ${flashcards.length}`);
    
    // Print all generated flashcards
    console.log('\nGenerated flashcards:');
    flashcards.forEach((card, i) => {
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