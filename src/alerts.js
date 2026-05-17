const { sendMessage } = require('./telegram')
const mk = require('./mikrotik')

const ADMIN = process.env.TELEGRAM_ADMIN_CHAT_ID

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
    CPU_WARN:   parseInt(process.env.CPU_WARN   || 70),
    CPU_CRIT:   parseInt(process.env.CPU_CRIT   || 90),
    RAM_WARN:   parseInt(process.env.RAM_WARN   || 80),
    RAM_CRIT:   parseInt(process.env.RAM_CRIT   || 95),
    BW_WARN:    parseInt(process.env.BW_WARN_MBPS || 300),
    BW_CRIT:    parseInt(process.env.BW_CRIT_MBPS || 380),
    DISK_WARN:  parseInt(process.env.DISK_WARN  || 20),
    DISK_CRIT:  parseInt(process.env.DISK_CRIT  || 10),
}

function toMbps(bits) {
    return (parseInt(bits || 0) / 1000000).toFixed(1)
}

async function checkAlerts() {
    try {
        const [resource, traffic, netwatch] = await Promise.all([
            mk.getResource(),
            mk.getInterfaceTraffic([mk.ISP1_INTERFACE, mk.ISP2_INTERFACE]),
            mk.getNetwatch()
        ])

        const cpu      = parseInt(resource['cpu-load'] || 0)
        const totalMem = parseInt(resource['total-memory'] || 1)
        const freeMem  = parseInt(resource['free-memory']  || 0)
        const totalHdd = parseInt(resource['total-hdd-space'] || 1)
        const freeHdd  = parseInt(resource['free-hdd-space']  || 0)
        const ramPct   = Math.round(((totalMem - freeMem) / totalMem) * 100)
        const diskFreePct = Math.round((freeHdd / totalHdd) * 100)

        // ISP traffic
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

        const totalBwMbps = Math.round((isp1Rx + isp2Rx + isp1Tx + isp2Tx) / 1000000)

        // Build ISP detail string (reused in alerts)
        const bwDetail = [
            `${isp1Icon} ${mk.ISP1_NAME}: ${toMbps(isp1Rx)} Mbps ↓ | ${toMbps(isp1Tx)} Mbps ↑`,
            `${isp2Icon} ${mk.ISP2_NAME}: ${toMbps(isp2Rx)} Mbps ↓ | ${toMbps(isp2Tx)} Mbps ↑`,
            `📊 Total: ${toMbps(isp1Rx + isp2Rx)} Mbps ↓ | ${toMbps(isp1Tx + isp2Tx)} Mbps ↑`
        ].join('\n')

        // ── CPU ───────────────────────────────────────
        if (cpu >= THRESHOLDS.CPU_CRIT && canAlert('cpu-crit', 10 * 60 * 1000)) {
            await sendMessage(ADMIN,
                `🔴 *CRITICAL: High CPU*\nCPU: *${cpu}%*\nThreshold: ${THRESHOLDS.CPU_CRIT}%`)
        } else if (cpu >= THRESHOLDS.CPU_WARN && canAlert('cpu-warn', 15 * 60 * 1000)) {
            await sendMessage(ADMIN,
                `⚠️ *WARNING: High CPU*\nCPU: *${cpu}%*\nThreshold: ${THRESHOLDS.CPU_WARN}%`)
        } else if (cpu < THRESHOLDS.CPU_WARN) {
            cooldowns.delete('cpu-crit')
            cooldowns.delete('cpu-warn')
        }

        // ── RAM ───────────────────────────────────────
        if (ramPct >= THRESHOLDS.RAM_CRIT && canAlert('ram-crit', 10 * 60 * 1000)) {
            await sendMessage(ADMIN,
                `🔴 *CRITICAL: High RAM*\nRAM: *${ramPct}%*\nThreshold: ${THRESHOLDS.RAM_CRIT}%`)
        } else if (ramPct >= THRESHOLDS.RAM_WARN && canAlert('ram-warn', 15 * 60 * 1000)) {
            await sendMessage(ADMIN,
                `⚠️ *WARNING: High RAM*\nRAM: *${ramPct}%*\nThreshold: ${THRESHOLDS.RAM_WARN}%`)
        } else if (ramPct < THRESHOLDS.RAM_WARN) {
            cooldowns.delete('ram-crit')
            cooldowns.delete('ram-warn')
        }

        // ── Bandwidth ─────────────────────────────────
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

        // ── Disk ──────────────────────────────────────
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
