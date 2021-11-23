const {
	entersState,
	createAudioResource,
	StreamType,
	createAudioPlayer,
	AudioPlayerStatus,
	VoiceConnectionStatus,
	joinVoiceChannel,
	AudioPlayerIdleState,
} = require('@discordjs/voice')
const yts = require('yt-search')
const {formatDuration, isValidHTTPURL} = require('./misc.js')
const {MessageEmbed} = require('discord.js')
const {errorEmbed} = require('./error.js')
const ytdl = require('ytdl-core')

class YoutubePlaylist {
	constructor(url, member, player) {
		this.requester = member
		this.url = url
		this.player = player
	}

	validateURL() {
		return isValidHTTPURL(this.url) && /^(?!.*\?.*\bv=)https:\/\/www\.youtube\.com\/.*\?.*\blist=.*$/.test(this.url)
	}

	extractListId() {
		// We assume that the URL has already been validated
		const re = /^.*(youtu.be\/|list=)([^#\&\?]*).*/
		const match = re.exec(this.url)
		return match[2]
	}

	async parse() {
		return new Promise(async (resolve, reject) => {
			if (this.validateURL()) {
				const playlist = await yts({listId: this.extractListId()})
				let promises = []
				for (const video of playlist.videos) {
					let r = await new YoutubeAudioResource('https://www.youtube.com/watch?v=' + video.videoId, this.requester).setURL()
					await r._init(() => {}, () => {})
					this.player.push(r)
				}
				resolve(playlist)
			} else
				reject('Invalid playlist URL')
		})
	}
}

class YoutubeAudioResource {
	constructor(search, member) {
		this.requester = member
		this.search = search
	}

	async setURL() {
		return new Promise((resolve, reject) => {
			if (isValidHTTPURL(this.search)) {
				this.url = this.search
				resolve(this)
			} else {
				this.url = this.getURLFromSearch().then(() => resolve(this))
			}
		})
	}

	async getURLFromSearch() {
		return new Promise(async (resolve, reject) => {
			const search = await yts(this.search)
			const video = search.videos[0]
			if (video)
				this.url = video.url
			else
				this.url = 'No video found' // this will reject the promise on init() as the URL won't be validated
			resolve()
		})
	}

	async _init(resolve, reject) {
		ytdl.getInfo(this.url).then(info => {
			this.videoURL = info.videoDetails.video_url
			this.duration = info.videoDetails.lengthSeconds
			this.title = info.videoDetails.title
			this.author = info.videoDetails.author
			this.thumbnail = info.videoDetails.thumbnails[0].url
			resolve()
		}).catch(err => {
			reject(err)
		})
	}

	async init() {
		return new Promise((resolve, reject) => {
			const validate = ytdl.validateURL(this.url)
			if (!validate) reject('Invalid URL: ' + this.url)
			this._init(resolve, reject)
		})
	}

	async getStream() {
		return ytdl(this.url, {filter: 'audioonly'})
	}


	getDuration() {
		return formatDuration(this.duration)
	}

	getTitle() {
		return this.title || '?'
	}

	getThumbnail() {
		return this.thumbnail || 'https://picsum.photos/200'
	}

	getUploaderName() {
		return this.author?.name || '?'
	}

	getVideoURL() {
		return this.videoURL || 'https://www.youtube.com/watch?v=vAX902tSXkg'
	}

	getRequesterTag() {
		return this.requester?.user.tag || '?'
	}

	embed() {
		return new MessageEmbed()
			.setTitle('Now playing')
			.setDescription(`[${this.getTitle()}](${this.getVideoURL()})`)
			.setColor('#ffff00')
			.setThumbnail(this.getThumbnail())
			.addField('Duration', this.getDuration(), true)
			.addField('Requested By', `\`${this.getRequesterTag()}\``, true)
			.addField('Uploader', this.getUploaderName(), true)
			.setFooter('Music bot by azzen#0001')
	}
}

class MusicPlayer {
	constructor(client) {
		this.queue = Array(0)
		this.player = createAudioPlayer()
		this.currentAudioResource = null
		this.client = client
		this.client.musicPlayer = this // this is on purpose

		this.player.on('error', err => console.error(err))
		this.player.on(AudioPlayerStatus.Idle, () => {
			if (this.queue.length > 0 || (this.queue.length === 0 && this.currentAudioResource?.ended)) {
				this.play()
			}
		})
	}

	message(content) {
		this.boundChannel.send(content)
	}

	bind(textChannel, voiceChannel) {
		this.boundChannel = textChannel
		this.voiceChannel = voiceChannel
		this.message({content: `Bound to channel: <#${this.boundChannel.id}>`})
		this.boundMessage = null
		return this
	}

	emitUpdate(content) {
		if (this.boundMessage) {
			this.boundMessage.edit(content)
		} else if (this.boundChannel) {
			this.boundChannel.send(content).then(sentMessage => this.boundMessage = sentMessage)
		}
	}

	connect() {
		this.connection = joinVoiceChannel({
			channelId: this.voiceChannel.id,
			guildId: this.voiceChannel.guild.id,
			adapterCreator: this.voiceChannel.guild.voiceAdapterCreator
		})

		if (!(this.connection)) return; // this will throw an error at some point

		this.connection.on(VoiceConnectionStatus.Disconnected, async (oldState, newState) => {
			try {
				await Promise.race([
					entersState(this.connection, VoiceConnectionStatus.Signalling, 5000),
					entersState(this.connection, VoiceConnectionStatus.Connecting, 5000)
				])
			} catch (err) {
				this.connection.destroy()
				console.log('Connection destroyed')
			}
		})
		return this
	}

	subscribe() {
		this.subscription = this.connection.subscribe(this.player)
		return this
	}

	async play() {
		if (this.queue.length > 0) {
			const resource = this.queue.shift()
			try {
				// At this point the player is already subscribed to a VoiceConnection and ready to stream
				this.currentYouTubeResource = resource
				const stream = await resource.getStream() // ytdl(...)
				this.currentAudioResource = createAudioResource(stream, {
					inputType: StreamType.Arbitrary,
					metadata: {title: resource.title}
				})
				this.player.play(this.currentAudioResource)
				this.emitUpdate({embeds: [resource.embed()]})
			} catch (err) {
				console.log("There was an error while getting the stream: " + err)
				this.emitUpdate({embeds: [errorEmbed('An error occurred while getting the stream', err.toString())]})
			}
		} else {
			this.emitUpdate({content: "There is no music left to play, quitting.", embeds: []})
			this.connection.destroy()
			this.client.musicPlayer = null
		}
	}

	getPlaylistEmbed() {
		if (this.queue.length > 0) {
			return new MessageEmbed()
				.setTitle('Panthera\'s Playlist')
				.setColor('#ffff00')
				.addField('Currently playing', `[${this.currentYouTubeResource.getTitle()}](${this.currentYouTubeResource.getVideoURL()})`)
				.addField('Up next', this.queue.reduce((acc, r, i) => {
					if (i < 10)
						acc += `\`${i + 1}.\` [${r.getTitle()}](${r.getVideoURL()})\n`
					return acc
				}, ''))
				.setThumbnail(this.currentYouTubeResource.getThumbnail())
				.setFooter('Music bot by azzen#0001')
				.setTimestamp()
		}
		// fallback
		return new MessageEmbed()
			.setTitle('Panthera\'s Playlist')
			.setColor('#ffff00')
			.setDescription('The queue is currently empty')
			.setFooter('Music bot by azzen#0001')
			.setTimestamp()
	}

	// At this point the audio resource has been validated
	push(audioResource) {
		this.queue.push(audioResource)
	}

	skip() {
		if (this.queue.length > 0)
			this.play()
	}

	pause() {
		this.player.pause()
	}

	resume() {
		this.player.unpause()
	}

	removeFromQueue(index) {
		if (0 <= index <= this.queue.length) {
			this.queue.splice(index, 1)
			return true
		}
		return false
	}

	move(from, to) {
		if (0 <= from <= this.queue.length && 0 <= to <= this.queue.length) {
			this.queue.splice(to, 0, this.queue.splice(from, 1)[0])
			return true
		}
		return false
	}

	moveToFront(index) {
		if (0 <= index <= this.queue.length) {
			return this.move(index, 0)
		}
		return false
	}

	moveToEnd(index) {
		if (0 <= index <= this.queue.length) {
			return this.move(index, this.queue.length - 1)
		}
		return false
	}
}

module.exports = {
	YoutubePlaylist,
	YoutubeAudioResource,
	MusicPlayer,
}