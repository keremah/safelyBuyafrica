// api/waitlist.js — Vercel serverless function
// Uses JSONBin.io for persistent count across all visitors

const https = require("https");

const SHEET_URL = process.env.GOOGLE_SHEET_WEBHOOK_URL ||
  "https://script.google.com/macros/s/AKfycbzzxI_MyKkLKdYJRHAzHNI46kezKOuEPIYvmAl6l0sH44iR7uA5LQcD6odBJpF7OQctJA/exec";

const BIN_ID     = process.env.JSONBIN_ID     || "69d3de02856a68218905296f";
const BIN_KEY    = process.env.JSONBIN_KEY     || "$2a$10$U36mKod7.UO4LNrj1.9SE.5LF8QDUgdTcGrWAUfero6Ta2DoDQdw6";
const BIN_URL    = "api.jsonbin.io";
const BIN_PATH   = `/v3/b/${BIN_ID}`;

function request(options, body) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 8000);
    try {
      const req = https.request(options, (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => {
          clearTimeout(timer);
          try { resolve(JSON.parse(raw)); } catch { resolve(null); }
        });
      });
      req.on("error", () => { clearTimeout(timer); resolve(null); });
      if (body) req.write(body);
      req.end();
    } catch { clearTimeout(timer); resolve(null); }
  });
}

async function getCount() {
  const result = await request({
    hostname: BIN_URL,
    path: BIN_PATH,
    method: "GET",
    headers: { "X-Master-Key": BIN_KEY },
  });
  return (result && result.record && typeof result.record.count !== "undefined")
    ? Number(result.record.count) : 0;
}

async function setCount(count) {
  const body = JSON.stringify({ count });
  await request({
    hostname: BIN_URL,
    path: BIN_PATH,
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
      "X-Master-Key": BIN_KEY,
    },
  }, body);
}

function sendToSheet(entry) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 8000);
    try {
      const body = JSON.stringify(entry);
      const u = new URL(SHEET_URL);
      const req = https.request({
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      }, (res) => {
        res.on("data", () => {});
        res.on("end", () => { clearTimeout(timer); resolve(true); });
      });
      req.on("error", () => { clearTimeout(timer); resolve(null); });
      req.write(body);
      req.end();
    } catch { clearTimeout(timer); resolve(null); }
  });
}

function isValidWhatsApp(n) {
  if (!n) return false;
  return String(n).replace(/\D/g, "").length >= 7;
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") return res.status(200).end();

  // GET — return persistent count from JSONBin
  if (req.method === "GET") {
    const count = await getCount();
    return res.status(200).json({ count });
  }

  // POST — save signup
  if (req.method === "POST") {
    let body = {};
    try {
      if (typeof req.body === "string") body = JSON.parse(req.body);
      else if (req.body && typeof req.body === "object") body = req.body;
    } catch { body = {}; }

    const whatsapp = String(body.whatsapp || "").trim().slice(0, 20);

    if (!isValidWhatsApp(whatsapp)) {
      return res.status(400).json({
        success: false,
        error: "Please provide a valid WhatsApp number."
      });
    }

    const entry = {
      whatsapp,
      joinedAt: new Date().toISOString(),
    };

    // Save to sheet and update count in parallel
    const currentCount = await getCount();
    const newCount = currentCount + 1;

    await Promise.all([
      sendToSheet(entry),
      setCount(newCount),
    ]);

    return res.status(200).json({
      success: true,
      message: "You are on the list! We will reach out before launch.",
      count: newCount,
    });
  }

  return res.status(405).json({ success: false, error: "Method not allowed" });
};
