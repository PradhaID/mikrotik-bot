const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args))

const WAHA_URL     = process.env.WAHA_URL
const WAHA_API_KEY = process.env.WAHA_API_KEY
const WAHA_SESSION = process.env.WAHA_SESSION || 'default'

async function sendWaha(phone, message) {
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
        })
    })
    return res.json()
}

module.exports = { sendWaha }
