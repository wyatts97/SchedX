import { mkdirSync, createWriteStream, existsSync, unlinkSync, statSync } from 'fs';
import { get } from 'https';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
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

const file = createWriteStream(MODEL_PATH);

function downloadFile(url, redirectCount = 0) {
  if (redirectCount > 5) {
    throw new Error('Too many redirects');
  }

  get(url, response => {
    // Handle redirects
    if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307 || response.statusCode === 308) {
      const redirectUrl = response.headers.location;
      console.log(`Following redirect to: ${redirectUrl}`);
      file.destroy();
      downloadFile(redirectUrl, redirectCount + 1);
      return;
    }

    if (response.statusCode !== 200) {
      file.destroy();
      throw new Error(`Failed to download model: HTTP ${response.statusCode}`);
    }
    
    console.log('Download started...');
    let downloaded = 0;
    const totalSize = parseInt(response.headers['content-length'] || '0', 10);
    
    response.on('data', (chunk) => {
      downloaded += chunk.length;
      if (totalSize > 0) {
        const percent = ((downloaded / totalSize) * 100).toFixed(1);
        process.stdout.write(`\rProgress: ${percent}% (${(downloaded / (1024 * 1024)).toFixed(2)} MB / ${(totalSize / (1024 * 1024)).toFixed(2)} MB)`);
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
  }).on('error', err => {
    file.destroy();
    if (existsSync(MODEL_PATH)) unlinkSync(MODEL_PATH);
    throw err;
  });
}

downloadFile(MODEL_URL);
