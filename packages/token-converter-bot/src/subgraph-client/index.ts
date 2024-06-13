import { DocumentNode } from "graphql";
import { Client as UrqlClient, createClient } from "urql/core";

import {
  TokenConverterByAssetInAndAssetOutAndConverterDocument,
  TokenConverterByAssetInAndAssetOutDocument,
  TokenConverterByAssetInDocument,
  TokenConverterByAssetOutDocument,
  TokenConverterDocument,
  TokenConvertersDocument,
} from "./.graphclient";

class SubgraphClient {
  urqlClient: UrqlClient;

  constructor(url: string) {
    this.urqlClient = createClient({
      url,
      requestPolicy: "network-only",
    });
  }

  async query(document: DocumentNode, args: Record<string, string[] | string>) {
    const result = await this.urqlClient.query(document, args).toPromise();
    return result;
  }

  async getTokenConverters() {
    const result = await this.query(TokenConvertersDocument, {});
    return result;
  }

  async getTokenConverter(address: string) {
    const result = await this.query(TokenConverterDocument, { id: address.toLowerCase() });
    return result;
  }

  async getTokenConverterByAssetOut(tokenAddressOut: string) {
    const result = await this.query(TokenConverterByAssetOutDocument, {
      tokenAddressOut: tokenAddressOut.toLowerCase(),
    });
    return result;
  }

  async getTokenConverterByAssetIn(tokenAddressIn: string) {
    const result = await this.query(TokenConverterByAssetInDocument, { tokenAddressIn: tokenAddressIn.toLowerCase() });
    return result;
  }

  async getTokenConverterByAssetInAndAssetOut(tokenAddressIn: string, tokenAddressOut: string) {
    const result = await this.query(TokenConverterByAssetInAndAssetOutDocument, {
      tokenAddressIn: tokenAddressIn.toLowerCase(),
      tokenAddressOut: tokenAddressOut.toLowerCase(),
    });
    return result;
  }
  
  async getTokenConverterByAssetInAndAssetOutAndConverter(tokenAddressIn: string, tokenAddressOut: string, tokenConverter: string) {
    const result = await this.query(TokenConverterByAssetInAndAssetOutAndConverterDocument, {
      tokenAddressIn: tokenAddressIn.toLowerCase(),
      tokenAddressOut: tokenAddressOut.toLowerCase(),
      tokenConverter: tokenConverter.toLowerCase()
    });
    return result;
  }
}

export default SubgraphClient;
