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

     > **Note:** The application uses the `@supabase/ssr` package for authentication across server and client components. This implementation properly handles authentication in both regular and dynamic routes with fully async cookie handling. The middleware in `middleware.ts` manages session refresh while `lib/supabase/server.ts` provides optimized Supabase clients for different contexts.

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

## Performance Optimization

This application utilizes server-side rendering to optimize performance and reduce loading times:

### Server-Side Data Fetching

Several key pages have been optimized to use server components that pre-fetch data:

1. **Home Page (`app/page.tsx`)**
   - Uses `getDecksWithSrsCounts()` to fetch all deck data in a single database call
   - Pre-calculates SRS statistics (learn/review eligible counts)
   - Sends complete data to the client component, eliminating client-side API requests

2. **Study Sets Page (`app/study/sets/page.tsx`)**
   - Pre-fetches study sets server-side
   - Eliminates loading states and API request waterfalls
   
3. **Study Selection Page (`app/study/select/page.tsx`)**
   - Fetches both decks and study sets in parallel server-side
   - Passes pre-loaded data to the client for better user experience
   
4. **Tags Management Page (`app/tags/page.tsx`)**
   - Pre-fetches all tags server-side
   - Client component receives data immediately on page load

### Database Optimizations

1. **Single-query Optimizations**
   - Custom database function `get_decks_with_complete_srs_counts` performs all calculations in one query
   - Reduced multiple API calls to a single database call

2. **RLS Policy Improvements**
   - Optimized RLS policies using `(SELECT auth.uid() AS uid)` pattern
   - Fixed duplicate policies on the settings table

This architecture significantly improves page load performance by eliminating client-side request waterfalls and taking advantage of server-side rendering capabilities in Next.js. 