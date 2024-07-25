const { getClientes, existeEnd } = require("../models/consultaModel")

const getAll = async(request, response) => {
    const lista = await getClientes()
    const existe = existeEnd(lista,request.params.cep,request.params.num)
    return response.status(200).json({existe: existe})
}

getOk = async(request, response) => {
    return response.status(200).json({pong: "true"})
}
module.exports = {
    getAll,
    getOk
}