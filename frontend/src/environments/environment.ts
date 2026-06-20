declare const LEVELHABIT_SENTRY_DSN: string | undefined;
declare const LEVELHABIT_SENTRY_ENVIRONMENT: string | undefined;

const sentryDsn =
  typeof LEVELHABIT_SENTRY_DSN === 'string'
    ? LEVELHABIT_SENTRY_DSN
    : '';
const sentryEnvironment =
  typeof LEVELHABIT_SENTRY_ENVIRONMENT === 'string'
    ? LEVELHABIT_SENTRY_ENVIRONMENT
    : 'production';

export const environment = {
  production: true,
  apiUrl: 'https://level-habit-api.onrender.com/api',
  authRequired: true,
  sentry: {
    dsn: sentryDsn,
    environment: sentryEnvironment,
    serviceName: 'levelhabit-frontend'
  }
};
