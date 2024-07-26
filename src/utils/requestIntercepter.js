
const requestIntercepter = (req, res, next) => {
    console.log(`➡️  ${res.statusCode} ${req.method} ${req.originalUrl} ${JSON.stringify(req.body)}`)
    next()
}

module.exports = requestIntercepter