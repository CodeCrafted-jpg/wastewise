import mongoose from 'mongoose'

const MONGODB_URI = process.env.MONGODB_URI

if (!MONGODB_URI) {
    throw new Error(
        'Please define the MONGODB_URI environment variable inside .env.local'
    )
}

/**
 * Global cache for the Mongoose connection.
 * In development, Next.js hot-reloads clear module cache,
 * so we store the connection on `globalThis` to avoid creating
 * multiple connections.
 */
interface MongooseCache {
    conn: typeof mongoose | null
    promise: Promise<typeof mongoose> | null
}

declare global {
    // eslint-disable-next-line no-var
    var mongooseCache: MongooseCache | undefined
}

const cached: MongooseCache = globalThis.mongooseCache ?? {
    conn: null,
    promise: null,
}
globalThis.mongooseCache = cached

async function dbConnect(): Promise<typeof mongoose> {
    if (cached.conn) {
        return cached.conn
    }

    if (!cached.promise) {
        const opts: mongoose.ConnectOptions = {
            bufferCommands: false,
        }

        cached.promise = mongoose
            .connect(MONGODB_URI!, opts)
            .then((mongooseInstance) => {
                console.log('[DB] MongoDB connected successfully')
                return mongooseInstance
            })
    }

    try {
        cached.conn = await cached.promise
    } catch (e) {
        cached.promise = null
        throw e
    }

    return cached.conn
}

export default dbConnect
