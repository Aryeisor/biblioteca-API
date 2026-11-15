export class AppError extends Error{
    constructor(status, message, code){
        super(message);      // llama al contructor de error
        this.name = 'AppError';
        this.status = status; // codigo: 400, 404 ...
        this.code = code  // codigo para el frontend
    }
}