import { DocumentNode } from "graphql";
import { Client as UrqlClient, createClient } from "urql/core";

import { TokenConvertersDocument } from "./.graphclient";

class SubgraphClient {
  urqlClient: UrqlClient;

  constructor(url: string) {
    this.urqlClient = createClient({
      url,
      requestPolicy: "network-only",
    });
  }

  async query(document: DocumentNode, args: Record<string, string>) {
    const result = await this.urqlClient.query(document, args).toPromise();
    if (result.error) {
      console.error(result.error);
    }
    return result;
  }

  async getTokenConverters() {
    const result = await this.query(TokenConvertersDocument, {});
    return result;
  }
}

export default new SubgraphClient(
  "https://api.thegraph.com/subgraphs/name/venusprotocol/venus-protocol-reserve-chapel",
);
