const { Collection } = require('discord.js')
const fs = require('fs')
const { REST } = require('@discordjs/rest')
const { Routes } = require('discord-api-types/v9')
const { token, guilds, clientId } = require('./config.json')

const rest = new REST({ version: '9' }).setToken(token)
const commands = new Collection()
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'))

for (const f of commandFiles) {
	const command = require(`./commands/${f}`)
	if (command.permissions) {
		command.data.defaultPermission = false
	}
	commands.set(command.data.name, command)
}

(async () => {
	try {
		console.log('Started refreshing application commands')
		for (guildId of guilds) {
			await rest.put(
				Routes.applicationGuildCommands(clientId, guildId),
				{ body: commands.map(cmd => cmd.data.toJSON()) }
			)
		}
		console.log('Successfully refreshed application commands')
	} catch (err) {
		console.error(err)
	}
})();