const mk = require('../mikrotik')

function toMbps(bits) {
    return (parseInt(bits || 0) / 1000000).toFixed(1)
}

module.exports = async function topCommand(chatId, sendMessage) {
    try {
        const active = await mk.getPPPoEActive()

        if (!active || active.length === 0) {
            return sendMessage(chatId, 'No active PPPoE sessions.')
        }

        // Sort by rx-byte descending
        const sorted = active
            .filter(s => s['rx-byte'] || s['tx-byte'])
            .sort((a, b) => {
                const aTotal = parseInt(a['rx-byte'] || 0) + parseInt(a['tx-byte'] || 0)
                const bTotal = parseInt(b['rx-byte'] || 0) + parseInt(b['tx-byte'] || 0)
                return bTotal - aTotal
            })
            .slice(0, 10)

        let msg = `*Top 10 PPPoE Clients (by session usage)*\n`
        let i = 1
        for (const s of sorted) {
            const rx = parseInt(s['rx-byte'] || 0)
            const tx = parseInt(s['tx-byte'] || 0)
            const rxGb = (rx / 1073741824).toFixed(2)
            const txGb = (tx / 1073741824).toFixed(2)
            const name = s.name || s.user || '-'
            msg += `\n${i}. \`${name}\``
            msg += `\n   ↓${rxGb}GB ↑${txGb}GB`
            i++
        }

        await sendMessage(chatId, msg)
    } catch (err) {
        await sendMessage(chatId, `❌ Error: ${err.message}`)
    }
}
