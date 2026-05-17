require('dotenv').config()
const express = require('express')
const { sendMessage, setWebhook } = require('./telegram')
const { startLive, stopLive } = require('./commands/live')
const { checkAlerts } = require('./alerts')

const statsCommand   = require('./commands/stats')
const ispCommand     = require('./commands/isp')
const clientsCommand = require('./commands/clients')
const uptimeCommand  = require('./commands/uptime')
const isolirCommand  = require('./commands/isolir')
const topCommand     = require('./commands/top')
const routesCommand  = require('./commands/routes')
const helpCommand    = require('./commands/help')
const { isolirClient, freeClient } = require('./commands/manage')
const { rebootCommand, rebootConfirm } = require('./commands/reboot')

const app    = express()
const PORT   = process.env.PORT  || 3011
const ADMIN  = process.env.TELEGRAM_ADMIN_CHAT_ID
const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET

app.use(express.json())

// Alert monitoring every 60 seconds
setInterval(checkAlerts, 60 * 1000)

app.post('/webhook', async (req, res) => {
    const secret = req.headers['x-telegram-bot-api-secret-token']
    if (secret !== SECRET) return res.status(401).json({ error: 'unauthorized' })

    res.json({ ok: true })

    const message = req.body?.message
    if (!message) return

    const chatId = String(message.chat?.id)
    const text   = (message.text || '').trim()

    if (chatId !== String(ADMIN)) {
        await sendMessage(chatId, '⛔ Unauthorized.')
        return
    }

    const send = (...args) => {
        const msg = args.length === 2 ? args[1] : args[0]
        return sendMessage(chatId, msg)
    }
    const parts = text.split(' ')
    const cmd   = parts[0].toLowerCase()
    const arg   = parts[1] || ''

    console.log(`[Bot] ${text} from ${chatId}`)

    try {
        switch (cmd) {
            case '/stats':   await statsCommand(chatId, send);   break
            case '/isp':     await ispCommand(chatId, send);     break
            case '/clients': await clientsCommand(chatId, send); break
            case '/uptime':  await uptimeCommand(chatId, send);  break
            case '/isolir':
                if (arg) await isolirClient(chatId, arg, send)
                else     await isolirCommand(chatId, send)
                break
            case '/free':
                if (arg) await freeClient(chatId, arg, send)
                else     await send('Usage: /free USERNAME')
                break
            case '/top':     await topCommand(chatId, send);     break
            case '/routes':  await routesCommand(chatId, send);  break
	    case '/reboot':
                if (arg) {
                   // arg is the OTP
                   await rebootConfirm(chatId, arg, send)
                } else {
                   await rebootCommand(chatId, send)
                }
	        break
            case '/live':
                await send('🔴 Starting live monitor...')
                await startLive(chatId)
                break
            case '/stop':
                if (stopLive(chatId)) await send('⏹ Live monitor stopped.')
                else                  await send('No active live monitor.')
                break
            case '/help':
            case '/start':
                await helpCommand(chatId, send)
                break
            default:
                await send('Unknown command. Use /help')
        }
    } catch (err) {
        console.error(`[Bot] Error ${cmd}:`, err.message)
        await send(`❌ Error: ${err.message}`)
    }
})

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.listen(PORT, async () => {
    console.log(`[Bot] Running on port ${PORT}`)
    const result = await setWebhook(`https://net.pradha.id/tgbot/webhook`, SECRET)
    console.log('[Bot] Webhook:', JSON.stringify(result))
    await sendMessage(ADMIN,
        `🟢 *PradhaNet Bot Online*\n${new Date().toLocaleString('id-ID', {timeZone: 'Asia/Jakarta'})}\nSend /help for commands.`)
    checkAlerts()
})
