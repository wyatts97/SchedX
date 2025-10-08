#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function generateSecret() {
  return crypto.randomBytes(32).toString('base64');
}

function validateUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

async function setup() {
  console.log('🚀 SchedX Setup Wizard');
  console.log('=======================\n');

  // Check if .env already exists
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const overwrite = await question('⚠️  .env file already exists. Overwrite? (y/N): ');
    if (overwrite.toLowerCase() !== 'y') {
      console.log('Setup cancelled.');
      process.exit(0);
    }
  }

  console.log('📝 Configuration Setup\n');

  // Generate secrets
  const authSecret = generateSecret();
  const encryptionKey = generateSecret();

  console.log('🔐 Generated secure secrets:');
  console.log(`   AUTH_SECRET: ${authSecret.substring(0, 20)}...`);
  console.log(`   DB_ENCRYPTION_KEY: ${encryptionKey.substring(0, 20)}...\n`);

  // Get MongoDB URI
  const mongoUri = await question('🗄️  MongoDB URI (default: mongodb://localhost:27017/schedx): ') || 'mongodb://localhost:27017/schedx';

  // Get server configuration
  const host = await question('🌐 Host (default: 0.0.0.0): ') || '0.0.0.0';
  const port = await question('🔌 Port (default: 5173): ') || '5173';
  const origin = await question('🌍 Origin URL (default: http://localhost:5173): ') || 'http://localhost:5173';

  // Validate origin URL
  if (!validateUrl(origin)) {
    console.log('❌ Invalid origin URL. Please provide a valid URL.');
    process.exit(1);
  }

  // Get file upload size
  const maxUploadSize = await question('📁 Max upload size in MB (default: 50): ') || '50';
  const maxUploadSizeBytes = parseInt(maxUploadSize) * 1024 * 1024;

  // Generate .env content
  const envContent = `# Authentication
# Generated secure keys
AUTH_SECRET=${authSecret}
DB_ENCRYPTION_KEY=${encryptionKey}

# Database
MONGODB_URI=${mongoUri}

# Host setting
HOST=${host}
ORIGIN=${origin}
PORT=${port}

# Node environment
NODE_ENV=development

# Max upload size for individual files (${maxUploadSize}MB in bytes)
MAX_UPLOAD_SIZE=${maxUploadSizeBytes}
`;

  // Write .env file
  try {
    fs.writeFileSync(envPath, envContent);
    console.log('\n✅ Configuration saved to .env file');
  } catch (error) {
    console.error('❌ Failed to write .env file:', error.message);
    process.exit(1);
  }

  // Installation instructions
  console.log('\n📋 Next Steps:');
  console.log('===============');
  console.log('1. Install dependencies: npm install');
  console.log('2. Start MongoDB: docker-compose up -d mongo');
  console.log('3. Start the app: npm run dev');
  console.log('4. Visit: ' + origin);
  console.log('5. Configure Twitter API credentials in the admin panel');

  console.log('\n🐦 Twitter API Setup:');
  console.log('=====================');
  console.log('1. Go to https://developer.x.com/apps');
  console.log('2. Create a new app with OAuth 2.0 (PKCE)');
  console.log('3. Set callback URL: ' + origin + '/api/auth/signin/twitter');
  console.log('4. Add your Twitter app credentials in the SchedX admin panel');
  console.log('5. Connect your Twitter accounts through the Accounts page');

  console.log('\n🎉 Setup complete! Happy scheduling!');
  rl.close();
}

// Handle errors
process.on('SIGINT', () => {
  console.log('\n\nSetup cancelled.');
  rl.close();
  process.exit(0);
});

setup().catch((error) => {
  console.error('❌ Setup failed:', error.message);
  process.exit(1);
}); 