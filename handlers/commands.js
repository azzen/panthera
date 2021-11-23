const fs = require('fs')
const { Collection } = require('discord.js')
const { guilds, roles } = require(`${process.cwd()}/config.json`)

function handler(client) {
	client.commands = new Collection()
	const commandFiles = fs.readdirSync(`${process.cwd()}/commands`).filter(file => file.endsWith('.js'))
	for (const f of commandFiles) {
		const command = require(`${process.cwd()}/commands/${f}`)
		client.commands.set(command.data.name, command)
	}

	client.on('interactionCreate', async interaction => {
		if (!interaction.isCommand()) return

		const command = client.commands.get(interaction.commandName)

		if (!command) return

		command.run(interaction).catch(err => {
			interaction.reply({ content: `There was an error with this command: ${err}` })
		})
	})

	client.on('ready', async () => {
		for (const guildId of guilds) {
			const slashCommands = await client.guilds.cache.get(guildId)?.commands.fetch()
			for (const [slashCommandId, slashCommand] of slashCommands) {
				const command = client.commands.get(slashCommand.name)
				if (command?.permissions?.allowedRoles) {
					const permissions = Object.keys(roles[guildId])
						.filter(k => command.permissions.allowedRoles.includes(k))
						.reduce((acc, key) => {
							acc.push({id: roles[guildId][key], type: 'ROLE', permission: true})
							return acc
						}, [])
					slashCommand.permissions.add({ permissions })
				}
			}
		}
	})
}

module.exports = handler