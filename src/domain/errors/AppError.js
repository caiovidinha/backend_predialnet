class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.name = this.constructor.name;
  }
}

class AuthError extends AppError {
  constructor(message = 'Não autorizado') { super(message, 401); }
}

class ForbiddenError extends AppError {
  constructor(message = 'Acesso negado') { super(message, 403); }
}

class NotFoundError extends AppError {
  constructor(message = 'Recurso não encontrado') { super(message, 404); }
}

class ValidationError extends AppError {
  constructor(message) { super(message, 400); }
}

module.exports = { AppError, AuthError, ForbiddenError, NotFoundError, ValidationError };
