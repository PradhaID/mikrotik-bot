const mk  = require('./mikrotik')
const olt = require('./olt')
const { sendMessage } = require('./telegram')

const ADMIN          = process.env.TELEGRAM_ADMIN_CHAT_ID
const OFFLINE_MINS   = parseInt(process.env.STUCK_ONU_MINUTES || 10)
const AUTO_REBOOT    = process.env.STUCK_ONU_AUTO_REBOOT === 'true'

// Track recently rebooted ONUs to avoid reboot loops
// Format: { username: lastRebootTimestamp }
const recentReboots = new Map()
const REBOOT_COOLDOWN = 30 * 60 * 1000 // 30 minutes

async function checkStuckOnus() {
    try {
        const [sessions, users, pppActive] = await Promise.all([
            mk.getUMSessions(),
            mk.getUMUsers(),
            mk.getPPPoEActive()
        ])

        // Build maps
        const userMap   = {}
        const attrMap   = {}
        for (const u of users) {
            userMap[u.name]  = u.comment    || ''
            attrMap[u.name]  = u.attributes || ''
        }

        // Active PPPoE usernames
        const activeNames = new Set(pppActive.map(s => s.name))

        // Find stuck clients:
        // - Has CL : comment (PPPoE client)
        // - Has active UM session (OLT says online)
        // - NOT in PPPoE active (MikroTik says offline)
        // - Not Isolir
        // - Not recently rebooted
        const stuckClients = []

        const activeUMSessions = sessions.filter(s => s.active === 'true' || s.active === true)

        for (const s of activeUMSessions) {
            const uname   = s.username || s.user
            const comment = userMap[uname] || ''

            // Only PPPoE clients
            if (!comment.startsWith('CL :')) continue

            // Skip if already in PPPoE active
            if (activeNames.has(uname)) continue

            // Skip Isolir
            const umUser = users.find(u => u.name === uname)
            if (umUser?.group === 'Isolir') continue

            // Skip recently rebooted
            const lastReboot = recentReboots.get(uname)
            if (lastReboot && Date.now() - lastReboot < REBOOT_COOLDOWN) continue

            // Get OLT MAC from attributes
            const attrs  = attrMap[uname] || ''
            const oltMac = extractOltMac(attrs)

            stuckClients.push({
                username: uname,
                comment,
                oltMac,
                umSessionId: s['.id']
            })
        }

        if (stuckClients.length === 0) return

        console.log(`[StuckONU] Found ${stuckClients.length} stuck clients`)

        for (const client of stuckClients) {
            await handleStuckClient(client)
        }

    } catch (err) {
        console.error('[StuckONU] Check error:', err.message)
    }
}

function extractOltMac(attributes) {
    // Parse "Framed-IP-Address:172.16.1.8,Mac:90:88:A9:08:D8:09,OLT-Mac:90:88:a9:08:d8:08"
    const match = attributes.match(/OLT-Mac:([\da-fA-F:]+)/i)
    return match ? match[1].toLowerCase() : null
}

async function handleStuckClient(client) {
    console.log(`[StuckONU] Stuck: ${client.username} | ${client.comment} | OLT-Mac: ${client.oltMac}`)

    if (!client.oltMac) {
        // No OLT MAC registered — just notify
        await sendMessage(ADMIN,
            `⚠️ *Stuck ONU Detected*\n${client.comment}\nUsername: \`${client.username}\`\n\n_No OLT-Mac registered — manual reboot needed_`)
        return
    }

    // Find ONU port on OLT by MAC
    let onuInfo
    try {
        onuInfo = await olt.findOnuByMac(client.oltMac)
    } catch (err) {
        console.error('[StuckONU] OLT lookup error:', err.message)
        await sendMessage(ADMIN,
            `⚠️ *Stuck ONU - OLT Unreachable*\n${client.comment}\nOLT-Mac: ${client.oltMac}\nError: ${err.message}`)
        return
    }

    if (!onuInfo) {
        await sendMessage(ADMIN,
            `⚠️ *Stuck ONU - MAC Not Found on OLT*\n${client.comment}\nOLT-Mac: ${client.oltMac}\n_Manual reboot needed_`)
        return
    }

    if (AUTO_REBOOT) {
        // Auto reboot
        try {
            const result = await olt.rebootOnu(onuInfo.port)

            if (result.success) {
                // Mark as recently rebooted
                recentReboots.set(client.username, Date.now())

                await sendMessage(ADMIN,
                    `🔄 *Auto ONU Reboot*\n${client.comment}\nONU Port: \`${onuInfo.port}\`\nOLT-Mac: ${client.oltMac}\nReboot at: ${result.rebootTime}\n\n_Client should reconnect in ~2 minutes_`)
            } else {
                await sendMessage(ADMIN,
                    `❌ *ONU Reboot Failed*\n${client.comment}\nONU Port: \`${onuInfo.port}\`\nCmd: ${result.cmd}`)
            }
        } catch (err) {
            await sendMessage(ADMIN,
                `❌ *ONU Reboot Error*\n${client.comment}\nError: ${err.message}`)
        }
    } else {
        // Just notify — manual reboot
        await sendMessage(ADMIN,
            `⚠️ *Stuck ONU Detected*\n${client.comment}\nONU Port: \`${onuInfo.port}\`\nOLT-Mac: ${client.oltMac}\n\n_Reply /rebootonu ${onuInfo.port} to reboot_`)
    }
}

// Clean up old reboot records every hour
setInterval(() => {
    const now = Date.now()
    for (const [key, ts] of recentReboots) {
        if (now - ts > REBOOT_COOLDOWN) recentReboots.delete(key)
    }
}, 60 * 60 * 1000)

module.exports = { checkStuckOnus }
