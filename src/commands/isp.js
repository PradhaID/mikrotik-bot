const mk = require('../mikrotik')

function toMbps(bits) {
    return (parseInt(bits) / 1000000).toFixed(1)
}

module.exports = async function ispCommand(chatId, sendMessage) {
    try {
        const [traffic, netwatch] = await Promise.all([
            mk.getInterfaceTraffic(['vlan204', 'ether2']),
            mk.getNetwatch()
        ])

        const sigData = traffic.find(t => t.name === 'vlan204') || {}
        const mrData  = traffic.find(t => t.name === 'ether2')  || {}

        const sigRx = parseInt(sigData['rx-bits-per-second'] || 0)
        const sigTx = parseInt(sigData['tx-bits-per-second'] || 0)
        const mrRx  = parseInt(mrData['rx-bits-per-second']  || 0)
        const mrTx  = parseInt(mrData['tx-bits-per-second']  || 0)

        const sigWatch = netwatch.find(n => n.comment === 'Signal ISP Check')
        const mrWatch  = netwatch.find(n => n.comment === 'MyRepublic ISP Check')
        const sigIcon  = sigWatch?.status === 'up' ? '✅' : '🔴'
        const mrIcon   = mrWatch?.status  === 'up' ? '✅' : '🔴'

        const msg = [
            `*ISP Status*`,
            ``,
            `${sigIcon} Signal:        ${toMbps(sigRx)} Mbps ↓ | ${toMbps(sigTx)} Mbps ↑`,
            `${mrIcon} MyRepublic: ${toMbps(mrRx)} Mbps ↓ | ${toMbps(mrTx)} Mbps ↑`,
            `📊 Total:          ${toMbps(sigRx + mrRx)} Mbps ↓ | ${toMbps(sigTx + mrTx)} Mbps ↑`
        ].join('\n')

        await sendMessage(chatId, msg)
    } catch (err) {
        await sendMessage(chatId, `❌ Error: ${err.message}`)
    }
}
