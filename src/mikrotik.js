const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args))

const {
    MIKROTIK_HOST,
    MIKROTIK_PORT,
    MIKROTIK_USER,
    MIKROTIK_PASS,
    MIKROTIK_USE_SSL
} = process.env

// ISP config from env
const ISP1_NAME      = process.env.ISP1_NAME      || 'ISP Primary'
const ISP2_NAME      = process.env.ISP2_NAME      || 'ISP Secondary'
const ISP1_INTERFACE = process.env.ISP1_INTERFACE || 'vlan204'
const ISP2_INTERFACE = process.env.ISP2_INTERFACE || 'ether2'
const ISP1_NETWATCH  = process.env.ISP1_NETWATCH_COMMENT || 'Signal ISP Check'
const ISP2_NETWATCH  = process.env.ISP2_NETWATCH_COMMENT || 'MyRepublic ISP Check'

const protocol = MIKROTIK_USE_SSL === 'true' ? 'https' : 'http'
const baseURL   = `${protocol}://${MIKROTIK_HOST}:${MIKROTIK_PORT}/rest`
const authHeader = 'Basic ' + Buffer.from(`${MIKROTIK_USER}:${MIKROTIK_PASS}`).toString('base64')

async function apiGet(path) {
    const res = await fetch(`${baseURL}${path}`, {
        headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(10000)
    })
    if (!res.ok) throw new Error(`MikroTik API ${res.status}: ${path}`)
    return res.json()
}

async function apiPost(path, body = {}) {
    const res = await fetch(`${baseURL}${path}`, {
        method: 'POST',
        headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000)
    })
    if (!res.ok) throw new Error(`MikroTik API ${res.status}: ${path}`)
    return res.json()
}

async function apiPatch(path, body = {}) {
    const res = await fetch(`${baseURL}${path}`, {
        method: 'PATCH',
        headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000)
    })
    if (!res.ok) throw new Error(`MikroTik API ${res.status}: ${path}`)
    return res.json()
}

async function getResource()          { return apiGet('/system/resource') }
async function getPPPoEActive()       { return apiGet('/ppp/active') }
async function getNetwatch()          { return apiGet('/tool/netwatch') }
async function getUMSessions()        { return apiGet('/user-manager/session?active=yes') }
async function getUMUsers()           { return apiGet('/user-manager/user') }
async function getRoutes()            { return apiGet('/ip/route') }
async function getIsolirClients()     { return apiGet('/user-manager/user?group=Isolir') }

async function getInterfaceTraffic(interfaces) {
    return apiPost('/interface/monitor-traffic', {
        interface: interfaces.join(','),
        once: true
    })
}

module.exports = {
    apiGet, apiPost, apiPatch,
    getResource, getPPPoEActive, getNetwatch,
    getUMSessions, getUMUsers, getRoutes,
    getIsolirClients, getInterfaceTraffic,
    ISP1_NAME, ISP2_NAME,
    ISP1_INTERFACE, ISP2_INTERFACE,
    ISP1_NETWATCH, ISP2_NETWATCH
}
