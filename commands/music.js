const {SlashCommandBuilder} = require('@discordjs/builders')
const {MusicPlayer, YoutubeAudioResource, YoutubePlaylist} = require('../utils/audio_player.js')
const {MessageEmbed} = require("discord.js")
const {fastEmbed} = require('../utils/embed.js')

module.exports = {
	data: new SlashCommandBuilder()
		.setName('music')
		.setDescription('Music bot commands')
		.addSubcommand(sc =>
			sc
				.setName('play')
				.setDescription('Play a song')
				.addStringOption(opt =>
					opt
						.setName('link_or_search')
						.setDescription('A YouTube URL or search')
						.setRequired(true))
		)
		.addSubcommand(sc =>
			sc
				.setName('play_list')
				.setDescription('Add a YouTube playlist to the queue')
				.addStringOption(opt =>
					opt
						.setName('playlist_url')
						.setDescription('A YouTube Playlist URL')
						.setRequired(true)))
		.addSubcommand(sc =>
			sc
				.setName('queue')
				.setDescription('View music bot queue')
		)
		.addSubcommand(sc =>
			sc
				.setName('pushback')
				.setDescription('Move a song to the end of the queue')
				.addIntegerOption(opt =>
					opt
						.setName('song_index')
						.setDescription('Index of the song (visible in the queue)')
						.setRequired(true)
				)
		),
	async run(interaction) {
		if (interaction.options.getSubcommand() === 'play') {
			const search = interaction.options.getString('link_or_search')

			if (!interaction.member.voice?.channel) {
				interaction.reply({content: 'You must be in a voice channel to run this command.', ephemeral: true})
				return
			}
			await interaction.deferReply({ephemeral: true})
			let resource = new YoutubeAudioResource(search, interaction.member)
			resource
				.setURL()
				.then(r => {
					r
						.init()
						.then(() => {
							if (!interaction.client.musicPlayer) {
								let player = new MusicPlayer(interaction.client)
									.bind(interaction.channel, interaction.member.voice.channel)
									.connect()
									.subscribe()
								player.push(r)
								player.play()
								interaction.editReply({content: 'Command executed successfully.', ephemeral: true})
							} else {
								interaction.editReply({content: 'Command executed successfully.', ephemeral: true})
								interaction.client.musicPlayer.push(r)
								interaction.client.musicPlayer.message({content: `\`${r.title}\` successfully added to the queue`})
							}
						})
						.catch(err => {
							interaction.editReply({content: 'There was an error: ' + err, ephemeral: true})
							return
						})
				})
		}
		if (interaction.options.getSubcommand() === 'queue') {
			if (interaction.client.musicPlayer?.queue.length > 0) {
				const embed = interaction.client.musicPlayer.getPlaylistEmbed()
				interaction.reply({embeds: [embed]})
			} else {
				interaction.reply('The queue is currently empty.')
			}
		}
		if (interaction.options.getSubcommand() === 'play_list') {
			const url = interaction.options.getString('playlist_url')

			if (!interaction.member.voice?.channel) {
				interaction.reply({content: 'You must be in a voice channel to run this command.', ephemeral: true})
				return
			}

			await interaction.deferReply({ephemeral: true})

			if (!interaction.client.musicPlayer) {
				let player = new MusicPlayer(interaction.client)
				const playlist = new YoutubePlaylist(url, interaction.member, player)
				playlist.parse().then(playlist => {
					try {
						player.bind(interaction.channel, interaction.member.voice.channel)
							.connect()
							.subscribe()
						const embed = fastEmbed('Panthera Music Bot',
							`Parsed [${playlist.title}](${playlist.url}) and added ${playlist.size} songs to the queue`,
							'Music bot by azzen#0001')
							.setThumbnail(playlist.thumbnail)
						player.message({embeds: [embed]})
						player.play()
						interaction.editReply({content: `Command executed successfully`})

					} catch (err) {
						interaction.editReply({content: 'There was an error: ' + err})
						return
					}
				}).catch(err => {
					interaction.editReply({content: 'There was an error: ' + err, ephemeral: true})
					return
				})
			} else {
				const playlist = new YoutubePlaylist(url, interaction.member, interaction.client.musicPlayer)
				playlist.parse().then(playlist => {
					const embed = fastEmbed('Panthera Music Bot',
						`Parsed [${playlist.title}](${playlist.url}) and added ${playlist.size} songs to the queue`,
						'Music bot by azzen#0001')
						.setThumbnail(playlist.thumbnail)
					interaction.client.musicPlayer.message({embeds: [embed]})
					interaction.editReply({content: `Command executed successfully`})
				}). catch(err => {
					interaction.editReply({content: 'There was an error: ' + err, ephemeral: true})
					return
				})
			}
		}
	}
}