const { MessageEmbed, Message} = require('discord.js')
const { channels } = require('../config.json')

async function run(deletedMessage) {
	if (!deletedMessage.guild) return
	Promise.all([
		deletedMessage.guild.fetchAuditLogs({
			limit: 1,
			type: 'MESSAGE_DELETE'
		}),
		deletedMessage.guild.channels.cache.get(channels[deletedMessage.guild.id]['logs'])
	]).then(([logs, logsChannel]) => {
		const deletionLog = logs.entries.first()
		const { executor, target } = deletionLog
		const embed = new MessageEmbed()
			.setColor('#ffff00')
			.setDescription(`:wastebasket: Message deleted in <#${deletedMessage.channel.id}>`)
			.addField('Message author', `<@${deletedMessage.author.id}>`, true)
			.addField('Executor', target?.id === deletedMessage.author.id ? `<@${executor.id}>` : 'N/A', true)
			.addField('Message Content', `\`${deletedMessage.content}\``)
			.setTimestamp()
			.setFooter('Logs system by azzen#0001')
		logsChannel.send({ embeds: [embed] })
	}).catch(err => console.log(`Couldn't log message deletion: ${err}`))
}

module.exports = {
	event: 'messageDelete',
	once: false,
	run: run
}