import type { CarbonPatternType, PatternType, WeavePatternType } from '@/types/pattern';

export interface PatternCatalogItem<T extends PatternType = PatternType> {
  value: T;
  label: string;
  structure: string;
  uses: string;
  category: 'Woven' | 'Carbon';
}

export interface PatternCategory<T extends PatternType = PatternType> {
  label: string;
  items: PatternCatalogItem<T>[];
}

export const WOVEN_PATTERN_ITEMS: PatternCatalogItem<WeavePatternType>[] = [
  { value: 'plainWeave', label: 'Plain', structure: '1/1', uses: 'canvas, sheeting', category: 'Woven' },
  { value: 'basketWeave', label: 'Basket', structure: '2/2', uses: 'hopsack, textured cotton', category: 'Woven' },
  { value: 'oxfordWeave', label: 'Oxford', structure: '2/1 basket', uses: 'shirting', category: 'Woven' },
  { value: 'twillWeave21', label: 'Twill', structure: '2/1', uses: 'light denim, workwear', category: 'Woven' },
  { value: 'twillWeave', label: 'Twill', structure: '2/2', uses: 'suiting, uniforms', category: 'Woven' },
  { value: 'twillWeave31', label: 'Twill', structure: '3/1', uses: 'denim, chino, gabardine', category: 'Woven' },
  { value: 'brokenTwillWeave22', label: 'Broken', structure: '2/2', uses: 'denim variants', category: 'Woven' },
  { value: 'brokenTwillWeave31', label: 'Broken', structure: '3/1', uses: 'denim variants', category: 'Woven' },
  { value: 'herringboneWeave', label: 'Herringbone', structure: '2/2 twill', uses: 'coating, tailoring', category: 'Woven' },
  { value: 'chevronWeave', label: 'Chevron', structure: 'pointed twill', uses: 'fashion, decor', category: 'Woven' },
  { value: 'satinWeave', label: 'Satin', structure: '5 harness', uses: 'silky apparel', category: 'Woven' },
  { value: 'satinWeave8', label: 'Satin', structure: '8 harness', uses: 'high-lustre lining', category: 'Woven' },
  { value: 'sateenWeave', label: 'Sateen', structure: '5 harness', uses: 'cotton bedding, shirts', category: 'Woven' },
];

export const CARBON_PATTERN_ITEMS: PatternCatalogItem<CarbonPatternType>[] = [
  { value: 'carbonPlain', label: 'Carbon Plain', structure: '1/1 tow', uses: 'composites', category: 'Carbon' },
  { value: 'carbonTwill', label: 'Carbon Twill', structure: '2/2 tow', uses: 'automotive, props', category: 'Carbon' },
];

export const PATTERN_CATEGORIES: PatternCategory[] = [
  { label: 'Woven', items: WOVEN_PATTERN_ITEMS },
  { label: 'Carbon', items: CARBON_PATTERN_ITEMS },
];

export const ALL_PATTERN_ITEMS: PatternCatalogItem[] = [
  ...WOVEN_PATTERN_ITEMS,
  ...CARBON_PATTERN_ITEMS,
];

export function getPatternItem(type: PatternType): PatternCatalogItem | undefined {
  return ALL_PATTERN_ITEMS.find((item) => item.value === type);
}
