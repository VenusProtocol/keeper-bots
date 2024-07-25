import { DocumentNode } from "graphql";
import { Client as UrqlClient, createClient } from "urql/core";

import {
  TokenConverterConfigsByAssetInAndAssetOutAndConverterDocument,
  TokenConverterConfigsByAssetInAndAssetOutAndConverterQuery,
  TokenConverterConfigsByAssetInAndAssetOutDocument,
  TokenConverterConfigsByAssetInAndAssetOutQuery,
  TokenConverterConfigsByAssetInDocument,
  TokenConverterConfigsByAssetInQuery,
  TokenConverterConfigsByAssetOutDocument,
  TokenConverterConfigsByAssetOutQuery,
  TokenConverterConfigsByTokenConverterDocument,
  TokenConverterConfigsByTokenConverterQuery,
  TokenConverterConfigsDocument,
  TokenConverterConfigsQuery,
  CoreVTokensFromUnderlyingDocument,
  CoreVTokensFromUnderlyingQuery,
  IsolatedVTokensFromUnderlyingDocument,
  IsolatedVTokensFromUnderlyingQuery
} from "./.graphclient";

class SubgraphClient {
  urqlClient: UrqlClient;

  constructor(url: string) {
    this.urqlClient = createClient({
      url,
      requestPolicy: "network-only",
    });
  }

  async query<data>(document: DocumentNode, args: Record<string, string[] | string>) {
    const result = await this.urqlClient.query<data>(document, args).toPromise();
    return result;
  }

  async getTokenConverterConfigs() {
    const result = await this.query<TokenConverterConfigsQuery>(TokenConverterConfigsDocument, {});
    return result;
  }

  async getTokenConverterConfigsByTokenConverter(address: string) {
    const result = await this.query<TokenConverterConfigsByTokenConverterQuery>(TokenConverterConfigsByTokenConverterDocument, { id: address.toLowerCase() });
    return result;
  }

  async getTokenConverterConfigsByAssetOut(tokenAddressOut: string) {
    const result = await this.query<TokenConverterConfigsByAssetOutQuery>(TokenConverterConfigsByAssetOutDocument, {
      tokenAddressOut: tokenAddressOut.toLowerCase(),
    });
    return result;
  }

  async getTokenConverterConfigsByAssetIn(tokenAddressIn: string) {
    const result = await this.query<TokenConverterConfigsByAssetInQuery>(TokenConverterConfigsByAssetInDocument, { tokenAddressIn: tokenAddressIn.toLowerCase() });
    return result;
  }

  async getTokenConverterConfigsByAssetInAndAssetOut(tokenAddressIn: string, tokenAddressOut: string) {
    const result = await this.query<TokenConverterConfigsByAssetInAndAssetOutQuery>(TokenConverterConfigsByAssetInAndAssetOutDocument, {
      tokenAddressIn: tokenAddressIn.toLowerCase(),
      tokenAddressOut: tokenAddressOut.toLowerCase(),
    });
    return result;
  }

  async getTokenConverterConfigsByAssetInAndAssetOutAndConverter(tokenAddressIn: string, tokenAddressOut: string, tokenConverter: string) {
    const result = await this.query<TokenConverterConfigsByAssetInAndAssetOutAndConverterQuery>(TokenConverterConfigsByAssetInAndAssetOutAndConverterDocument, {
      tokenAddressIn: tokenAddressIn.toLowerCase(),
      tokenAddressOut: tokenAddressOut.toLowerCase(),
      tokenConverter: tokenConverter.toLowerCase()
    });
    return result;
  }

  async getCoreVTokensFromUnderlying(underlyingAddress: string) {
    const result = await this.query<CoreVTokensFromUnderlyingQuery>(CoreVTokensFromUnderlyingDocument, { underlyingAddress: underlyingAddress.toLowerCase() });
    return result;
  }

  async getIsolatedVTokensFromUnderlying(underlyingAddress: string) {
    const result = await this.query<IsolatedVTokensFromUnderlyingQuery>(IsolatedVTokensFromUnderlyingDocument, { underlyingAddress: underlyingAddress.toLowerCase() });
    return result;
  }
}

export default SubgraphClient;
