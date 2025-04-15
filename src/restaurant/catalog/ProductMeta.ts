export default interface ProductMeta {
  name: string;
  isActive: boolean;
  imageUrls: URL[],
  minPrice: number,
  maxPrice: number,
  variationCount: number,
}
