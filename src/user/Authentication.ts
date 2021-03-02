import { NextFunction, Request, Response } from "express";
import "./User+Request";
import { UserRequest } from "./index";
import * as HttpErrors from "http-errors";

export function authenticate(req: Request, res: Response, next: NextFunction) {
  UserRequest.authenticate(req)
    .then(() => next())
    .catch((error) => next(new HttpErrors.Unauthorized(error.message)));
}

export function isAuthenticated(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const user = req.user;

  if (user) {
    next();
  } else {
    // Forbidden
    const message = "Unauthenticated user";
    next(new HttpErrors.Unauthorized(message));
  }
}
