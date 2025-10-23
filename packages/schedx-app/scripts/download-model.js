import { mkdirSync, createWriteStream, existsSync, unlinkSync, statSync } from 'fs';
import { get } from 'https';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import dotenv from 'dotenv';

// Load env - try multiple locations
const __dirname = dirname(fileURLToPath(import.meta.url));
const possibleEnvPaths = [
  join(__dirname, '../../../.env.docker'),  // From packages/schedx-app/scripts -> root
  join(process.cwd(), '.env.docker'),        // From current working directory
  join(__dirname, '../../.env.docker')       // Alternative path
];

for (const envPath of possibleEnvPaths) {
  if (existsSync(envPath)) {
    console.log(`Loading environment from: ${envPath}`);
    dotenv.config({ path: envPath });
    break;
  }
}

if (process.env.USE_LOCAL_AI !== 'true') {
  console.log('Local AI disabled (USE_LOCAL_AI != true) - skipping download');
  process.exit(0);
}

// Using Hugging Face's ONNX model (GPT-2 base model, ~500MB)
const MODEL_URL = 'https://huggingface.co/onnx-community/gpt2-ONNX/resolve/main/onnx/model.onnx';
const MODEL_PATH = join(__dirname, '../static/models/distilgpt2.onnx');

// Create directory if needed
mkdirSync(dirname(MODEL_PATH), { recursive: true });

console.log(`Downloading model from ${MODEL_URL}`);
console.log(`Saving to ${MODEL_PATH}`);

// Try using curl or wget first (better for large files and redirects)
let downloadSucceeded = false;

try {
  console.log('Attempting download with curl...');
  execSync(`curl -L -o "${MODEL_PATH}" "${MODEL_URL}"`, { 
    stdio: 'inherit',
    timeout: 600000 // 10 minute timeout
  });
  
  if (existsSync(MODEL_PATH)) {
    const size = statSync(MODEL_PATH).size;
    if (size > 1000000) { // At least 1MB
      console.log(`✓ Download successful! Size: ${(size / (1024 * 1024)).toFixed(2)} MB`);
      downloadSucceeded = true;
    } else {
      console.log('Downloaded file too small, trying alternative method...');
      unlinkSync(MODEL_PATH);
    }
  }
} catch (err) {
  console.log('curl failed, trying wget...');
  try {
    execSync(`wget -O "${MODEL_PATH}" "${MODEL_URL}"`, { 
      stdio: 'inherit',
      timeout: 600000
    });
    
    if (existsSync(MODEL_PATH)) {
      const size = statSync(MODEL_PATH).size;
      if (size > 1000000) {
        console.log(`✓ Download successful! Size: ${(size / (1024 * 1024)).toFixed(2)} MB`);
        downloadSucceeded = true;
      } else {
        unlinkSync(MODEL_PATH);
      }
    }
  } catch (wgetErr) {
    console.log('wget failed, falling back to Node.js https...');
  }
}

// Exit if download succeeded
if (downloadSucceeded) {
  process.exit(0);
}

// Fallback to Node.js https
function downloadFile(url, redirectCount = 0) {
  if (redirectCount > 5) {
    throw new Error('Too many redirects');
  }

  get(url, response => {
    // Handle redirects
    if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307 || response.statusCode === 308) {
      const redirectUrl = response.headers.location;
      console.log(`Following redirect (${response.statusCode}) to: ${redirectUrl}`);
      downloadFile(redirectUrl, redirectCount + 1);
      return;
    }

    if (response.statusCode !== 200) {
      throw new Error(`Failed to download model: HTTP ${response.statusCode}`);
    }
    
    console.log('Download started...');
    const file = createWriteStream(MODEL_PATH);
    let downloaded = 0;
    const totalSize = parseInt(response.headers['content-length'] || '0', 10);
    
    if (totalSize > 0) {
      console.log(`Total size: ${(totalSize / (1024 * 1024)).toFixed(2)} MB`);
    }
    
    response.on('data', (chunk) => {
      downloaded += chunk.length;
      if (totalSize > 0) {
        const percent = ((downloaded / totalSize) * 100).toFixed(1);
        process.stdout.write(`\rProgress: ${percent}% (${(downloaded / (1024 * 1024)).toFixed(2)} MB / ${(totalSize / (1024 * 1024)).toFixed(2)} MB)`);
      } else {
        process.stdout.write(`\rDownloaded: ${(downloaded / (1024 * 1024)).toFixed(2)} MB`);
      }
    });
    
    response.pipe(file);
    
    file.on('finish', () => {
      file.close();
      console.log('\n'); // New line after progress
      if (!existsSync(MODEL_PATH)) {
        throw new Error('Download completed but file not found');
      }
      const size = statSync(MODEL_PATH).size;
      console.log(`✓ Download successful! Size: ${(size / (1024 * 1024)).toFixed(2)} MB`);
    });
    
    file.on('error', err => {
      file.destroy();
      if (existsSync(MODEL_PATH)) unlinkSync(MODEL_PATH);
      throw err;
    });
  }).on('error', err => {
    if (existsSync(MODEL_PATH)) unlinkSync(MODEL_PATH);
    throw err;
  });
}

downloadFile(MODEL_URL);
