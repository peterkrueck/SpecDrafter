import chalk from 'chalk';

class Logger {
  constructor(module = 'SYSTEM') {
    this.module = module;
    this.levels = {
      DEBUG: { priority: 0, color: chalk.gray, prefix: '🔍' },
      INFO: { priority: 1, color: chalk.blue, prefix: 'ℹ️' },
      WARN: { priority: 2, color: chalk.yellow, prefix: '⚠️' },
      ERROR: { priority: 3, color: chalk.red, prefix: '❌' }
    };
    this.currentLevel = process.env.LOG_LEVEL || 'INFO';
  }

  formatMessage(level, message, data = null) {
    const timestamp = new Date().toISOString().substr(11, 12); // HH:MM:SS.mmm
    const levelInfo = this.levels[level];
    const moduleStr = `[${this.module}]`;
    
    let logMessage = `${timestamp} ${levelInfo.prefix} ${levelInfo.color(level.padEnd(5))} ${chalk.cyan(moduleStr.padEnd(12))} ${message}`;
    
    if (data) {
      // Truncate long data for readability
      const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
      const truncated = dataStr.length > 200 ? dataStr.substring(0, 200) + '...' : dataStr;
      logMessage += `\n    ${chalk.dim('→')} ${truncated}`;
    }
    
    return logMessage;
  }

  shouldLog(level) {
    const currentPriority = this.levels[this.currentLevel]?.priority ?? 1;
    const messagePriority = this.levels[level]?.priority ?? 1;
    return messagePriority >= currentPriority;
  }

  debug(message, data = null) {
    if (this.shouldLog('DEBUG')) {
      console.log(this.formatMessage('DEBUG', message, data));
    }
  }

  info(message, data = null) {
    if (this.shouldLog('INFO')) {
      console.log(this.formatMessage('INFO', message, data));
    }
  }

  warn(message, data = null) {
    if (this.shouldLog('WARN')) {
      console.log(this.formatMessage('WARN', message, data));
    }
  }

  error(message, data = null) {
    if (this.shouldLog('ERROR')) {
      console.log(this.formatMessage('ERROR', message, data));
    }
  }

  // Helper for truncating terminal output
  truncateOutput(output, maxLength = 150) {
    if (!output) return '';
    const cleaned = output.replace(/\x1b\[[0-9;]*m/g, ''); // Strip basic ANSI
    return cleaned.length > maxLength ? cleaned.substring(0, maxLength) + '...' : cleaned;
  }
}

// Factory function to create module-specific loggers
export function createLogger(moduleName) {
  return new Logger(moduleName);
}

export default Logger;