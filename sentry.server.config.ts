import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  tracesSampleRate: 0.2, // 20% of server transactions
  environment: process.env.NODE_ENV,

  // Capture unhandled promise rejections
  integrations: [],

  // Custom before-send to enrich errors
  beforeSend(event) {
    // Strip sensitive data
    if (event.request?.headers) {
      delete event.request.headers['authorization'];
      delete event.request.headers['cookie'];
    }
    return event;
  },
});
