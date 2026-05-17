const mk = require('../mikrotik')

function toMbps(bits) {
    return (parseInt(bits || 0) / 1000000).toFixed(1)
}

module.exports = async function ispCommand(chatId, sendMessage) {
    try {
        const [traffic, netwatch] = await Promise.all([
            mk.getInterfaceTraffic([mk.ISP1_INTERFACE, mk.ISP2_INTERFACE]),
            mk.getNetwatch()
        ])

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

        const msg = [
            `*ISP Status*`,
            ``,
            `${isp1Icon} ${mk.ISP1_NAME}: ${toMbps(isp1Rx)} Mbps ↓ | ${toMbps(isp1Tx)} Mbps ↑`,
            `${isp2Icon} ${mk.ISP2_NAME}: ${toMbps(isp2Rx)} Mbps ↓ | ${toMbps(isp2Tx)} Mbps ↑`,
            `📊 Total: ${toMbps(isp1Rx + isp2Rx)} Mbps ↓ | ${toMbps(isp1Tx + isp2Tx)} Mbps ↑`
        ].join('\n')

        await sendMessage(chatId, msg)
    } catch (err) {
        await sendMessage(chatId, `❌ Error: ${err.message}`)
    }
}
