import * as HttpErrors from "http-errors";

class SquareHttpError {
    status: number
    message: string
    constructor(status: number, message: string) {
        this.status = status;
        this.message = message;
    }

    httpError() {
        return new HttpErrors[this.status](this.message)
    }
}

export class SquareAuthError extends  SquareHttpError {
    type: string;
    constructor(error: any) {
        const body = error.response.body;
        super(error.status, body.message);
        this.type = body.type
    }
}

export class SquareApiError extends  SquareHttpError {

    constructor(error: any) {
        const errors = JSON.parse(error.response.text).errors as Array<any>;

        let message = "";

        errors.forEach((value, index, array) => {
            const category = value["category"];
            const detail = value["detail"];
            message += category + " " + detail + " ";
        })

        super(error.status, message);
    }
}

