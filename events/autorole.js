const { roles } = require('../config.json')

async function run(member) {
	const guildId = member.guild.id
	const role = member.guild.roles.cache.find(r => r.id === roles[guildId]['guest'])
	if (role) {
		member.roles.add(role, "Auto add role")
	}
}

module.exports = {
	event: 'guildMemberAdd',
	once: false,
	run: run
}