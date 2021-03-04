/**
 * Authentication Module
 */
import { NextFunction, Request, Response } from 'express';
import './User+Request';
import * as HttpErrors from 'http-errors';
import authenticateRequest from './UserRequest';

/**
 * Express middleware to extract authentication from a request
 */
export function authenticate(req: Request, res: Response, next: NextFunction) {
  authenticateRequest(req)
    .then(() => next())
    .catch((error) => next(new HttpErrors.Unauthorized(error.message)));
}

/**
 * Checks if a request is authenticated.
 * Returns Unauthenticated HTTP Error to NextFunction on fail.
 */
export function isAuthenticated(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const { user } = req;

  if (user) {
    next();
  } else {
    const message = 'Unauthenticated user';
    next(new HttpErrors.Unauthorized(message));
  }
}
