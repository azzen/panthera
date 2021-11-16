const {MessageEmbed} = require("discord.js");

function fastEmbed(title, message, footer='Messaging system by azzen#0001') {
	return new MessageEmbed()
		.setColor("#ffff00")
		.setTitle(title)
		.setDescription(message)
		.setFooter(footer)
		.setTimestamp()
}

module.exports = {
	fastEmbed
}