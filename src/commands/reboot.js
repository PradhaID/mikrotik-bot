const mk = require('../mikrotik')
const { sendWaha } = require('../waha')

const ADMIN_PHONE = process.env.ADMIN_PHONE
const OTP_EXPIRY  = parseInt(process.env.OTP_EXPIRY_MS || 30000) // 30s default

// Store: chatId -> { otp, expiresAt, timeoutId }
const pendingReboots = new Map()

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString()
}

async function rebootCommand(chatId, sendMessage) {
    // Cancel existing pending reboot
    const existing = pendingReboots.get(String(chatId))
    if (existing) {
        clearTimeout(existing.timeoutId)
        pendingReboots.delete(String(chatId))
    }

    const otp = generateOTP()

    // Send OTP via WhatsApp
    try {
        await sendWaha(ADMIN_PHONE,
            `🔐 *PradhaNet Router Reboot OTP*\n\nOTP: *${otp}*\n\nReply to Telegram bot:\n/reboot ${otp}\n\n⚠️ Expires in ${OTP_EXPIRY / 1000} seconds.\nIgnore if you did not request this.`)
    } catch (err) {
        return sendMessage(chatId, `❌ Failed to send OTP via WhatsApp: ${err.message}`)
    }

    // Auto-expire after timeout
    const timeoutId = setTimeout(() => {
        if (pendingReboots.has(String(chatId))) {
            pendingReboots.delete(String(chatId))
            sendMessage(chatId, '⏰ Reboot OTP expired. Send /reboot to try again.')
        }
    }, OTP_EXPIRY)

    pendingReboots.set(String(chatId), {
        otp,
        expiresAt: Date.now() + OTP_EXPIRY,
        timeoutId
    })

    await sendMessage(chatId,
        `🔐 *Reboot OTP sent to your WhatsApp*\n\nReply with:\n\`/reboot YOUR-OTP\`\n\n⏱ Expires in ${OTP_EXPIRY / 1000} seconds.`)
}

async function rebootConfirm(chatId, inputOtp, sendMessage) {
    const pending = pendingReboots.get(String(chatId))

    if (!pending) {
        return sendMessage(chatId, '❌ No pending reboot. Send /reboot first.')
    }

    if (Date.now() > pending.expiresAt) {
        clearTimeout(pending.timeoutId)
        pendingReboots.delete(String(chatId))
        return sendMessage(chatId, '⏰ OTP expired. Send /reboot to try again.')
    }

    if (inputOtp !== pending.otp) {
        return sendMessage(chatId, '❌ Invalid OTP. Try again or send /reboot for a new OTP.')
    }

    // Valid — proceed
    clearTimeout(pending.timeoutId)
    pendingReboots.delete(String(chatId))

    await sendMessage(chatId,
        `✅ *OTP Verified! Rebooting router...*\nBot will send a message when back online.`)

    // Notify via WhatsApp too
    try {
        await sendWaha(ADMIN_PHONE,
            `🔄 Router reboot initiated.\n${new Date().toLocaleString('id-ID', { timeZone: process.env.TIMEZONE || 'Asia/Jakarta' })}`)
    } catch (e) {
        console.error('[Reboot] WAHA notify failed:', e.message)
    }

    // Short delay then reboot
    setTimeout(async () => {
        try {
            await mk.apiPost('/system/reboot', {})
        } catch (err) {
            // Connection drop on reboot is expected
            console.log('[Reboot] Router rebooting...')
        }
    }, 2000)
}

module.exports = { rebootCommand, rebootConfirm }
