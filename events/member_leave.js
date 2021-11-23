const { MessageEmbed } = require("discord.js")
const { channels } = require('../config.json')

async function run(member) {
	const guildId = member.guild.id
	const channel = await member.guild.channels.cache.get(channels[guildId]['logs'])
	const embed = new MessageEmbed()
		.setColor('#ffff00')
		.setDescription(`:outbox_tray: <@${member.user.id}> has left the server.`)
		.setThumbnail(member.user.avatarURL())
		.setTimestamp()
		.setFooter('Logs system by azzen#0001')
	channel.send({ embeds: [embed] })
}

module.exports = {
	event: 'guildMemberRemove',
	once: false,
	run: run
}