const { newUser } = require('../controllers/auth'); // ajuste o caminho conforme necessário
const { client } = require("../prisma/client");
const { getUsers, generatePassword, passwordExistsInDatabase } = require("../models/auth");
const { hash } = require('bcryptjs');

jest.mock("../models/auth");
jest.mock("../prisma/client", () => {
    return {
        client: {
            user: {
                findFirst: jest.fn(),
                create: jest.fn()
            }
        }
    };
});
jest.mock('bcryptjs');

describe("New User Controller", () => {
    let req;
    let res;
    let next;

    beforeEach(() => {
        req = {
            body: {
                userCredential: "testCredential"
            }
        };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        next = jest.fn();
    });

    it("should create a new user successfully", async () => {
        const mockCliente = {
            cpf: "12345678901",
            email: "test@example.com",
            registros: [
                { cNumber: "123456" }
            ]
        };
        const mockHashedPassword = await hash("testPassword", 10);
        
        getUsers.mockResolvedValue(mockCliente);
        client.user.findFirst.mockResolvedValue(null); // User does not exist
        generatePassword.mockReturnValue("testPassword");
        passwordExistsInDatabase.mockResolvedValue(false);
        hash.mockResolvedValue(mockHashedPassword);
        client.user.create.mockResolvedValue({ id: 1, cpf: "12345678901", cNumber: "123456", password: mockHashedPassword });

        await newUser(req, res, next);

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            cliente: mockCliente,
            email: mockCliente.email,
            registrosDB: [{ id: 1, cpf: "12345678901", cNumber: "123456", password: mockHashedPassword }],
            password: "testPassword",
            status: "Conta criada com sucesso"
        }));
    });

    it("should return error if user already exists", async () => {
        const mockCliente = {
            cpf: "12345678901",
            email: "test@example.com",
            registros: [
                { cNumber: "123456" }
            ]
        };
        
        getUsers.mockResolvedValue(mockCliente);
        client.user.findFirst.mockResolvedValue({ id: 1, cpf: "12345678901" }); // User exists

        await newUser(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Usuário já existe.' });
    });

    it("should return error if not a cliente predialnet", async () => {
        getUsers.mockResolvedValue(null);

        await newUser(req, res, next);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ error: 'Não é cliente predialnet' });
    });

    it("should return error for invalid request body", async () => {
        req.body = { userCredential: 12345 };

        await newUser(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Dados inválidos' });
    });
});
