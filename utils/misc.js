function formatDuration(duration= '0') {
	let d = new Date(parseInt(duration) * 1000).toISOString()
	return duration >= 3600 ? d.substr(11, 8) : d.substr(14, 5)
}

function isValidHTTPURL(s) {
	let url
	try {
		url = new URL(s)
	} catch {
		return false
	}
	return url.protocol === "http:" || url.protocol === "https:"
}

module.exports = {
	formatDuration,
	isValidHTTPURL
}