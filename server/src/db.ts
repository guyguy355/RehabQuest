import { PrismaClient } from '@prisma/client';
import './config.js';

// One client per process. Tests point DATABASE_URL at the isolated test
// database before this module is imported.
export const prisma = new PrismaClient();

export type Db = PrismaClient;
export type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];
