const mk = require('../mikrotik')
const { sendWaha } = require('../waha')

const ADMIN_PHONE = process.env.ADMIN_PHONE
const OTP_EXPIRY  = 30 * 1000 // 30 seconds

// Store: chatId -> { otp, expiresAt, timeoutId }
const pendingReboots = new Map()

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString()
}

async function rebootCommand(chatId, sendMessage) {
    // Cancel any existing pending reboot
    const existing = pendingReboots.get(String(chatId))
    if (existing) {
        clearTimeout(existing.timeoutId)
        pendingReboots.delete(String(chatId))
    }

    const otp = generateOTP()

    // Send OTP via WhatsApp
    try {
        await sendWaha(ADMIN_PHONE,
            `🔐 *PradhaNet Router Reboot OTP*\n\nOTP: *${otp}*\n\nReply to bot with:\n/reboot ${otp}\n\n⚠️ Expires in 30 seconds.\nIgnore if you did not request this.`)
    } catch (err) {
        return sendMessage(chatId,
            `❌ Failed to send OTP via WhatsApp: ${err.message}`)
    }

    // Auto-expire OTP after 30s
    const timeoutId = setTimeout(() => {
        pendingReboots.delete(String(chatId))
        sendMessage(chatId, '⏰ Reboot OTP expired. Send /reboot to try again.')
    }, OTP_EXPIRY)

    pendingReboots.set(String(chatId), { otp, expiresAt: Date.now() + OTP_EXPIRY, timeoutId })

    await sendMessage(chatId,
        `🔐 *Reboot OTP sent to your WhatsApp*\n\nReply with:\n/reboot YOUR-OTP\n\n⏱ Expires in 30 seconds.`)
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
        return sendMessage(chatId, '❌ Invalid OTP. Send /reboot to try again.')
    }

    // Valid OTP — proceed
    clearTimeout(pending.timeoutId)
    pendingReboots.delete(String(chatId))

    await sendMessage(chatId,
        `🔄 *OTP Verified!*\nRebooting router...\nBot will notify when back online.`)

    // Also notify via WhatsApp
    try {
        await sendWaha(ADMIN_PHONE,
            `🔄 Router reboot initiated by Telegram bot.\n${new Date().toLocaleString('id-ID', {timeZone: 'Asia/Jakarta'})}`)
    } catch (e) {}

    // Short delay then reboot
    setTimeout(async () => {
        try {
            await mk.apiPost('/system/reboot', {})
        } catch (err) {
            console.log('[Reboot] Router rebooting (connection drop expected)')
        }
    }, 2000)
}

module.exports = { rebootCommand, rebootConfirm }
