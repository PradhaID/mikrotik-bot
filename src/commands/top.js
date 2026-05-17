const mk = require('../mikrotik')

function parseUptime(uptime = '0s') {
    let seconds = 0
    const d = uptime.match(/(\d+)d/)
    const h = uptime.match(/(\d+)h/)
    const m = uptime.match(/(\d+)m/)
    const s = uptime.match(/(\d+)s/)
    if (d) seconds += parseInt(d[1]) * 86400
    if (h) seconds += parseInt(h[1]) * 3600
    if (m) seconds += parseInt(m[1]) * 60
    if (s) seconds += parseInt(s[1])
    return seconds
}

module.exports = async function topCommand(chatId, sendMessage) {
    try {
        const active = await mk.getPPPoEActive()

        if (!active || active.length === 0) {
            return sendMessage(chatId, 'No active PPPoE sessions.')
        }

        // Sort by uptime descending (longest connected)
        const sorted = [...active]
            .sort((a, b) => parseUptime(b.uptime) - parseUptime(a.uptime))
            .slice(0, 10)

        let msg = `*Top 10 PPPoE (Longest Connected)*\n`
        msg += `_Total active: ${active.length} clients_\n`

        let i = 1
        for (const s of sorted) {
            msg += `\n${i}. \`${s.name}\``
            msg += `\n   📍 ${s.address}  ⏱ ${s.uptime}`
            i++
        }

        msg += `\n\n_💡 For per-client bandwidth, use Queue Tree_`

        await sendMessage(chatId, msg)
    } catch (err) {
        await sendMessage(chatId, `❌ Error: ${err.message}`)
    }
}
