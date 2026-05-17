const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args))

const WAHA_URL     = process.env.WAHA_URL
const WAHA_API_KEY = process.env.WAHA_API_KEY
const WAHA_SESSION = process.env.WAHA_SESSION || 'default'

async function sendWaha(phone, message) {
    if (!WAHA_URL || !WAHA_API_KEY) {
        throw new Error('WAHA not configured (WAHA_URL / WAHA_API_KEY missing)')
    }
    const res = await fetch(`${WAHA_URL}/api/sendText`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': WAHA_API_KEY
        },
        body: JSON.stringify({
            chatId: `${phone}@c.us`,
            text: message,
            session: WAHA_SESSION
        }),
        signal: AbortSignal.timeout(10000)
    })
    return res.json()
}

module.exports = { sendWaha }
