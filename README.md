# Flashcards App

A modern flashcard application built with Next.js, Supabase, and Google Cloud Text-to-Speech.

## Getting Started

### Prerequisites

- Node.js 18 or higher
- pnpm (recommended) or npm
- A Supabase account
- A Google Cloud account with Text-to-Speech API enabled

### Environment Setup

1. Copy the example environment file:
   ```bash
   cp .env.example .env.local
   ```

2. Fill in your environment variables in `.env.local`:

   - **Supabase Configuration**:
     - `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous key

     > **Note:** The application uses the `@supabase/ssr` package for seamless integration between server and client components. This requires the environment variables above and relies on the `middleware.ts` file for session management.

   - **Google Cloud Configuration**:
     - `GCP_PROJECT_ID`: Your Google Cloud project ID
     - `GCP_SERVICE_ACCOUNT_EMAIL`: Your service account email
     - `GCP_PRIVATE_KEY`: Your service account private key

   > Note: Never commit `.env.local` to version control. It contains sensitive information.

### Installation

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Start the development server:
   ```bash
   pnpm dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Features

- Create and manage flashcard decks
- Bilingual support with text-to-speech
- Progress tracking
- Dark mode support
- Responsive design

## Documentation

Additional documentation can be found in the `docs` directory:
- [Project Documentation](docs/project-documentation.md)
- [Google API Integration](docs/google-api-integration.md)

**Note:** The project is currently undergoing refactoring to improve code structure, maintainability, and documentation (TSDoc). See [Refactoring Plan](refactoring-plan.md) for details.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request 