export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Simply import the module to let it register itself
    await import('@vercel/speed-insights');
  }
} 