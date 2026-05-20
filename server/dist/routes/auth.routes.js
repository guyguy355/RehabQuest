import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import { Router } from 'express';
import { createAuthToken, publicUserSelect } from '../auth.js';
import { requireAuth } from '../middleware/auth.middleware.js';
const prisma = new PrismaClient();
const router = Router();
const selfRegisterRoles = [Role.PATIENT, Role.THERAPIST];
const passwordResetTokenHours = 1;
router.post('/register', async (request, response, next) => {
    try {
        const { name, email, password, role } = request.body;
        if (!name || !email || !password || !role) {
            response.status(400).json({ message: 'name, email, password, and role are required' });
            return;
        }
        if (!selfRegisterRoles.includes(role)) {
            response.status(400).json({ message: 'role must be PATIENT or THERAPIST' });
            return;
        }
        const normalizedEmail = email.trim().toLowerCase();
        const existingUser = await prisma.user.findUnique({
            where: {
                email: normalizedEmail,
            },
            select: {
                id: true,
            },
        });
        if (existingUser) {
            response.status(409).json({ message: 'Email is already registered' });
            return;
        }
        const passwordHash = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: {
                name: name.trim(),
                email: normalizedEmail,
                passwordHash,
                role,
            },
            select: publicUserSelect,
        });
        response.status(201).json({
            user,
            token: createAuthToken(user.id),
        });
    }
    catch (error) {
        next(error);
    }
});
router.post('/login', async (request, response, next) => {
    try {
        const { email, password } = request.body;
        if (!email || !password) {
            response.status(400).json({ message: 'email and password are required' });
            return;
        }
        const user = await prisma.user.findUnique({
            where: {
                email: email.toLowerCase(),
            },
        });
        if (!user) {
            response.status(401).json({ message: 'Invalid email or password' });
            return;
        }
        const passwordMatches = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatches) {
            response.status(401).json({ message: 'Invalid email or password' });
            return;
        }
        response.json({
            user: toPublicUser(user),
            token: createAuthToken(user.id),
        });
    }
    catch (error) {
        next(error);
    }
});
router.post('/forgot-password', async (request, response, next) => {
    try {
        const { email } = request.body;
        if (!email) {
            response.status(400).json({ message: 'email is required' });
            return;
        }
        const user = await prisma.user.findUnique({
            where: {
                email: email.trim().toLowerCase(),
            },
            select: {
                id: true,
            },
        });
        const result = {
            message: 'If an account exists for that email, a password reset token has been created.',
        };
        if (user) {
            const token = crypto.randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + passwordResetTokenHours * 60 * 60 * 1000);
            await prisma.passwordResetToken.create({
                data: {
                    userId: user.id,
                    token,
                    expiresAt,
                },
            });
            if (process.env.NODE_ENV !== 'production') {
                result.resetToken = token;
            }
        }
        response.json(result);
    }
    catch (error) {
        next(error);
    }
});
router.post('/reset-password', async (request, response, next) => {
    try {
        const { token, password } = request.body;
        if (!token || !password) {
            response.status(400).json({ message: 'token and password are required' });
            return;
        }
        const resetToken = await prisma.passwordResetToken.findUnique({
            where: {
                token,
            },
            select: {
                id: true,
                userId: true,
                expiresAt: true,
                usedAt: true,
            },
        });
        if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
            response.status(400).json({ message: 'Reset token is invalid or expired' });
            return;
        }
        const passwordHash = await bcrypt.hash(password, 10);
        await prisma.$transaction([
            prisma.user.update({
                where: {
                    id: resetToken.userId,
                },
                data: {
                    passwordHash,
                },
            }),
            prisma.passwordResetToken.update({
                where: {
                    id: resetToken.id,
                },
                data: {
                    usedAt: new Date(),
                },
            }),
        ]);
        response.json({ message: 'Password has been reset' });
    }
    catch (error) {
        next(error);
    }
});
router.get('/me', requireAuth, (request, response) => {
    response.json({ user: request.user });
});
function toPublicUser(user) {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
    };
}
export default router;
