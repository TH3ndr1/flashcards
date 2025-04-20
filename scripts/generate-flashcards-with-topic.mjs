// scripts/generate-flashcards-with-topic.mjs
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { VertexAI } from '@google-cloud/vertexai';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// Configuration
const projectId = process.env.GCP_PROJECT_ID;
const location = 'us-central1';
const modelName = 'gemini-2.0-flash-lite-001';

// Get the directory name of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Function to generate topics based on PDF file name
function generateTopicsFromFilename(filename) {
  // Default topics
  const defaultTopics = [
    'Next.js fundamentals and architecture',
    'React components and state management',
    'Server-side rendering vs. client-side rendering',
    'Data fetching strategies in Next.js',
    'Routing and navigation in Next.js',
    'API routes and server components',
    'Deployment and optimization techniques'
  ];
  
  // Extract base filename without extension
  const baseName = path.basename(filename, path.extname(filename));
  
  // If filename contains keywords, generate more specific topics
  const lowerBaseName = baseName.toLowerCase();
  
  if (lowerBaseName.includes('react')) {
    return [
      'React component lifecycle',
      'Hooks vs class components in React',
      'React state management patterns',
      'React context API and Redux',
      'React performance optimization',
      'React testing strategies',
      'JSX syntax and patterns'
    ];
  } else if (lowerBaseName.includes('next')) {
    return [
      'Next.js file-based routing system',
      'Next.js data fetching methods (getServerSideProps, getStaticProps)',
      'Server components vs client components in Next.js',
      'Next.js middleware functionality',
      'Static vs dynamic routing in Next.js',
      'Next.js image optimization',
      'API routes implementation in Next.js'
    ];
  } else if (lowerBaseName.includes('javascript') || lowerBaseName.includes('js')) {
    return [
      'JavaScript closures and scope',
      'Promises and async/await in JavaScript',
      'ES6+ features in modern JavaScript',
      'JavaScript event loop',
      'Prototypal inheritance in JavaScript',
      'JavaScript modules (CommonJS vs ES Modules)',
      'JavaScript design patterns'
    ];
  } else if (lowerBaseName.includes('typescript') || lowerBaseName.includes('ts')) {
    return [
      'TypeScript type system fundamentals',
      'Interface vs type aliases in TypeScript',
      'Generics in TypeScript',
      'TypeScript decorators',
      'Advanced TypeScript utility types',
      'TypeScript compiler configuration',
      'Migration strategies from JavaScript to TypeScript'
    ];
  }
  
  // Return default topics if no specific match
  return defaultTopics;
}

// Function to generate flashcards based on topics
async function generateFlashcardsFromTopics(topics, pdfFilename) {
  // Use Application Default Credentials (ADC)
  const vertexAI = new VertexAI({
    project: projectId,
    location
  });

  const model = vertexAI.getGenerativeModel({ model: modelName });

  const prompt = `
Create flashcard-style question and answer pairs about the following topics.
These topics are related to a PDF document titled "${path.basename(pdfFilename)}".
Format each pair as a JSON object with "question" and "answer" fields.
Make the questions test understanding rather than just recall.
Return an array of these objects.
Keep answers concise but complete (under 100 words).
Create at least 2 high-quality pairs for each of these topics:

Topics:
${topics.map(topic => `- ${topic}`).join('\n')}

Example format:
[
  {
    "question": "What is the main principle of X?",
    "answer": "X primarily works by doing Y, which enables Z"
  }
]`;

  try {
    console.log('Generating flashcards from topics...');
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
    
    console.log(`Project ID: ${projectId}`);
    console.log(`Location: ${location}`);
    console.log(`Model: ${modelName}`);
    console.log('Using Application Default Credentials');
    
    // Generate topics based on the PDF file name
    const topics = generateTopicsFromFilename(pdfPath);
    console.log('\nGenerating flashcards for these topics:');
    topics.forEach(topic => console.log(`- ${topic}`));
    
    // Generate flashcards from topics
    const flashcards = await generateFlashcardsFromTopics(topics, pdfPath);
    
    // Save results
    console.log('\nResults:');
    console.log(`Total flashcards generated: ${flashcards.length}`);
    
    if (flashcards.length > 0) {
      const outputPath = path.join(__dirname, '..', 'generated-flashcards.json');
      await fs.writeFile(
        outputPath,
        JSON.stringify(flashcards, null, 2),
        'utf8'
      );
      
      console.log(`Output saved to: ${outputPath}`);
      
      // Print examples
      console.log('\nExample flashcards:');
      flashcards.slice(0, 3).forEach((card, i) => {
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