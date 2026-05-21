import crypto from 'node:crypto';
const publicUserSelect = {
    id: true,
    name: true,
    email: true,
    role: true,
    createdAt: true,
    updatedAt: true,
};
export function createAuthToken(userId) {
    const header = encodeJson({ alg: 'HS256', typ: 'JWT' });
    const payload = encodeJson({ sub: userId });
    const signature = signTokenParts(header, payload);
    return `${header}.${payload}.${signature}`;
}
export function getUserIdFromAuthHeader(authorization) {
    const [scheme, token] = authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) {
        return null;
    }
    try {
        const [header, payload, signature] = token.split('.');
        if (!header || !payload || !signature) {
            return null;
        }
        const expectedSignature = signTokenParts(header, payload);
        if (!signaturesMatch(signature, expectedSignature)) {
            return null;
        }
        const decodedPayload = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
        return decodedPayload.sub ?? null;
    }
    catch {
        return null;
    }
}
export async function getAuthenticatedUser(prisma, authorization) {
    const userId = getUserIdFromAuthHeader(authorization);
    if (!userId) {
        return null;
    }
    return prisma.user.findUnique({
        where: {
            id: userId,
        },
        select: publicUserSelect,
    });
}
function encodeJson(value) {
    return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}
function signTokenParts(header, payload) {
    return crypto.createHmac('sha256', getJwtSecret()).update(`${header}.${payload}`).digest('base64url');
}
function signaturesMatch(value, expected) {
    const valueBuffer = Buffer.from(value);
    const expectedBuffer = Buffer.from(expected);
    return valueBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(valueBuffer, expectedBuffer);
}
function getJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret && process.env.NODE_ENV === 'production') {
        throw new Error('JWT_SECRET is required in production');
    }
    return secret ?? 'rehabquest-development-secret';
}
export { publicUserSelect };
