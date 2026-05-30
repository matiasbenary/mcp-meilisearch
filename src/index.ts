#!/usr/bin/env node

import express from "express";
import cors from "cors";
import { faucetHandler } from "./faucet.js";

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

app.get("/api/ping", (_req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

app.post("/api/faucet", faucetHandler);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Service started on port ${PORT}`);
});
