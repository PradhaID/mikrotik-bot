module.exports = async function helpCommand(chatId, sendMessage) {
    const msg = [
        `*PradhaNet Bot Commands*`,
        ``,
        `*Monitoring*`,
        `/stats - Full router status`,
        `/isp - ISP bandwidth`,
        `/clients - Active clients`,
        `/uptime - System stats`,
        `/top - Top 10 bandwidth users`,
        `/routes - Active routes`,
        `/live - Realtime monitor`,
        `/stop - Stop live monitor`,
        ``,
        `*Management*`,
        `/isolir - List suspended clients`,
        `/isolir USERNAME - Suspend client`,
        `/free USERNAME - Unsuspend client`,
        `/reboot - Reboot router (needs confirm)`,
        ``,
        `*Alerts (automatic)*`,
        `🔴 ISP failover`,
        `⚠️ High CPU/RAM/bandwidth`,
        `🔴 Low disk space`,
        `🟢 Bot startup`
    ].join('\n')

    // Fix — call sendMessage with only the message, not chatId again
    await sendMessage(chatId, msg)
}
