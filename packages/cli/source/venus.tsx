#!/usr/bin/env node
import Pastel from "pastel";
import "./utils/env.js";

const app = new Pastel({
  name: 'Venus CLI',
  importMeta: import.meta,
});

await app.run();
