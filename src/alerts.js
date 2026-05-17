const { sendMessage } = require('./telegram')
const mk = require('./mikrotik')

const ADMIN = process.env.TELEGRAM_ADMIN_CHAT_ID

// Cooldown store — prevent alert spam
// Format: { alertKey: lastSentTimestamp }
const cooldowns = new Map()

function canAlert(key, cooldownMs = 5 * 60 * 1000) {
    const last = cooldowns.get(key) || 0
    if (Date.now() - last > cooldownMs) {
        cooldowns.set(key, Date.now())
        return true
    }
    return false
}

const THRESHOLDS = {
    CPU_WARN:  70,
    CPU_CRIT:  90,
    RAM_WARN:  80,
    RAM_CRIT:  95,
    BW_WARN:   parseInt(process.env.BW_WARN_MBPS || 300),
    BW_CRIT:   parseInt(process.env.BW_CRIT_MBPS || 480),
    DISK_WARN: 20,
    DISK_CRIT: 10,
}

async function checkAlerts() {
    try {
        const [resource, traffic] = await Promise.all([
            mk.getResource(),
            mk.getInterfaceTraffic(['vlan204', 'ether2'])
        ])

        const cpu     = parseInt(resource['cpu-load'] || 0)
        const totalMem = parseInt(resource['total-memory'] || 1)
        const freeMem  = parseInt(resource['free-memory']  || 0)
        const totalHdd = parseInt(resource['total-hdd-space'] || 1)
        const freeHdd  = parseInt(resource['free-hdd-space']  || 0)
        const ramPct   = Math.round(((totalMem - freeMem) / totalMem) * 100)
        const diskFreePct = Math.round((freeHdd / totalHdd) * 100)

        const sigData = traffic.find(t => t.name === 'vlan204') || {}
        const mrData  = traffic.find(t => t.name === 'ether2')  || {}
        const sigRx = parseInt(sigData['rx-bits-per-second'] || 0)
        const sigTx = parseInt(sigData['tx-bits-per-second'] || 0)
        const mrRx  = parseInt(mrData['rx-bits-per-second']  || 0)
        const mrTx  = parseInt(mrData['tx-bits-per-second']  || 0)
        const totalBwMbps = Math.round((sigRx + mrRx + sigTx + mrTx) / 1000000)

        // ── CPU Alert ──────────────────────────────────
        if (cpu >= THRESHOLDS.CPU_CRIT && canAlert('cpu-crit', 10 * 60 * 1000)) {
            await sendMessage(ADMIN,
                `🔴 *CRITICAL: High CPU*\nCPU usage: *${cpu}%*\nThreshold: ${THRESHOLDS.CPU_CRIT}%`)
        } else if (cpu >= THRESHOLDS.CPU_WARN && canAlert('cpu-warn', 15 * 60 * 1000)) {
            await sendMessage(ADMIN,
                `⚠️ *WARNING: High CPU*\nCPU usage: *${cpu}%*\nThreshold: ${THRESHOLDS.CPU_WARN}%`)
        } else if (cpu < THRESHOLDS.CPU_WARN) {
            // Reset cooldown when back to normal
            cooldowns.delete('cpu-crit')
            cooldowns.delete('cpu-warn')
        }

        // ── RAM Alert ──────────────────────────────────
        if (ramPct >= THRESHOLDS.RAM_CRIT && canAlert('ram-crit', 10 * 60 * 1000)) {
            await sendMessage(ADMIN,
                `🔴 *CRITICAL: High RAM*\nRAM usage: *${ramPct}%*\nThreshold: ${THRESHOLDS.RAM_CRIT}%`)
        } else if (ramPct >= THRESHOLDS.RAM_WARN && canAlert('ram-warn', 15 * 60 * 1000)) {
            await sendMessage(ADMIN,
                `⚠️ *WARNING: High RAM*\nRAM usage: *${ramPct}%*\nThreshold: ${THRESHOLDS.RAM_WARN}%`)
        }

        // ── Bandwidth Alert ────────────────────────────
	const sigRxMbps = (sigRx / 1000000).toFixed(1)
const sigTxMbps = (sigTx / 1000000).toFixed(1)
const mrRxMbps  = (mrRx  / 1000000).toFixed(1)
const mrTxMbps  = (mrTx  / 1000000).toFixed(1)
const totRxMbps = ((sigRx + mrRx) / 1000000).toFixed(1)
const totTxMbps = ((sigTx + mrTx) / 1000000).toFixed(1)
const totalBwMbps = Math.round((sigRx + mrRx + sigTx + mrTx) / 1000000)

const sigIcon = sigWatch?.status === 'up' ? '✅' : '🔴'
const mrIcon  = mrWatch?.status  === 'up' ? '✅' : '🔴'

const bwDetail = [
    `${sigIcon} ${process.env.ISP1_NAME || 'Signal'}:       ${sigRxMbps} Mbps ↓ | ${sigTxMbps} Mbps ↑`,
    `${mrIcon} ${process.env.ISP2_NAME || 'MyRepublic'}: ${mrRxMbps} Mbps ↓ | ${mrTxMbps} Mbps ↑`,
    `📊 Total:          ${totRxMbps} Mbps ↓ | ${totTxMbps} Mbps ↑`
].join('\n')

if (totalBwMbps >= THRESHOLDS.BW_CRIT && canAlert('bw-crit', 5 * 60 * 1000)) {
    await sendMessage(ADMIN,
        `🔴 *CRITICAL: Bandwidth Saturation*\n${bwDetail}\nThreshold: ${THRESHOLDS.BW_CRIT} Mbps`)
} else if (totalBwMbps >= THRESHOLDS.BW_WARN && canAlert('bw-warn', 10 * 60 * 1000)) {
    await sendMessage(ADMIN,
        `⚠️ *WARNING: High Bandwidth*\n${bwDetail}\nThreshold: ${THRESHOLDS.BW_WARN} Mbps`)
} else if (totalBwMbps < THRESHOLDS.BW_WARN) {
    cooldowns.delete('bw-crit')
    cooldowns.delete('bw-warn')
}

        // ── Disk Alert ─────────────────────────────────
        if (diskFreePct <= THRESHOLDS.DISK_CRIT && canAlert('disk-crit', 60 * 60 * 1000)) {
            await sendMessage(ADMIN,
                `🔴 *CRITICAL: Low Disk Space*\nFree: *${diskFreePct}%*\nThreshold: ${THRESHOLDS.DISK_CRIT}% free`)
        } else if (diskFreePct <= THRESHOLDS.DISK_WARN && canAlert('disk-warn', 60 * 60 * 1000)) {
            await sendMessage(ADMIN,
                `⚠️ *WARNING: Low Disk Space*\nFree: *${diskFreePct}%*\nThreshold: ${THRESHOLDS.DISK_WARN}% free`)
        }

    } catch (err) {
        console.error('[Alerts] Check error:', err.message)
    }
}

module.exports = { checkAlerts }
