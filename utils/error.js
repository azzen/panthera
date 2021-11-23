const { MessageEmbed } = require("discord.js");

function errorEmbed(title, message) {
	return new MessageEmbed()
		.setTitle(title)
		.setDescription(message)
		.setColor("#ff0000")
		.setTimestamp()
		.setFooter('Error management by azzen#0001')
}

module.exports = {
	errorEmbed
}