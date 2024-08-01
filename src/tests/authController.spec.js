const { login } = require('../controllers/auth'); // ajuste o caminho conforme necessárioe o caminho conforme necessário
const { client } = require("../prisma/client");
const { getUsers, createToken } = require("../models/auth");
const { hash, compare } = require('bcryptjs');

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

describe("Login Controller", () => {
    let req;
    let res;
    let next;

    beforeEach(() => {
        req = {
            body: {
                credential: "testCredential",
                password: "testPassword"
            }
        };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        next = jest.fn();

        client.user = {
            findFirst: jest.fn()
        };
    });

    it("should login successfully with valid credentials", async () => {
        const mockUser = {
            cpf: "12345678901",
            password: await hash("testPassword", 10)
        };
        
        getUsers.mockResolvedValue({ cpf: "12345678901", registros: [mockUser] });
        client.user.findFirst.mockResolvedValue(mockUser);
        compare.mockResolvedValue(true);
        createToken.mockResolvedValue({ token: "testToken", refreshToken: "testRefreshToken" });

        await login(req, res, next);

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({ tokens: { token: "testToken", refreshToken: "testRefreshToken" } });
    });

    it("should fail login with invalid credentials", async () => {
        const mockUser = {
            cpf: "12345678901",
            password: await hash("testPassword", 10)
        };
        
        getUsers.mockResolvedValue({ cpf: "12345678901", registros: [mockUser] });
        client.user.findFirst.mockResolvedValue(mockUser);
        compare.mockResolvedValue(false);

        await login(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ error: 'Usuário ou senha incorretos' });
    });

    it("should fail login if user does not exist", async () => {
        getUsers.mockResolvedValue(null);

        await login(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ error: 'Não é um cliente predialnet' });
    });

    it("should return error for invalid request body", async () => {
        req.body = { credential: 12345 };

        await login(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Dados inválidos' });
    });
});
