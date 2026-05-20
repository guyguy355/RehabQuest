import { PrismaClient, Role } from '@prisma/client';
import { getAuthenticatedUser } from '../auth.js';
const prisma = new PrismaClient();
export async function requireAuth(request, response, next) {
    try {
        const user = await loadAuthenticatedUser(request);
        if (!user) {
            response.status(401).json({ message: 'Authentication required' });
            return;
        }
        request.user = user;
        next();
    }
    catch (error) {
        next(error);
    }
}
export function requireRole(role) {
    return async (request, response, next) => {
        try {
            const user = await loadAuthenticatedUser(request);
            if (!user) {
                response.status(401).json({ message: 'Authentication required' });
                return;
            }
            if (user.role !== role) {
                response.status(403).json({ message: `Requires ${role} role` });
                return;
            }
            request.user = user;
            next();
        }
        catch (error) {
            next(error);
        }
    };
}
export const requireTherapist = requireRole(Role.THERAPIST);
export const requirePatient = requireRole(Role.PATIENT);
export const requireAdmin = requireRole(Role.ADMIN);
function loadAuthenticatedUser(request) {
    if (request.user) {
        return request.user;
    }
    return getAuthenticatedUser(prisma, request.headers.authorization);
}
