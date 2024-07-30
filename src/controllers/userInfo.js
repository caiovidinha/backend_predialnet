const {getUser, getPassword} = require('../models/userInfo')

getInfo = async(req, res) => {
    const type = req.params.type
    const id = req.params.id
    if(type == 'password') return res.status(201).json(getPassword(id))
    return res.status(201).json(getUser(id))

}

module.exports ={
    getInfo
}