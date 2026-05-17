const mk = require('../mikrotik')

module.exports = async function routesCommand(chatId, sendMessage) {
    try {
        const routes  = await mk.getRoutes()
        const netwatch = await mk.getNetwatch()

        const sigWatch = netwatch.find(n => n.comment === 'Signal ISP Check')
        const mrWatch  = netwatch.find(n => n.comment === 'MyRepublic ISP Check')
        const sigIcon  = sigWatch?.status === 'up' ? '✅' : '🔴'
        const mrIcon   = mrWatch?.status  === 'up' ? '✅' : '🔴'

        // Find active default routes
        const defaultRoutes = routes.filter(r =>
            r['dst-address'] === '0.0.0.0/0' &&
            r['.flags']?.includes('A') // Active flag
        )

        // Find Youtube route
        const ytRoute = routes.find(r =>
            r['dst-address'] === '0.0.0.0/0' &&
            r['routing-table'] === 'Youtube' &&
            r['.flags']?.includes('A')
        )

        let msg = `*Active Routes*\n`
        msg += `\n*ISP Status*`
        msg += `\n${sigIcon} Signal (vlan204)`
        msg += `\n${mrIcon} MyRepublic (ether2)`

        msg += `\n\n*Default Routes*`
        for (const r of defaultRoutes) {
            const comment  = r.comment || '-'
            const gateway  = r.gateway || '-'
            const distance = r.distance || '-'
            msg += `\n• ${comment}`
            msg += `\n  GW: ${gateway} dist:${distance}`
        }

        if (ytRoute) {
            msg += `\n\n*YouTube Route*`
            msg += `\n• GW: ${ytRoute.gateway} (${ytRoute['routing-table']})`
        }

        await sendMessage(chatId, msg)
    } catch (err) {
        await sendMessage(chatId, `❌ Error: ${err.message}`)
    }
}
