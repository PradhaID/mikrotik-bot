const mk = require('../mikrotik')

function toMbps(bits) {
    return (parseInt(bits || 0) / 1000000).toFixed(1)
}

function memPercent(total, free) {
    return Math.round(((parseInt(total) - parseInt(free)) / parseInt(total)) * 100)
}

module.exports = async function statsCommand(chatId, sendMessage) {
    try {
        const [resource, traffic, netwatch, sessions, users] = await Promise.all([
            mk.getResource(),
            mk.getInterfaceTraffic([mk.ISP1_INTERFACE, mk.ISP2_INTERFACE]),
            mk.getNetwatch(),
            mk.getUMSessions(),
            mk.getUMUsers()
        ])

        // ISP
        const isp1Data = Array.isArray(traffic) ? traffic.find(t => t.name === mk.ISP1_INTERFACE) || {} : {}
        const isp2Data = Array.isArray(traffic) ? traffic.find(t => t.name === mk.ISP2_INTERFACE) || {} : {}

        const isp1Rx = parseInt(isp1Data['rx-bits-per-second'] || 0)
        const isp1Tx = parseInt(isp1Data['tx-bits-per-second'] || 0)
        const isp2Rx = parseInt(isp2Data['rx-bits-per-second'] || 0)
        const isp2Tx = parseInt(isp2Data['tx-bits-per-second'] || 0)

        const isp1Watch = netwatch.find(n => n.comment === mk.ISP1_NETWATCH)
        const isp2Watch = netwatch.find(n => n.comment === mk.ISP2_NETWATCH)
        const isp1Icon  = isp1Watch?.status === 'up' ? '✅' : '🔴'
        const isp2Icon  = isp2Watch?.status === 'up' ? '✅' : '🔴'

        // Clients
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

        // System
        const cpu    = resource['cpu-load'] || 0
        const uptime = resource['uptime']   || '-'
        const memPct = memPercent(resource['total-memory'], resource['free-memory'])

        const msg = [
            `*PradhaNet Status*`,
            ``,
            `*ISP*`,
            `${isp1Icon} ${mk.ISP1_NAME}: ${toMbps(isp1Rx)} Mbps ↓ | ${toMbps(isp1Tx)} Mbps ↑`,
            `${isp2Icon} ${mk.ISP2_NAME}: ${toMbps(isp2Rx)} Mbps ↓ | ${toMbps(isp2Tx)} Mbps ↑`,
            `📊 Total: ${toMbps(isp1Rx + isp2Rx)} Mbps ↓ | ${toMbps(isp1Tx + isp2Tx)} Mbps ↑`,
            ``,
            `*Clients*`,
            `🔌 PPPoE: ${pppCount}  📡 AP: ${apCount}  🏢 AC: ${acCount}  📱 HP: ${hpCount}`,
            ``,
            `*System*`,
            `💻 CPU: ${cpu}%  🧠 RAM: ${memPct}%  ⏱ ${uptime}`
        ].join('\n')

        await sendMessage(chatId, msg)

    } catch (err) {
        console.error('[stats]', err.message)
        await sendMessage(chatId, `❌ Error: ${err.message}`)
    }
}
