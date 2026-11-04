import jwt from "jsonwebtoken";

export default (req, res, next) => {

    const header = req.headers.authorization;

    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Token requerido' });
    };
    const token = header.split(' ')[1];

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = payload.id;
        next();
        // payload es lo que metiste al firmar: { id, iat, exp }
    } catch {
        return res.status(401).json({ message: 'Token inválido o expirado' });
    };
};