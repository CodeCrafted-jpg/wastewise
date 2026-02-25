import dbConnect from './lib/db'
import User from './lib/models/User'
import AuditLog from './lib/models/AuditLog'

async function testConnection() {
    try {
        console.log('[Test] Connecting to MongoDB...')
        await dbConnect()
        console.log('[Test] Success! MongoDB connected.')

        const userCount = await User.countDocuments()
        const logCount = await AuditLog.countDocuments()

        console.log(`[Test] DB Stats: ${userCount} users, ${logCount} audit logs.`)

        process.exit(0)
    } catch (error) {
        console.error('[Test] Connection failed:', error)
        process.exit(1)
    }
}

testConnection()
