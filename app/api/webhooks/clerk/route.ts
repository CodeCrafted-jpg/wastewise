import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { WebhookEvent } from '@clerk/nextjs/server'
import dbConnect from '@/lib/db'
import User from '@/lib/models/User'
import AuditLog from '@/lib/models/AuditLog'

export async function POST(req: Request) {
    const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET

    if (!WEBHOOK_SECRET) {
        console.error('[Webhook] CLERK_WEBHOOK_SECRET is missing')
        return new Response('Error: Please add CLERK_WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local', {
            status: 500,
        })
    }

    // Get the headers
    const headerPayload = await headers()
    const svix_id = headerPayload.get('svix-id')
    const svix_timestamp = headerPayload.get('svix-timestamp')
    const svix_signature = headerPayload.get('svix-signature')

    // If there are no headers, error out
    if (!svix_id || !svix_timestamp || !svix_signature) {
        return new Response('Error: Missing svix headers', {
            status: 400,
        })
    }

    // Get the body
    const payload = await req.json()
    const body = JSON.stringify(payload)

    // Create a new Svix instance with your secret.
    const wh = new Webhook(WEBHOOK_SECRET)

    let evt: WebhookEvent

    // Verify the payload with the headers
    try {
        evt = wh.verify(body, {
            'svix-id': svix_id,
            'svix-timestamp': svix_timestamp,
            'svix-signature': svix_signature,
        }) as WebhookEvent
    } catch (err) {
        console.error('Error verifying webhook:', err)
        return new Response('Error: Verification failed', {
            status: 400,
        })
    }

    const { id: clerkUserId } = evt.data
    const eventType = evt.type

    await dbConnect()

    if (eventType === 'user.created') {
        const { email_addresses, first_name, last_name, phone_numbers } = evt.data
        const email = email_addresses?.[0]?.email_address || ''
        const name = `${first_name || ''} ${last_name || ''}`.trim()
        const phone = phone_numbers?.[0]?.phone_number || ''

        // Upsert to be safe
        const user = await User.findOneAndUpdate(
            { clerkUserId },
            {
                name,
                email,
                phone,
                emailVerified: true, // Clerk verified email
            },
            { upsert: true, new: true }
        )

        await AuditLog.create({
            action: 'user_created',
            actorClerkUserId: clerkUserId,
            actorRole: user.role,
            target: { type: 'User', id: user._id.toString() },
            payload: { event: 'clerk_webhook_created' },
        })
    }

    if (eventType === 'user.updated') {
        const { email_addresses, first_name, last_name, phone_numbers } = evt.data
        const email = email_addresses?.[0]?.email_address || ''
        const name = `${first_name || ''} ${last_name || ''}`.trim()
        const phone = phone_numbers?.[0]?.phone_number || ''

        const user = await User.findOneAndUpdate(
            { clerkUserId },
            { name, email, phone },
            { new: true }
        )

        if (user) {
            await AuditLog.create({
                action: 'user_updated',
                actorClerkUserId: clerkUserId,
                actorRole: user.role,
                target: { type: 'User', id: user._id.toString() },
                payload: { event: 'clerk_webhook_updated' },
            })
        }
    }

    return new Response('', { status: 200 })
}
