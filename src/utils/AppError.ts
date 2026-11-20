export class AppError extends Error {
    // Los campos se declaran aquí, no en el constructor (public status: number):
    // esa forma abreviada genera código real y erasableSyntaxOnly la prohíbe.
    readonly status: number; // código HTTP: 400, 404...
    // Código para el frontend. Es opcional: validarId lanza AppError sin código.
    readonly code: string | undefined;

    constructor(status: number, message: string, code?: string) {
        super(message); // llama al constructor de Error
        this.name = 'AppError';
        this.status = status;
        this.code = code;
    }
}
