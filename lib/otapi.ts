import { identifyProductSource, resolveProductFromProvider } from "@/services/product-provider-service";

export const parseProviderUrl = identifyProductSource;
export const resolveProductFromOtapi = resolveProductFromProvider;
