const { refreshTokenRegenerate } = require("../models/auth");

const renewToken = async (req, res) => {
    const { refresh_token } = req.body;

    if (!refresh_token) {
        return res.status(400).json({ error: "refresh_token é obrigatório" });
    }

    const token = await refreshTokenRegenerate(refresh_token);

    if (!token) {
        return res.status(401).json({ error: "Refresh token inválido ou expirado" });
    }

    return res.status(200).json(token);
};

module.exports = {
    renewToken,
};
