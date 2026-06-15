import { defineService } from '@railway/cli'

// Marketingbot dashboard service
export const dashboard = defineService({
  name: 'dashboard',
  source: {
    path: './dashboard',
  },
  build: {
    builder: 'DOCKERFILE',
    dockerfilePath: 'Dockerfile',
  },
  deploy: {
    startCommand: 'node server.ts',
    healthcheckPath: '/api/health',
    healthcheckTimeout: 30,
    restartPolicyType: 'ON_FAILURE',
    restartPolicyMaxRetries: 3,
  },
  variables: {
    BOT_API_URL: '${{marketingbot.RAILWAY_INTERNAL_URL}}/api/data',
    PORT: '3000',
  },
  domains: ['dashboard.wysmyfree.com'],
})
