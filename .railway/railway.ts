import { defineService } from '@railway/cli'

// Marketingbot dashboard service
export const dashboard = defineService({
  name: 'dashboard',
  source: {
    path: './dashboard',
  },
  deploy: {
    startCommand: 'node server.mjs',
    healthcheckPath: '/api/health',
    healthcheckTimeout: 30,
    restartPolicyType: 'ON_FAILURE',
    restartPolicyMaxRetries: 3,
  },
  variables: {
    BOT_API_URL: 'http://marketingbot:3000/api/data',
    PORT: '3000',
  },
  domains: ['dashboard.wysmyfree.com'],
})
