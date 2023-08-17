export interface Address {
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  zip: string
  country: string
}

export const emptyAddress = {
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  zip: "",
  country: "",
}
