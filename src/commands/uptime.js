const mk = require('../mikrotik')

module.exports = async function uptimeCommand(chatId, sendMessage) {
    try {
        const r = await mk.getResource()
        const memPct = Math.round(
            ((parseInt(r['total-memory']) - parseInt(r['free-memory'])) /
            parseInt(r['total-memory'])) * 100
        )
        const msg = [
            `*System Stats*`,
            ``,
            `💻 CPU: ${r['cpu-load']}% (${r['cpu-count']} cores @ ${r['cpu-frequency']}MHz)`,
            `🧠 RAM: ${memPct}% used`,
            `⏱ Uptime: ${r.uptime}`,
            `📦 ROS: ${r.version}`,
            `🖥 Board: ${r['board-name']}`,
            `💾 Disk: ${Math.round(parseInt(r['free-hdd-space']) / 1073741824 * 10) / 10}GB free`
        ].join('\n')
        await sendMessage(chatId, msg)
    } catch (err) {
        await sendMessage(chatId, `❌ Error: ${err.message}`)
    }
}
