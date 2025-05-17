export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Use the correct import path for SpeedInsights
    const { registerSpeedInsights } = await import('@vercel/speed-insights');
    registerSpeedInsights();
  }
} 