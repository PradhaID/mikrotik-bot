const mk = require('../mikrotik')

module.exports = async function clientsCommand(chatId, sendMessage) {
    try {
        const [sessions, users] = await Promise.all([
            mk.getUMSessions(),
            mk.getUMUsers()
        ])

        const userMap = {}
        for (const u of users) userMap[u.name] = u.comment || ''

        let pppCount = 0, apCount = 0, acCount = 0, hpCount = 0
        for (const s of sessions) {
            const comment = userMap[s.username] || userMap[s.user] || ''
            if (comment.startsWith('CL :'))       pppCount++
            if (comment.startsWith('AP : CL -'))  apCount++
            if (comment.startsWith('AC :'))       acCount++
            if (comment.startsWith('HP :'))       hpCount++
        }

        const msg = [
            `*Active Clients*`,
            `🔌 PPPoE: ${pppCount} online`,
            `📡 AP:       ${apCount} online`,
            `🏢 AC:       ${acCount} online`,
            `📱 HP:       ${hpCount} online`
        ].join('\n')

        await sendMessage(chatId, msg)
    } catch (err) {
        await sendMessage(chatId, `❌ Error: ${err.message}`)
    }
}
