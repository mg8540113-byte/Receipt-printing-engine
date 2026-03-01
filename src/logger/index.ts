import { ENV } from '../config';

// ============================================
// Structured JSON Logger
// ============================================
// Iron rules:
// - NEVER log: Service Role Key, names, ID numbers, phone numbers
// - ALWAYS log: job_id, timestamp, event type, worker_id

type LogLevel = 'INFO' | 'WARN' | 'ERROR';

interface LogEntry {
  level: LogLevel;
  event: string;
  worker_id: string;
  timestamp: string;
  [key: string]: unknown;
}

function emit(level: LogLevel, event: string, data: Record<string, unknown> = {}): void {
  const entry: LogEntry = {
    level,
    event,
    worker_id: ENV.WORKER_ID,
    timestamp: new Date().toISOString(),
    ...data,
  };
  const output = JSON.stringify(entry);
  if (level === 'ERROR') {
    console.error(output);
  } else {
    console.log(output);
  }
}

export const logger = {
  info: (event: string, data?: Record<string, unknown>) => emit('INFO', event, data),
  warn: (event: string, data?: Record<string, unknown>) => emit('WARN', event, data),
  error: (event: string, data?: Record<string, unknown>) => emit('ERROR', event, data),
};
