const fs = require('fs')

function handler(client) {
	const eventFiles = fs.readdirSync(`${process.cwd()}/events`).filter(file => file.endsWith('.js'))
	for (const f of eventFiles) {
		const data = require(`${process.cwd()}/events/${f}`)

		const eventName = data.event
		const emitter = (typeof data.emitter === 'string' ? client[data.emitter] : data.emitter) || client
		const once = data.once

		try {
			emitter[once ? 'once' : 'on'](eventName, (...args) => data.run(...args))
		} catch (err) {
			console.error(err.stack)
		}
	}
}

module.exports = handler