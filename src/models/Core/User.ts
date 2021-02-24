import {auth} from "firebase-admin";
import * as Claims from "./Claims";
import UserRecord = auth.UserRecord;

export interface User {
    claims: Claims.Body
    token: auth.DecodedIdToken
}

function onCreateClaims(uid: string) {
    let claims: Claims.Body

    // Set claims on the server
    claims = { businessRole: {} }
    return auth().setCustomUserClaims(uid, Claims.wrapper(claims))
        .catch((e) => {
            console.error(e)
        })
}

/**
 * Triggered by a change to a Firebase Auth user object.
 *
 * @param {!Object} event The Cloud Functions event.
 */
exports.helloNewUser = (event: UserRecord) => {
    try {
        const uid = event.uid
        console.log(`Function triggered by new user: ${event.uid}`);
        console.log(`Created at: ${event.metadata.creationTime}`);

        if (event.email) {
            console.log(`Email: ${event.email}`);
        }

        onCreateClaims(uid)
            .then(() => {
                console.log(`Claims updated for new user ${uid}`)
            })

    } catch (err) {
        console.error(err);
    }
};
