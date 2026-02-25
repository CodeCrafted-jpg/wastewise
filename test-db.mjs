import mongoose from 'mongoose';
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

const MONGODB_URI = env.MONGODB_URI;

async function test() {
    if (!MONGODB_URI) {
        console.error('MONGODB_URI missing in .env.local');
        process.exit(1);
    }

    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ MongoDB connected successfully!');

        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('Existing collections:', collections.map(c => c.name));

        await mongoose.disconnect();
        console.log('Disconnected.');
    } catch (err) {
        console.error('❌ DB Test Failed:', err);
        process.exit(1);
    }
}

test();
