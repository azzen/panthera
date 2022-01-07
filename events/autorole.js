const { roles } = require('../config.json')

async function run(oldMember, newMember) {
	if (oldMember.pending && !newMember.pending) {
		const guildId = newMember.guild.id
		const role = newMember.guild.roles.cache.find(r => r.id === roles[guildId]['guest'])
		if (role) {
			newMember.roles.add(role, "Auto add role")
		}
	}
}

module.exports = {
	event: 'guildMemberUpdate',
	once: false,
	run: run
}