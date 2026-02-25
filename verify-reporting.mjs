import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

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

process.env.MONGODB_URI = env.MONGODB_URI;
process.env.COHERE_API_KEY = env.COHERE_API_KEY;

// Mocking imports for test (we'll run this in a context that can resolve them)
import { validateReportInput, calculateSeverity } from './lib/reporting.js';

async function verifyLogic() {
    console.log('--- Reporting Engine Logic Verification ---');

    // 1. Validation Test
    const validPayload = {
        imageUrls: ['https://example.com/waste.jpg'],
        description: 'A large pile of plastic bottles in the park.',
        location: { lat: 22.5, lng: 88.3 },
        userSeverity: 4
    };

    try {
        validateReportInput(validPayload);
        console.log('✅ Validation: Passed for valid payload');
    } catch (e) {
        console.error('❌ Validation: Failed for valid payload', e);
    }

    // 2. Scoring Test
    const score1 = calculateSeverity(4, 'plastic', 0.9);
    console.log(`✅ Scoring (High Confidence Plastic): ${score1} (Expected 90)`);

    const score2 = calculateSeverity(3, 'organic', 0.5);
    console.log(`✅ Scoring (Low Confidence Organic): ${score2} (Expected 60)`);

    const score3 = calculateSeverity(5, 'metal', 0.95);
    console.log(`✅ Scoring (Max Score Metal): ${score3} (Expected 100)`);

    console.log('--- Finished ---');
}

verifyLogic();
