const mk = require('../mikrotik')

module.exports = async function isolirCommand(chatId, sendMessage) {
    try {
        const users = await mk.getIsolirClients()

        if (!users || users.length === 0) {
            return sendMessage(chatId, '✅ No suspended clients.')
        }

        // Filter only enabled (not disabled) isolir users
        const suspended = users.filter(u => u.disabled !== 'true')

        if (suspended.length === 0) {
            return sendMessage(chatId, '✅ No active suspended clients.')
        }

        let msg = `*Suspended Clients (${suspended.length})*\n`
        for (const u of suspended.slice(0, 20)) {
            const comment = u.comment || u.name
            msg += `\n• \`${u.name}\` — ${comment}`
        }
        if (suspended.length > 20) {
            msg += `\n\n_...and ${suspended.length - 20} more_`
        }
        msg += `\n\n_Use /free USERNAME to unsuspend_`

        await sendMessage(chatId, msg)
    } catch (err) {
        await sendMessage(chatId, `❌ Error: ${err.message}`)
    }
}
