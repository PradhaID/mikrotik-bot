const mk = require('../mikrotik')

module.exports = async function routesCommand(chatId, sendMessage) {
    try {
        const [routes, netwatch] = await Promise.all([
            mk.getRoutes(),
            mk.getNetwatch()
        ])

        const isp1Watch = netwatch.find(n => n.comment === mk.ISP1_NETWATCH)
        const isp2Watch = netwatch.find(n => n.comment === mk.ISP2_NETWATCH)
        const isp1Icon  = isp1Watch?.status === 'up' ? '✅' : '🔴'
        const isp2Icon  = isp2Watch?.status === 'up' ? '✅' : '🔴'

        // Active default routes in main table
        const defaultRoutes = routes.filter(r =>
            r['dst-address'] === '0.0.0.0/0' &&
            r['routing-table'] === 'main' &&
            r['.flags']?.includes('A')
        )

        // Youtube route
        const ytRoute = routes.find(r =>
            r['dst-address'] === '0.0.0.0/0' &&
            r['routing-table'] === 'Youtube' &&
            r['.flags']?.includes('A')
        )

        let msg = `*Active Routes*\n`
        msg += `\n*ISP Status*`
        msg += `\n${isp1Icon} ${mk.ISP1_NAME}`
        msg += `\n${isp2Icon} ${mk.ISP2_NAME}`

        msg += `\n\n*Default Routes (main table)*`
        if (defaultRoutes.length === 0) {
            msg += `\n_No active default routes!_`
        } else {
            for (const r of defaultRoutes) {
                const comment  = r.comment  || '-'
                const gateway  = r.gateway  || '-'
                const distance = r.distance || '-'
                msg += `\n• ${comment}`
                msg += `\n  GW: \`${gateway}\`  dist: ${distance}`
            }
        }

        if (ytRoute) {
            msg += `\n\n*YouTube Route*`
            msg += `\n• GW: \`${ytRoute.gateway}\` (${ytRoute['routing-table']} table)`
        }

        await sendMessage(chatId, msg)
    } catch (err) {
        await sendMessage(chatId, `❌ Error: ${err.message}`)
    }
}
