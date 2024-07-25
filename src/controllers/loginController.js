const { getCredentials } = require("../models/loginModel")


const getAll = async(request, response) => {
    const login = request.params.login
    const cpf = request.params.cpf
    const person = await getCredentials(login)
    if(!person) return response.status(400).json({"error":"login"})
    if(cpf!==person.cpf_cnpj) return response.status(400).json({"error":"cpf"}) 
    return response.status(200).json({
        "nome" : person.nome,
    })
}
module.exports = {
    getAll
}