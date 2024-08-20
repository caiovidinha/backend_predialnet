const { refreshTokenRegenerate } = require("../models/auth");

const renewToken = async (req, res) => {
    const { refresh_token } = req.body;
    const token = await refreshTokenRegenerate(refresh_token);
    res.status(201).json(token);
};

module.exports = {
    renewToken,
};
