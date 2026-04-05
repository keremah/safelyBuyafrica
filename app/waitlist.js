// api/waitlist.js — Vercel serverless function

const https = require("https");

const SHEET_URL = process.env.GOOGLE_SHEET_WEBHOOK_URL ||
  "https://script.google.com/macros/s/AKfycbziYF5uAeD1Ewlhb556ZDjACjiWviKNnKzpGCbivQuzerXX3BVv3UH2dW6e6oYipfe7_g/exec";

function isValidEmail(e) {
  if (!e) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e).trim());
}

function isValidWhatsApp(n) {
  if (!n) return false;
  return String(n).replace(/\D/g, "").length >= 7;
}

function sendToSheet(entry) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 8000);
    try {
      const body = JSON.stringify(entry);
      const u = new URL(SHEET_URL);
      const options = {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      };
      const req = https.request(options, (res) => {
        res.on("data", () => {});
        res.on("end", () => { clearTimeout(timer); resolve(true); });
      });
      req.on("error", () => { clearTimeout(timer); resolve(null); });
      req.write(body);
      req.end();
    } catch (err) {
      clearTimeout(timer);
      resolve(null);
    }
  });
}

let signupCount = 0;

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method === "GET") {
    return res.status(200).json({ count: signupCount });
  }

  if (req.method === "POST") {
    // Parse body safely
    let body = {};
    try {
      if (typeof req.body === "string") {
        body = JSON.parse(req.body);
      } else if (req.body && typeof req.body === "object") {
        body = req.body;
      }
    } catch (e) {
      body = {};
    }

    const email    = String(body.email    || "").trim().toLowerCase();
    const name     = String(body.name     || "").trim().slice(0, 100);
    const role     = String(body.role     || "").trim().slice(0, 50);
    const country  = String(body.country  || "").trim().slice(0, 60);
    const whatsapp = String(body.whatsapp || "").trim().slice(0, 20);

    const hasEmail    = isValidEmail(email);
    const hasWhatsApp = isValidWhatsApp(whatsapp);

    if (!hasEmail && !hasWhatsApp) {
      return res.status(400).json({
        success: false,
        error: "Please provide a valid email address or WhatsApp number."
      });
    }

    const entry = {
      name,
      email:    email    || "",
      whatsapp: whatsapp || "",
      role:     role     || "",
      country:  country  || "",
      joinedAt: new Date().toISOString(),
    };

    // Send to sheet — don't block on failure
    await sendToSheet(entry);
    signupCount++;

    return res.status(200).json({
      success: true,
      message: "You are on the list! We will reach out before launch.",
      count: signupCount,
    });
  }

  return res.status(405).json({ success: false, error: "Method not allowed" });
};
