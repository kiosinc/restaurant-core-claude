export interface Point {
  x: number
  y: number
}

export interface ImageOverlayLinearGradient {
  colorsHex: string[]
  gradientStartPoint: Point | null
  gradientEndPoint: Point | null
}

export interface ImageOverlays {
  imageOverlayLinearGradients: ImageOverlayLinearGradient | null;
  imageOverlayTextColorHex: string | null;
}
