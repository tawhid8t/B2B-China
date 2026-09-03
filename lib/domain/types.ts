import type {
  ORDER_STATUSES,
  PRODUCT_SOURCES,
  QC_STATUSES,
  SUPPORTED_PRODUCT_PROVIDERS,
  USER_ROLES,
  WALLET_RESERVATION_STATUSES,
  WALLET_TRANSACTION_TYPES
} from "@/lib/domain/constants";

export type UserRole = (typeof USER_ROLES)[number];
export type Provider = (typeof SUPPORTED_PRODUCT_PROVIDERS)[number];
export type ProductSource = (typeof PRODUCT_SOURCES)[number];
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type QcStatus = (typeof QC_STATUSES)[number];
export type WalletTransactionType = (typeof WALLET_TRANSACTION_TYPES)[number];
export type WalletReservationStatus = (typeof WALLET_RESERVATION_STATUSES)[number];

export type ProductSku = {
  id: string;
  providerSkuId?: string;
  label: string;
  attributes: Record<string, string>;
  priceCny: number;
  availableQuantity?: number;
  imageUrl?: string;
};

export type ResolvedProduct = {
  provider: Provider;
  source: ProductSource;
  providerItemId: string;
  originalUrl: string;
  title: string;
  titleCn?: string;
  images: string[];
  category: string;
  domesticDeliveryCny: number;
  priceMinCny?: number;
  priceMaxCny?: number;
  skus: ProductSku[];
  raw?: unknown;
};

export type EstimateInput = {
  productId: string;
  skuId: string;
  quantity: number;
  clientId: string;
  unitPriceCny: number;
  domesticDeliveryCny: number;
  category: string;
  estimatedUnitWeightKg?: number;
};

export type EstimateBreakdown = {
  estimateId: string;
  unitPriceCny: number;
  quantity: number;
  productSubtotalCny: number;
  domesticDeliveryCny: number;
  estimatedWeightKg: number;
  categoryShippingBdt: number;
  chinaToGuangzhouBdt: number;
  profitBdt: number;
  exchangeRateCnyToBdt: number;
  totalBdt: number;
  totalCnyEquivalent: number;
  validUntil: string;
};

export type DashboardMetric = {
  label: string;
  value: string;
  detail: string;
};
