import { existsSync, mkdirSync, createWriteStream } from 'fs';
import { get } from 'https';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load env
const envPath = join(dirname(fileURLToPath(import.meta.url)), '../../.env.docker');
dotenv.config({ path: envPath });

if (process.env.USE_LOCAL_AI !== 'true') {
  console.log('Local AI disabled - skipping download');
  process.exit(0);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODEL_URL = 'https://github.com/onnx/models/raw/main/text/machine_comprehension/gpt-2/model/distilgpt2-10.onnx';
const MODEL_PATH = join(__dirname, '../../static/models/distilgpt2.onnx');

// Cross-platform directory creation
mkdirSync(dirname(MODEL_PATH), { recursive: true });

console.log(`Downloading model from ${MODEL_URL} to ${MODEL_PATH}`);

get(MODEL_URL, (res) => {
  const file = createWriteStream(MODEL_PATH);
  res.pipe(file);
  
  file.on('finish', () => {
    file.close();
    console.log('Download completed successfully!');
  });
}).on('error', (err) => {
  console.error('Download failed:', err);
  process.exit(1);
});
