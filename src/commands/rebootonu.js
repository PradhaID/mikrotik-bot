const olt = require('../olt')

module.exports = async function rebootOnuCommand(chatId, port, sendMessage) {
    if (!port) {
        return sendMessage(chatId,
            `Usage: /rebootonu PORT\nExample: /rebootonu 0/2/1:5`)
    }

    try {
        await sendMessage(chatId, `🔄 Sending reboot to ONU \`${port}\`...`)
        const result = await olt.rebootOnu(port)

        if (result.success) {
            await sendMessage(chatId,
                `✅ *ONU Reboot Scheduled*\nPort: \`${port}\`\nReboot at: ${result.rebootTime}\n\n_ONU will be back online in ~2 minutes_`)
        } else {
            await sendMessage(chatId, `❌ Reboot failed for \`${port}\``)
        }
    } catch (err) {
        await sendMessage(chatId, `❌ Error: ${err.message}`)
    }
}
