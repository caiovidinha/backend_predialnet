const appService = require('../../application/app/AppService');

const versionCheck = (req, res) => {
  const version = req.query.version || req.body?.version;
  const result = appService.versionCheck({ version });
  return res.status(200).json(result);
};

module.exports = { versionCheck };
