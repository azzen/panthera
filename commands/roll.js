const { SlashCommandBuilder } = require('@discordjs/builders')
const { randNumber } = require('../utils/random.js')

module.exports = {
	data: new SlashCommandBuilder()
		.setName('roll')
		.setDescription('Generates a random number between <min=0> and <max=1>')
		.addIntegerOption(opt => opt.setName('min').setDescription('Lower bound'))
		.addIntegerOption(opt => opt.setName('max').setDescription('Upper bound')),
	async run(interaction) {
		const min = interaction.options.getInteger('min') ?? undefined
		const max = interaction.options.getInteger('max') ?? undefined
		interaction.reply({ content: `You rolled a ${randNumber({ min: min, max: max })}`})
	}
}