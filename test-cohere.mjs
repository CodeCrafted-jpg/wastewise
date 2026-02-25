import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Manual .env.local parser
const envPath = path.resolve(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, ...value] = line.split('=');
    if (key && value) {
        env[key.trim()] = value.join('=').trim();
    }
});

const API_KEY = env.COHERE_API_KEY;

async function testCohereChat() {
    if (!API_KEY) {
        console.error('COHERE_API_KEY missing');
        process.exit(1);
    }

    try {
        console.log('Testing Cohere Chat API (Classification Simulation)...');
        const response = await fetch('https://api.cohere.ai/v1/chat', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: 'Classify this waste report description into one word: "organic", "plastic", "metal", or "mixed". Description: "A pile of rotting vegetables and fruit peels."',
            }),
        });

        const data = await response.json();
        console.log('✅ Cohere Chat Response:', data.text);
        process.exit(0);
    } catch (err) {
        console.error('❌ Cohere Chat Test Failed:', err);
        process.exit(1);
    }
}

testCohereChat();
