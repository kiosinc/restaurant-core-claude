export default interface ProductMeta {
  name: string;
  isActive: boolean;
  imageUrls: URL[],
  imageGsls: URL[],
  minPrice: number,
  maxPrice: number,
  variationCount: number,
}
