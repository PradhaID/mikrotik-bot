const mk = require('../mikrotik')
const { sendMessage, editMessage } = require('../telegram')

// Store active live sessions: chatId -> { intervalId, messageId }
const liveSessions = new Map()

function toMbps(bits) {
    return (parseInt(bits || 0) / 1000000).toFixed(1)
}

// Optimized buildLiveMessage — skip clients on every tick, only refresh every 5 ticks
let tickCount = 0
let cachedClients = { pppCount: 0, apCount: 0, acCount: 0, hpCount: 0 }

async function buildLiveMessage() {
    tickCount++
    const now = new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' })

    // Always fetch fast data
    const [resource, traffic, netwatch] = await Promise.all([
        mk.getResource(),
        mk.getInterfaceTraffic(['vlan204', 'ether2']),
        mk.getNetwatch()
    ])

    // Only refresh client counts every 5 ticks (every 10 seconds)
    if (tickCount % 5 === 1) {
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
            cachedClients = { pppCount, apCount, acCount, hpCount }
        } catch (err) {
            console.error('[Live] Client refresh error:', err.message)
        }
    }

    const { pppCount, apCount, acCount, hpCount } = cachedClients

    // ISP
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

    // System
    const cpu    = resource['cpu-load'] || 0
    const uptime = resource['uptime']   || '-'
    const memPct = Math.round(
        ((parseInt(resource['total-memory']) - parseInt(resource['free-memory'])) /
        parseInt(resource['total-memory'])) * 100
    )

    return [
        `*🖥 PradhaNet Live Monitor*`,
        `🕐 ${now}`,
        ``,
        `*ISP*`,
        `${sigIcon} Signal:        ${toMbps(sigRx)} Mbps ↓ | ${toMbps(sigTx)} Mbps ↑`,
        `${mrIcon} MyRepublic: ${toMbps(mrRx)} Mbps ↓ | ${toMbps(mrTx)} Mbps ↑`,
        `📊 Total:          ${toMbps(sigRx + mrRx)} Mbps ↓ | ${toMbps(sigTx + mrTx)} Mbps ↑`,
        ``,
        `*Clients* _(updates every 10s)_`,
        `🔌 PPPoE: ${pppCount}  📡 AP: ${apCount}  🏢 AC: ${acCount}  📱 HP: ${hpCount}`,
        ``,
        `*System*`,
        `💻 CPU: ${cpu}%  🧠 RAM: ${memPct}%  ⏱ ${uptime}`,
        ``,
        `_/stop to stop_`
    ].join('\n')
}

async function startLive(chatId) {
    stopLive(chatId)
    
    // Reset counters for new session
    tickCount = 0
    cachedClients = { pppCount: 0, apCount: 0, acCount: 0, hpCount: 0 }

    const msg = await buildLiveMessage()
    const sent = await sendMessage(chatId, msg)
    const messageId = sent?.result?.message_id || sent?.message_id

    if (!messageId) {
        await sendMessage(chatId, '❌ Failed to start live monitor')
        return
    }

    console.log(`[Live] Started for ${chatId}, message_id=${messageId}`)

    const intervalId = setInterval(async () => {
        try {
            const updated = await buildLiveMessage()
            await editMessage(chatId, messageId, updated)
        } catch (err) {
            console.error('[Live] Update error:', err.message)
            if (err.message.includes('message to edit not found') ||
                err.message.includes('MESSAGE_ID_INVALID')) {
                stopLive(chatId)
            }
        }
    }, 2000)

    liveSessions.set(String(chatId), { intervalId, messageId })
}

function stopLive(chatId) {
    const session = liveSessions.get(String(chatId))
    if (session) {
        clearInterval(session.intervalId)
        liveSessions.delete(String(chatId))
        console.log(`[Live] Stopped for ${chatId}`)
        return true
    }
    return false
}

function isLive(chatId) {
    return liveSessions.has(String(chatId))
}

module.exports = { startLive, stopLive, isLive }
