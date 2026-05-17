const mk = require('../mikrotik')

async function isolirClient(chatId, username, sendMessage) {
    try {
        // Find user
        const users = await mk.apiGet(`/user-manager/user?name=${username}`)
        if (!users || users.length === 0) {
            return sendMessage(chatId, `❌ Client \`${username}\` not found`)
        }

        const user = users[0]
        const id   = user['.id']

        // Move to Isolir group
        await mk.apiPost(`/user-manager/user/${id}`, { group: 'Isolir' })

        // Disconnect active PPPoE session if any
        try {
            const active = await mk.apiGet(`/ppp/active?name=${username}`)
            if (active && active.length > 0) {
                await mk.apiPost(`/ppp/active/remove`, { '.id': active[0]['.id'] })
            }
        } catch (e) {}

        const comment = user.comment || username
        await sendMessage(chatId, `🔴 *Client Suspended*\n${comment}`)

    } catch (err) {
        await sendMessage(chatId, `❌ Error: ${err.message}`)
    }
}

async function freeClient(chatId, username, sendMessage) {
    try {
        const users = await mk.apiGet(`/user-manager/user?name=${username}`)
        if (!users || users.length === 0) {
            return sendMessage(chatId, `❌ Client \`${username}\` not found`)
        }

        const user = users[0]
        const id   = user['.id']

        // Move back to default group
        await mk.apiPost(`/user-manager/user/${id}`, { group: 'default' })

        const comment = user.comment || username
        await sendMessage(chatId, `🟢 *Client Unsuspended*\n${comment}`)

    } catch (err) {
        await sendMessage(chatId, `❌ Error: ${err.message}`)
    }
}

module.exports = { isolirClient, freeClient }
