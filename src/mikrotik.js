const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args))

const {
    MIKROTIK_HOST,
    MIKROTIK_PORT,
    MIKROTIK_USER,
    MIKROTIK_PASS,
    MIKROTIK_USE_SSL
} = process.env

const protocol = MIKROTIK_USE_SSL === 'true' ? 'https' : 'http'
const baseURL  = `${protocol}://${MIKROTIK_HOST}:${MIKROTIK_PORT}/rest`
const authHeader = 'Basic ' + Buffer.from(`${MIKROTIK_USER}:${MIKROTIK_PASS}`).toString('base64')

async function apiGet(path) {
    const res = await fetch(`${baseURL}${path}`, {
        headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json'
        }
    })
    if (!res.ok) throw new Error(`MikroTik API error: ${res.status} ${path}`)
    return res.json()
}

async function apiPost(path, body) {
    const res = await fetch(`${baseURL}${path}`, {
        method: 'POST',
        headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    })
    if (!res.ok) throw new Error(`MikroTik API error: ${res.status} ${path}`)
    return res.json()
}

// ── Resource ──────────────────────────────────────────
async function getResource() {
    return apiGet('/system/resource')
}

// ── Interfaces ────────────────────────────────────────
async function getInterfaceTraffic(interfaces) {
    // interfaces = ['vlan204', 'ether2']
    return apiPost('/interface/monitor-traffic', {
        interface: interfaces.join(','),
        once: true
    })
}

// ── PPPoE Active ──────────────────────────────────────
async function getPPPoEActive() {
    return apiGet('/ppp/active')
}

// ── Netwatch ──────────────────────────────────────────
async function getNetwatch() {
    return apiGet('/tool/netwatch')
}

// ── User Manager Sessions ─────────────────────────────
async function getUMSessions() {
    return apiGet('/user-manager/session?active=yes')
}

async function getUMUsers() {
    return apiGet('/user-manager/user')
}

// ── Routes ────────────────────────────────────────────
async function getRoutes() {
    return apiGet('/ip/route')
}

// ── Isolir clients ────────────────────────────────────
async function getIsolirClients() {
    return apiGet('/user-manager/user?group=Isolir')
}

module.exports = {
    getResource,
    getInterfaceTraffic,
    getPPPoEActive,
    getNetwatch,
    getUMSessions,
    getUMUsers,
    getRoutes,
    getIsolirClients,
    apiGet,
    apiPost
}
