
export interface Body {
    businessRole: { [businessId: string]: Role }
}

export function wrapper(body: Body) {
    // Create a second layer of "claim"
    // This becomes the property name on the decoded token "token.claims.businessRole" not "token.claims.claims.businessRole"
    return { claims: body}
}
