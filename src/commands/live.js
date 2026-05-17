const { sendMessage, editMessage } = require('../telegram')
const mk = require('../mikrotik')

const liveSessions = new Map()

let tickCount = 0
let cachedClients = { pppCount: 0, apCount: 0, acCount: 0, hpCount: 0 }

function toMbps(bits) {
    return (parseInt(bits || 0) / 1000000).toFixed(1)
}

async function buildLiveMessage() {
    tickCount++
    const now = new Date().toLocaleTimeString('id-ID', { timeZone: process.env.TIMEZONE || 'Asia/Jakarta' })

    const [resource, traffic, netwatch] = await Promise.all([
        mk.getResource(),
        mk.getInterfaceTraffic([mk.ISP1_INTERFACE, mk.ISP2_INTERFACE]),
        mk.getNetwatch()
    ])

    // Refresh client counts every 5 ticks (~10s)
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
        `${isp1Icon} ${mk.ISP1_NAME}: ${toMbps(isp1Rx)} Mbps ↓ | ${toMbps(isp1Tx)} Mbps ↑`,
        `${isp2Icon} ${mk.ISP2_NAME}: ${toMbps(isp2Rx)} Mbps ↓ | ${toMbps(isp2Tx)} Mbps ↑`,
        `📊 Total: ${toMbps(isp1Rx + isp2Rx)} Mbps ↓ | ${toMbps(isp1Tx + isp2Tx)} Mbps ↑`,
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

    tickCount = 0
    cachedClients = { pppCount: 0, apCount: 0, acCount: 0, hpCount: 0 }

    const msg  = await buildLiveMessage()
    const sent = await sendMessage(chatId, msg)
    const messageId = sent?.result?.message_id || sent?.message_id

    if (!messageId) {
        await sendMessage(chatId, '❌ Failed to start live monitor')
        return
    }

    console.log(`[Live] Started for ${chatId}, message_id=${messageId}`)

    const interval = parseInt(process.env.LIVE_INTERVAL_MS || 2000)
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
    }, interval)

    liveSessions.set(String(chatId), { intervalId, messageId })
}

function stopLive(chatId) {
    const session = liveSessions.get(String(chatId))
    if (session) {
        clearInterval(session.intervalId)
        liveSessions.delete(String(chatId))
        return true
    }
    return false
}

function isLive(chatId) {
    return liveSessions.has(String(chatId))
}

module.exports = { startLive, stopLive, isLive }
