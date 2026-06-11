import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestContext {
  apiName: string;
  docsText: string;
  customerId?: string;
  context?: string;
  goal?: string;
  industry?: string;
  audience?: string;
  preferredStack?: string;
  customerPersona?: string;
  targetSystem?: string;
  sourceId: string;
  businessSourceId?: string;
  
  // Elastic configurations
  elasticUrl?: string;
  elasticApiKey?: string;
  elasticIndex?: string;
  elasticBusinessIndex?: string;
  elasticMemoryIndex?: string;
  mockMode?: boolean;
}

export const requestContextStorage = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext {
  const store = requestContextStorage.getStore();
  if (!store) {
    throw new Error("RequestContext is not active in this asynchronous execution context.");
  }
  return store;
}
