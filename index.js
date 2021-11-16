const { Client, Intents } = require('discord.js')
const { token } = require('./config.json')
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_MEMBERS, Intents.FLAGS.GUILD_VOICE_STATES] })

client.on('ready', () => {
	console.log(`Logged in as ${client.user.tag}.`)
})

for (const handler of ['events', 'commands']) {
	require(`./handlers/${handler}.js`)(client)
}

client.login(token)