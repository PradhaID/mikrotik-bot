const mk = require('../mikrotik')

async function isolirClient(chatId, username, sendMessage) {
    try {
        const users = await mk.apiGet(`/user-manager/user?name=${encodeURIComponent(username)}`)
        if (!users || users.length === 0) {
            return sendMessage(chatId, `❌ Client \`${username}\` not found`)
        }

        const user = users[0]
        const id   = user['.id']

        await mk.apiPatch(`/user-manager/user/${id}`, { group: 'Isolir' })

        // Disconnect active PPPoE session
        try {
            const active = await mk.apiGet(`/ppp/active?name=${encodeURIComponent(username)}`)
            if (active && active.length > 0) {
                await mk.apiPost(`/ppp/active/remove`, { '.id': active[0]['.id'] })
            }
        } catch (e) {}

        const comment = user.comment || username
        await sendMessage(chatId, `🔴 *Client Suspended*\n${comment}\nUsername: \`${username}\``)

    } catch (err) {
        await sendMessage(chatId, `❌ Error: ${err.message}`)
    }
}

async function freeClient(chatId, username, sendMessage) {
    try {
        const users = await mk.apiGet(`/user-manager/user?name=${encodeURIComponent(username)}`)
        if (!users || users.length === 0) {
            return sendMessage(chatId, `❌ Client \`${username}\` not found`)
        }

        const user = users[0]
        const id   = user['.id']

        // Move back to default group
        await mk.apiPatch(`/user-manager/user/${id}`, { group: 'default' })

        // Force disconnect so client reconnects fresh with new group
        let wasConnected = false
        try {
            const active = await mk.apiGet(`/ppp/active?name=${encodeURIComponent(username)}`)
            if (active && active.length > 0) {
                await mk.apiPost(`/ppp/active/remove`, { '.id': active[0]['.id'] })
                wasConnected = true
            }
        } catch (e) {}

        // Also remove from User Manager active sessions
        try {
            const sessions = await mk.apiGet(`/user-manager/session?username=${encodeURIComponent(username)}`)
            for (const s of sessions) {
                if (s.active === 'true' || s.active === true) {
                    await mk.apiPost(`/user-manager/session/remove`, { '.id': s['.id'] })
                }
            }
        } catch (e) {}

        const comment  = user.comment || username
        const statusMsg = wasConnected
            ? 'Client disconnected — will reconnect automatically.'
            : 'Client was offline — will connect normally on next attempt.'

        await sendMessage(chatId,
            `🟢 *Client Unsuspended*\n${comment}\nUsername: \`${username}\`\n_${statusMsg}_`)

    } catch (err) {
        await sendMessage(chatId, `❌ Error: ${err.message}`)
    }
}

module.exports = { isolirClient, freeClient }
