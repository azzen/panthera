function randNumber({min = 0, max = 1}) {
	if (min > max) throw 'min should be less than max'
	return Math.random() * (max - min) + min
}

module.exports = {
	randNumber
}
