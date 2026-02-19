/**
 * Configuration for Bitcoin Bank frontend
 * Handles dynamic API URLs for development and production
 */

// Detect environment
const isDevelopment = import.meta.env.DEV;
const isProduction = import.meta.env.PROD;

// API Configuration
export const config = {
  // In development, use Vite proxy (configured in vite.config.ts)
  // In production, use Cloud Run URL
  apiBaseUrl: isDevelopment 
    ? '' // Empty string uses same origin, proxy handles /api
    : import.meta.env.VITE_API_URL || 'https://bitcoin-bank-api-REPLACE-ME.a.run.app',
  
  // Environment flags
  isDevelopment,
  isProduction,
  
  // Feature flags
  enableMockBackend: isDevelopment,
  enableDebugLogs: isDevelopment,
};

// Helper to construct API URLs
export const getApiUrl = (path: string): string => {
  const baseUrl = config.apiBaseUrl;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
};

// Export for debugging
if (config.enableDebugLogs) {
  console.log('[Config]', {
    apiBaseUrl: config.apiBaseUrl,
    environment: isDevelopment ? 'development' : 'production',
  });
}
