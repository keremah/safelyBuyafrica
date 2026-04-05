// api/waitlist.js — Vercel serverless function
// Saves signups to Google Sheet webhook

const https = require("https");

const SHEET_URL = process.env.GOOGLE_SHEET_WEBHOOK_URL || "https://script.google.com/macros/s/AKfycbziYF5uAeD1Ewlhb556ZDjACjiWviKNnKzpGCbivQuzerXX3BVv3UH2dW6e6oYipfe7_g/exec";

function isValidEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e).trim().toLowerCase());
}

function isValidWhatsApp(n) {
  if (!n) return true; // optional field
  const digits = String(n).replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

function sendToSheet(entry) {
  return new Promise((resolve) => {
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
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
      });
      req.on("error", (e) => { console.error("Sheet error:", e.message); resolve(null); });
      req.write(body);
      req.end();
    } catch (e) {
      console.error("Sheet exception:", e.message);
      resolve(null);
    }
  });
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method === "GET") {
    return res.status(200).json({ count: 0 });
  }

  if (req.method === "POST") {
    let body = req.body;

    // Handle cases where body comes in as string or is missing
    if (!body) {
      try {
        body = JSON.parse(req.body || "{}");
      } catch {
        body = {};
      }
    }
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch { body = {}; }
    }

    const email     = String(body.email     || "").trim().toLowerCase();
    const name      = String(body.name      || "").trim().slice(0, 100);
    const role      = String(body.role      || "").trim().slice(0, 50);
    const country   = String(body.country   || "").trim().slice(0, 60);
    const whatsapp  = String(body.whatsapp  || "").trim().slice(0, 20);

    // Validate — at least email OR whatsapp required
    const hasEmail    = email && isValidEmail(email);
    const hasWhatsApp = whatsapp && isValidWhatsApp(whatsapp);

    if (!hasEmail && !hasWhatsApp) {
      return res.status(400).json({
        error: "Please provide a valid email address or WhatsApp number."
      });
    }

    const entry = {
      email:     email     || "",
      name:      name      || "",
      role:      role      || "",
      country:   country   || "",
      whatsapp:  whatsapp  || "",
      joinedAt:  new Date().toISOString(),
    };

    await sendToSheet(entry);

    return res.status(200).json({
      success: true,
      message: "You are on the list! We will reach out before launch.",
      count: 1,
    });
  }

  return res.status(405).json({ error: "Method not allowed" });
};
