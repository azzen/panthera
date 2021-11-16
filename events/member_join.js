const { channels } = require('../config.json')
const { MessageEmbed } = require("discord.js")

async function run(member) {
	const guildId = member.guild.id
	const channel = await member.guild.channels.cache.get(channels[guildId]['logs'])
	const embed = new MessageEmbed()
		.setColor('#ffff00')
		.setDescription(`:inbox_tray: <@${member.user.id}> has joined the server.`)
		.setThumbnail(member.user.avatarURL())
		.addField('Account creation', `<t:${(member.user.createdTimestamp / 1000).toFixed(0)}:R>`)
		.setTimestamp()
		.setFooter('Logs system by azzen#0001')
	channel.send({ embeds: [embed] })
}

module.exports = {
	event: 'guildMemberAdd',
	once: false,
	run: run
}