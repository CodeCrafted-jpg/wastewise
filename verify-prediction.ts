import mongoose from 'mongoose'
import WasteReport from './lib/models/WasteReport'
import BinPrediction from './lib/models/BinPrediction'
import { runPredictionEngine } from './lib/prediction'

async function test() {
    console.log('--- Prediction Engine Verification ---')

    if (!process.env.MONGODB_URI) {
        console.error('ERROR: MONGODB_URI not found in environment.')
        process.exit(1)
    }

    await mongoose.connect(process.env.MONGODB_URI)
    console.log('Connected to DB')

    // 1. Check if we have active reports
    const reportCount = await WasteReport.countDocuments({ status: 'open' })
    console.log(`Open reports found: ${reportCount}`)

    if (reportCount === 0) {
        console.log('No reports found. Creating a test report...')
        await WasteReport.create({
            userClerkId: 'test_user',
            imageUrls: ['https://example.com/test.jpg'],
            description: 'Test overflow report for verification',
            location: {
                type: 'Point',
                coordinates: [88.3639, 22.5726]
            },
            aiCategory: 'mixed',
            severityScore: 80,
            status: 'open'
        })
    }

    // 2. Run Engine
    console.log('Running Prediction Engine...')
    const result = await runPredictionEngine()
    console.log('Result:', JSON.stringify(result, null, 2))

    // 3. Verify Persistence
    const predictions = await BinPrediction.find().limit(5)
    console.log(`Predictions in DB: ${predictions.length}`)

    if (predictions.length > 0) {
        console.log('Latest Prediction Sample:', {
            location: predictions[0].location.coordinates,
            score: predictions[0].overflowScore,
            risk: predictions[0].riskLevel
        })
    }

    await mongoose.disconnect()
    console.log('Disconnected.')
}

test().catch(console.error)
