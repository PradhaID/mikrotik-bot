const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args))

const TOKEN = process.env.TELEGRAM_TOKEN
const API   = `https://api.telegram.org/bot${TOKEN}`

async function sendMessage(chatId, text, parseMode = 'Markdown') {
    const res = await fetch(`${API}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: parseMode,
            disable_web_page_preview: true
        })
    })
    const data = await res.json()
    return data // returns message object including message_id
}

async function editMessage(chatId, messageId, text, parseMode = 'Markdown') {
    const res = await fetch(`${API}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            text,
            parse_mode: parseMode,
            disable_web_page_preview: true
        })
    })
    return res.json()
}

async function setWebhook(url, secret) {
    const res = await fetch(`${API}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            url,
            secret_token: secret,
            allowed_updates: ['message']
        })
    })
    return res.json()
}

module.exports = { sendMessage, editMessage, setWebhook }
