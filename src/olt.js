const { Telnet } = require('telnet-client')

const OLT_HOST     = process.env.OLT1_HOST || '10.0.0.4'
const OLT_PORT     = parseInt(process.env.OLT1_PORT || 23)
const OLT_USER     = process.env.OLT1_USER || 'admin'
const OLT_PASS     = process.env.OLT1_PASS || 'admin'
const OLT_ENABLE   = process.env.OLT1_ENABLE_PASS || ''

async function oltConnect() {
    const conn = new Telnet()
    await conn.connect({
        host: OLT_HOST,
        port: OLT_PORT,
        timeout: 10000,
        loginPrompt: /Username:|login:/i,
        passwordPrompt: /Password:/i,
        username: OLT_USER,
        password: OLT_PASS,
        initialLFCR: true,
        shellPrompt: /[>\]#]\s*$/,
        execTimeout: 5000,
        sendTimeout: 5000
    })
    return conn
}

async function getOLTTime(conn) {
    const result = await conn.exec('display time')
    // Parse: "Wed 2026/05/27 19:13:32 UTC +07:00 +7:00_0"
    const match = result.match(/(\d{2}:\d{2}:\d{2})/)
    if (!match) throw new Error('Could not parse OLT time')
    return match[1]
}

function addOneMinute(timeStr) {
    const [h, m, s] = timeStr.split(':').map(Number)
    const date = new Date()
    date.setHours(h, m + 1, s)
    return [
        String(date.getHours()).padStart(2, '0'),
        String(date.getMinutes()).padStart(2, '0'),
        String(date.getSeconds()).padStart(2, '0')
    ].join(':')
}

async function getOnuList(conn) {
    const result = await conn.exec('display onu info')
    const lines = result.split('\n')
    const onus = []

    for (const line of lines) {
        // Parse: "0/2/1:1   14:a1:d4:ba:f3:68  26/05/20 20:57:41  other  V7.1.10P1T9    Normal"
        const match = line.match(/^(\d+\/\d+\/\d+:\d+)\s+([\da-f:]+)\s+.*?(Normal|Offline)/i)
        if (match) {
            onus.push({
                port:   match[1],              // e.g. "0/2/1:1"
                mac:    match[2].toLowerCase(), // e.g. "14:a1:d4:ba:f3:68"
                status: match[3]               // "Normal" or "Offline"
            })
        }
    }
    return onus
}

async function rebootOnu(port) {
    let conn
    try {
        conn = await oltConnect()

        // Enter enable + system-view
        await conn.exec('enable')
        if (OLT_ENABLE) await conn.exec(OLT_ENABLE)
        await conn.exec('system-view')

        // Get current OLT time and add 1 minute
        const currentTime = await getOLTTime(conn)
        const rebootTime  = addOneMinute(currentTime)

        // Send reboot command
        const cmd    = `auto-reboot-onu ${port} at ${rebootTime}`
        const result = await conn.exec(cmd)

        console.log(`[OLT] Reboot command sent: ${cmd}`)
        console.log(`[OLT] Response: ${result}`)

        const success = result.includes('successfully') || result.includes('Enable auto reboot')
        return { success, rebootTime, cmd }

    } finally {
        if (conn) await conn.end()
    }
}

async function findOnuByMac(mac) {
    let conn
    try {
        conn = await oltConnect()
        const onus = await getOnuList(conn)
        const normalized = mac.toLowerCase().replace(/-/g, ':')
        return onus.find(o => o.mac === normalized) || null
    } finally {
        if (conn) await conn.end()
    }
}

module.exports = { rebootOnu, findOnuByMac, getOnuList }
