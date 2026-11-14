import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError, type ZodTypeAny, type z } from 'zod';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, details?: unknown) => new HttpError(400, message, 'bad_request', details);
export const unauthorized = (message = 'Authentication required') => new HttpError(401, message, 'unauthorized');
export const forbidden = (message = 'You do not have access to this resource') => new HttpError(403, message, 'forbidden');
export const notFound = (message = 'Not found') => new HttpError(404, message, 'not_found');
export const conflict = (message: string, code = 'conflict') => new HttpError(409, message, code);

type AsyncHandler = (request: Request, response: Response, next: NextFunction) => Promise<unknown>;

/** Forwards rejected promises to the Express error handler (Express 4 does not). */
export function handle(fn: AsyncHandler): RequestHandler {
  return (request, response, next) => {
    fn(request, response, next).catch(next);
  };
}

/** Parses input with a zod schema; failures become a 400 with per-field messages. */
export function parse<S extends ZodTypeAny>(schema: S, input: unknown): z.infer<S> {
  const result = schema.safeParse(input);

  if (!result.success) {
    throw validationError(result.error);
  }

  return result.data;
}

export function validationError(error: ZodError) {
  const fields: Record<string, string> = {};

  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    fields[key] ??= issue.message;
  }

  const first = error.issues[0];
  const label = first?.path.join('.') ?? '';
  const message = first ? `${label ? `${label}: ` : ''}${first.message}` : 'Invalid request';

  return new HttpError(400, message, 'validation_error', { fields });
}

export function requireUser(request: Request) {
  if (!request.user) {
    throw unauthorized();
  }

  return request.user;
}

/** Route parameter as a single string (Express types allow string[]). */
export function param(request: Request, name: string) {
  const value = request.params[name];
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}
