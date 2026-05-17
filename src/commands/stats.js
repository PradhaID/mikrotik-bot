const mk = require('../mikrotik')

function toMbps(bits) {
    const mb = bits / 1000000
    return mb.toFixed(1)
}

function memPercent(total, free) {
    return Math.round(((total - free) / total) * 100)
}

module.exports = async function statsCommand(chatId, sendMessage) {
    try {
        // Fetch all data in parallel
        const [resource, traffic, pppoe, netwatch, sessions, users] =
            await Promise.all([
                mk.getResource(),
                mk.getInterfaceTraffic(['vlan204', 'ether2']),
                mk.getPPPoEActive(),
                mk.getNetwatch(),
                mk.getUMSessions(),
                mk.getUMUsers()
            ])

        // ISP traffic
        const sigData = Array.isArray(traffic)
            ? traffic.find(t => t.name === 'vlan204') || {}
            : {}
        const mrData  = Array.isArray(traffic)
            ? traffic.find(t => t.name === 'ether2') || {}
            : {}

        const sigRx = parseInt(sigData['rx-bits-per-second'] || 0)
        const sigTx = parseInt(sigData['tx-bits-per-second'] || 0)
        const mrRx  = parseInt(mrData['rx-bits-per-second']  || 0)
        const mrTx  = parseInt(mrData['tx-bits-per-second']  || 0)

        // ISP status from netwatch
        const sigWatch = netwatch.find(n => n.comment === 'Signal ISP Check')
        const mrWatch  = netwatch.find(n => n.comment === 'MyRepublic ISP Check')
        const sigIcon  = sigWatch?.status === 'up' ? '✅' : '🔴'
        const mrIcon   = mrWatch?.status  === 'up' ? '✅' : '🔴'

        // Client counts from User Manager
        const userMap = {}
        for (const u of users) userMap[u.name] = u.comment || ''

        let pppCount = 0, apCount = 0, acCount = 0, hpCount = 0
        for (const s of sessions) {
            const comment = userMap[s.username] || userMap[s.user] || ''
            if (comment.startsWith('CL :'))        pppCount++
            if (comment.startsWith('AP : CL -'))   apCount++
            if (comment.startsWith('AC :'))        acCount++
            if (comment.startsWith('HP :'))        hpCount++
        }

        // System
        const cpu     = resource['cpu-load'] || 0
        const uptime  = resource['uptime']    || '-'
        const memPct  = memPercent(
            parseInt(resource['total-memory'] || 0),
            parseInt(resource['free-memory']  || 0)
        )

        const msg = [
            `*PradhaNet Status*`,
            ``,
            `*ISP*`,
            `${sigIcon} Signal:        ${toMbps(sigRx)} Mbps ↓ | ${toMbps(sigTx)} Mbps ↑`,
            `${mrIcon} MyRepublic: ${toMbps(mrRx)} Mbps ↓ | ${toMbps(mrTx)} Mbps ↑`,
            `📊 Total:          ${toMbps(sigRx + mrRx)} Mbps ↓ | ${toMbps(sigTx + mrTx)} Mbps ↑`,
            ``,
            `*Clients*`,
            `🔌 PPPoE: ${pppCount} online`,
            `📡 AP:       ${apCount} online`,
            `🏢 AC:       ${acCount} online`,
            `📱 HP:       ${hpCount} online`,
            ``,
            `*System*`,
            `💻 CPU: ${cpu}%`,
            `🧠 RAM: ${memPct}% used`,
            `⏱ Uptime: ${uptime}`
        ].join('\n')

        await sendMessage(chatId, msg)

    } catch (err) {
        console.error('[stats]', err.message)
        await sendMessage(chatId, `❌ Error: ${err.message}`)
    }
}
