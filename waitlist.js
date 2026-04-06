// api/waitlist.js — Vercel serverless function
// Saves signups to Google Sheet and fetches real count

const https = require("https");

const SHEET_URL = process.env.GOOGLE_SHEET_WEBHOOK_URL ||
  "https://script.google.com/macros/s/AKfycbzzxI_MyKkLKdYJRHAzHNI46kezKOuEPIYvmAl6l0sH44iR7uA5LQcD6odBJpF7OQctJA/exec";

function isValidWhatsApp(n) {
  if (!n) return false;
  return String(n).replace(/\D/g, "").length >= 7;
}

function fetchSheet(method, data) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 9000);
    try {
      const isPost = method === "POST";
      const body = isPost ? JSON.stringify(data) : null;
      const url = new URL(SHEET_URL);
      const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: method,
        headers: isPost ? {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        } : {},
      };
      const req = https.request(options, (res) => {
        let raw = "";
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () => {
          clearTimeout(timer);
          try { resolve(JSON.parse(raw)); }
          catch { resolve(null); }
        });
      });
      req.on("error", () => { clearTimeout(timer); resolve(null); });
      if (isPost && body) req.write(body);
      req.end();
    } catch (err) {
      clearTimeout(timer);
      resolve(null);
    }
  });
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // GET — fetch real count from Google Sheet
  if (req.method === "GET") {
    const result = await fetchSheet("GET", null);
    const count = (result && typeof result.count !== "undefined") ? result.count : 0;
    return res.status(200).json({ count });
  }

  // POST — save signup
  if (req.method === "POST") {
    let body = {};
    try {
      if (typeof req.body === "string") {
        body = JSON.parse(req.body);
      } else if (req.body && typeof req.body === "object") {
        body = req.body;
      }
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

    const result = await fetchSheet("POST", entry);
    const count = (result && typeof result.count !== "undefined") ? result.count : 0;

    return res.status(200).json({
      success: true,
      message: "You are on the list! We will reach out before launch.",
      count,
    });
  }

  return res.status(405).json({ success: false, error: "Method not allowed" });
};
