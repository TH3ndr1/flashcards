export function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Import Speed Insights server-side instrumentation
    import('@vercel/speed-insights/server');
  }
} 