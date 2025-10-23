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

const MODEL_URL = 'https://github.com/onnx/models/raw/main/text/machine_comprehension/gpt-2/model/distilgpt2-10.onnx';
const MODEL_PATH = join(__dirname, '../static/models/distilgpt2.onnx');

// Create directory if needed
mkdirSync(dirname(MODEL_PATH), { recursive: true });

console.log(`Downloading model to ${MODEL_PATH}`);

const file = createWriteStream(MODEL_PATH);
get(MODEL_URL, response => {
  if (response.statusCode !== 200) {
    file.destroy();
    throw new Error(`Failed to download model: HTTP ${response.statusCode}`);
  }
  
  response.pipe(file);
  
  file.on('finish', () => {
    file.close();
    if (!existsSync(MODEL_PATH)) {
      throw new Error('Download completed but file not found');
    }
    const size = statSync(MODEL_PATH).size;
    console.log(`Download successful! Size: ${(size / (1024 * 1024)).toFixed(2)} MB`);
  });
}).on('error', err => {
  file.destroy();
  if (existsSync(MODEL_PATH)) unlinkSync(MODEL_PATH);
  throw err;
});
