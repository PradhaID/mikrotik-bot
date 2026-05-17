const mk = require('../mikrotik')

module.exports = async function isolirCommand(chatId, sendMessage) {
    try {
        const users = await mk.getIsolirClients()
        const active = users.filter(u => u.disabled !== 'true')

        if (active.length === 0) {
            return sendMessage(chatId, '✅ No suspended clients.')
        }

        let msg = `*Suspended Clients (${active.length})*\n`
        for (const u of active.slice(0, 20)) {
            const comment = u.comment || u.name
            msg += `\n• ${comment}`
        }
        if (active.length > 20) msg += `\n\n_...and ${active.length - 20} more_`

        await sendMessage(chatId, msg)
    } catch (err) {
        await sendMessage(chatId, `❌ Error: ${err.message}`)
    }
}
