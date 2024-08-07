#!/usr/bin/env node
import Pastel from "pastel";
import "./utils/env.js";

const app = new Pastel({
  importMeta: import.meta,
  description: "CLI for interacting with the Venus Protocol and perform maintenance tasks.",
});

await app.run();
