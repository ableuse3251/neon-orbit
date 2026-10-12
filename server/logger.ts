import { config } from './config.js';

type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'critical';

// Sensitive keys to redact from logs
const SENSITIVE_KEYS = ['botToken', 'token', 'secret', 'password', 'apiKey', 'authorization'];

function scrubDetails(details: any): any {
  if (!details || typeof details !== 'object') return details;
  const scrubbed = Array.isArray(details) ? [...details] : { ...details };
  for (const key in scrubbed) {
    if (SENSITIVE_KEYS.some((k) => key.toLowerCase().includes(k.toLowerCase()))) {
      scrubbed[key] = '[REDACTED]';
    } else if (typeof scrubbed[key] === 'object') {
      scrubbed[key] = scrubDetails(scrubbed[key]);
    }
  }
  return scrubbed;
}

function formatJsonLog(level: LogLevel, message: string, details?: any) {
  const logObject = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(details ? { details: scrubDetails(details) } : {}),
  };
  return JSON.stringify(logObject);
}

// In-memory throttling for admin error alerts (max 1 alert every 30s)
let lastAlertTimestamp = 0;

/**
 * Send critical alert directly to admin Telegram chat(s).
 * Fully self-hosted & sovereign; does not rely on third-party SaaS like Sentry.
 */
async function sendTelegramAdminAlert(message: string, error?: any) {
  const now = Date.now();
  if (now - lastAlertTimestamp < 30_000) return; // Rate-limit notifications
  if (!config.botToken || !config.adminTelegramIds || config.adminTelegramIds.length === 0) return;

  lastAlertTimestamp = now;

  const errorText = error instanceof Error
    ? `${error.name}: ${error.message}\n${error.stack?.split('\n').slice(0, 4).join('\n') || ''}`
    : typeof error === 'object' && error !== null
      ? JSON.stringify(error)
      : String(error || '');

  const text = `🚨 *[Neon Orbit ALERT]*\n*${message}*\n\n\`\`\`\n${errorText.slice(0, 500)}\n\`\`\``;

  for (const adminId of config.adminTelegramIds) {
    try {
      await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: adminId,
          text,
          parse_mode: 'Markdown',
        }),
      }).catch(() => {});
    } catch {
      // Ignore background notification network failure
    }
  }
}

export const logger = {
  info(message: string, details?: any) {
    console.log(formatJsonLog('info', message, details));
  },
  warn(message: string, details?: any) {
    console.warn(formatJsonLog('warn', message, details));
  },
  error(message: string, error?: any) {
    const errorDetails =
      error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error;
    console.error(formatJsonLog('error', message, errorDetails));
  },
  critical(message: string, error?: any) {
    const errorDetails =
      error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error;
    console.error(formatJsonLog('critical', message, errorDetails));
    sendTelegramAdminAlert(message, error).catch(() => {});
  },
  debug(message: string, details?: any) {
    if (config.nodeEnv !== 'production') {
      console.log(formatJsonLog('debug', message, details));
    }
  },
};

export function setupUnhandledErrorHandlers() {
  process.on('uncaughtException', (err) => {
    logger.critical('CRITICAL: Uncaught Exception', err);
  });

  process.on('unhandledRejection', (reason) => {
    logger.critical('CRITICAL: Unhandled Promise Rejection', reason);
  });
}
