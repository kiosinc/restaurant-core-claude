import {Request} from "express"
import "./User+Request"
import {authApp} from "../firestore-config/firebaseApp";

export async function authenticate(req: Request) {
  const bearerHeader = req.headers['authorization'];

  if (bearerHeader) {
    try {
      const bearer = bearerHeader.split(' ');
      const bearerToken = bearer[1];

      const decodedIdToken = await authApp.verifyIdToken(bearerToken)

      req.user = {
        claims: decodedIdToken.claims,
        token: decodedIdToken,
      };
    } catch (e) {
      throw e
    }
  }
}