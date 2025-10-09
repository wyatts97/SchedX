#!/usr/bin/env node

/**
 * Environment Variable Validation Script
 * Validates that all required environment variables are set and properly formatted
 */

const fs = require('fs');
const path = require('path');

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Required environment variables with validation rules
const requiredVars = {
  AUTH_SECRET: {
    required: true,
    minLength: 32,
    description: 'Secret key for session encryption and JWT signing'
  },
  DB_ENCRYPTION_KEY: {
    required: true,
    minLength: 32,
    description: 'Encryption key for sensitive data in database'
  },
  DATABASE_PATH: {
    required: true,
    description: 'Path to SQLite database file'
  },
  ORIGIN: {
    required: true,
    pattern: /^https?:\/\/.+/,
    description: 'Base URL of the application'
  }
};

// Optional variables with validation rules
const optionalVars = {
  HOST: {
    default: '0.0.0.0',
    description: 'Host to bind the server to'
  },
  PORT: {
    default: '5173',
    pattern: /^\d+$/,
    validate: (val) => {
      const port = parseInt(val);
      return port >= 1 && port <= 65535;
    },
    description: 'Port the application will run on'
  },
  NODE_ENV: {
    default: 'development',
    enum: ['development', 'production', 'test'],
    description: 'Node environment'
  },
  MAX_UPLOAD_SIZE: {
    default: '52428800',
    pattern: /^\d+$/,
    validate: (val) => {
      const size = parseInt(val);
      return size >= 1024 && size <= 100 * 1024 * 1024; // 1KB to 100MB
    },
    description: 'Maximum file upload size in bytes'
  },
  BODY_SIZE_LIMIT: {
    default: '10485760',
    pattern: /^\d+$/,
    description: 'Body size limit for requests'
  },
  CRON_SCHEDULE: {
    default: '*/5 * * * *',
    description: 'Cron schedule for tweet processing'
  },
  LOG_LEVEL: {
    default: 'info',
    enum: ['trace', 'debug', 'info', 'warn', 'error', 'fatal'],
    description: 'Log level'
  },
  SENTRY_DSN: {
    optional: true,
    description: 'Sentry DSN for error tracking'
  },
  SENTRY_ENVIRONMENT: {
    default: 'development',
    description: 'Sentry environment name'
  }
};

class EnvValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.infoMessages = [];
  }

  log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  error(message) {
    this.errors.push(message);
    this.log(`❌ ERROR: ${message}`, 'red');
  }

  warning(message) {
    this.warnings.push(message);
    this.log(`⚠️  WARNING: ${message}`, 'yellow');
  }

  success(message) {
    this.log(`✅ ${message}`, 'green');
  }

  info(message) {
    this.infoMessages.push(message);
    this.log(`ℹ️  ${message}`, 'cyan');
  }

  checkEnvFile() {
    const envPath = path.join(process.cwd(), '.env');
    
    if (!fs.existsSync(envPath)) {
      this.error('.env file not found');
      this.info('Run: cp .env.example .env');
      return false;
    }
    
    this.success('.env file exists');
    return true;
  }

  validateRequired() {
    this.log('\n📋 Validating required variables...', 'blue');
    
    for (const [key, rules] of Object.entries(requiredVars)) {
      const value = process.env[key];
      
      if (!value || value.trim() === '') {
        this.error(`${key} is required but not set`);
        this.info(`  Description: ${rules.description}`);
        continue;
      }
      
      // Check minimum length
      if (rules.minLength && value.length < rules.minLength) {
        this.error(`${key} must be at least ${rules.minLength} characters (current: ${value.length})`);
        continue;
      }
      
      // Check pattern
      if (rules.pattern && !rules.pattern.test(value)) {
        this.error(`${key} does not match required format`);
        this.info(`  Expected pattern: ${rules.pattern}`);
        continue;
      }
      
      // Check custom validation
      if (rules.validate && !rules.validate(value)) {
        this.error(`${key} failed custom validation`);
        continue;
      }
      
      this.success(`${key} is valid`);
    }
  }

  validateOptional() {
    this.log('\n📋 Validating optional variables...', 'blue');
    
    for (const [key, rules] of Object.entries(optionalVars)) {
      const value = process.env[key];
      
      if (!value || value.trim() === '') {
        if (rules.default) {
          this.info(`${key} not set, will use default: ${rules.default}`);
        } else if (rules.optional) {
          this.info(`${key} is optional and not set`);
        }
        continue;
      }
      
      // Check enum
      if (rules.enum && !rules.enum.includes(value)) {
        this.error(`${key} must be one of: ${rules.enum.join(', ')}`);
        continue;
      }
      
      // Check pattern
      if (rules.pattern && !rules.pattern.test(value)) {
        this.error(`${key} does not match required format`);
        continue;
      }
      
      // Check custom validation
      if (rules.validate && !rules.validate(value)) {
        this.error(`${key} failed validation`);
        continue;
      }
      
      this.success(`${key} is valid: ${value}`);
    }
  }

  checkSecurityIssues() {
    this.log('\n🔒 Checking security issues...', 'blue');
    
    // Check for default/weak secrets
    const authSecret = process.env.AUTH_SECRET;
    if (authSecret && (
      authSecret.includes('your_secure') ||
      authSecret.includes('example') ||
      authSecret.includes('changeme') ||
      authSecret.length < 48
    )) {
      this.warning('AUTH_SECRET appears to be weak or default. Generate a strong secret with: openssl rand -base64 48');
    }
    
    const encryptionKey = process.env.DB_ENCRYPTION_KEY;
    if (encryptionKey && (
      encryptionKey.includes('your_secure') ||
      encryptionKey.includes('example') ||
      encryptionKey.includes('changeme') ||
      encryptionKey.length < 48
    )) {
      this.warning('DB_ENCRYPTION_KEY appears to be weak or default. Generate a strong key with: openssl rand -base64 48');
    }
    
    // Check production settings
    if (process.env.NODE_ENV === 'production') {
      if (!process.env.ORIGIN?.startsWith('https://')) {
        this.error('ORIGIN must use HTTPS in production');
      }
      
      if (!process.env.SENTRY_DSN) {
        this.warning('SENTRY_DSN not set. Error tracking is recommended for production');
      }
      
      if (process.env.DEBUG === 'true') {
        this.warning('DEBUG mode is enabled in production');
      }
      
      if (process.env.LOG_LEVEL === 'debug' || process.env.LOG_LEVEL === 'trace') {
        this.warning('Verbose logging enabled in production. Consider using "info" or "warn"');
      }
    }
  }

  generateReport() {
    this.log('\n' + '='.repeat(60), 'cyan');
    this.log('📊 VALIDATION REPORT', 'cyan');
    this.log('='.repeat(60), 'cyan');
    
    if (this.errors.length === 0 && this.warnings.length === 0) {
      this.log('\n🎉 All checks passed! Environment is properly configured.', 'green');
    } else {
      if (this.errors.length > 0) {
        this.log(`\n❌ ${this.errors.length} error(s) found`, 'red');
      }
      if (this.warnings.length > 0) {
        this.log(`⚠️  ${this.warnings.length} warning(s) found`, 'yellow');
      }
    }
    
    this.log('='.repeat(60) + '\n', 'cyan');
    
    return this.errors.length === 0;
  }

  validate() {
    this.log('\n🔍 SchedX Environment Validation', 'cyan');
    this.log('='.repeat(60) + '\n', 'cyan');
    
    // Check if .env file exists
    if (!this.checkEnvFile()) {
      return false;
    }
    
    // Load .env file
    require('dotenv').config();
    
    // Run validations
    this.validateRequired();
    this.validateOptional();
    this.checkSecurityIssues();
    
    // Generate report
    return this.generateReport();
  }
}

// Run validation
const validator = new EnvValidator();
const isValid = validator.validate();

process.exit(isValid ? 0 : 1);
