const { SlashCommandBuilder } = require('@discordjs/builders')

module.exports = {
	permissions: { allowedRoles: ['admin'] },
	data: new SlashCommandBuilder()
		.setName('invite')
		.setDescription('Generates a new temporary guild invitation'),
	async run(interaction) {
		const invite = await interaction.channel.createInvite({
			maxAge: 10 * 60,
			maxUses: 1
		}, 'Automatic invite generation')
		interaction.reply({ content: `Invitation link: ${invite}`, ephemeral: true})
	}
}