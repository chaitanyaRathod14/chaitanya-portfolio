require("dotenv").config();

const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");

const app = express();

app.use(cors());
app.use(express.json());

// Check environment variables
console.log("EMAIL_USER:", process.env.EMAIL_USER);
console.log("EMAIL_TO:", process.env.EMAIL_TO);
console.log(
  "EMAIL_PASS:",
  process.env.EMAIL_PASS ? "Loaded ✅" : "Missing ❌"
);

// Rate limiting
const rateLimit = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;

  const entry = rateLimit.get(ip) || {
    count: 0,
    start: now,
  };

  if (now - entry.start > windowMs) {
    entry.count = 0;
    entry.start = now;
  }

  entry.count++;

  rateLimit.set(ip, entry);

  return entry.count > 5;
}

// Gmail transporter
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // STARTTLS
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },

  // REMOVE THIS BEFORE DEPLOYMENT
  tls: {
    rejectUnauthorized: false,
  },
});

// Verify SMTP connection
transporter.verify((err, success) => {
  if (err) {
    console.error("SMTP Verify Error:");
    console.error(err);
  } else {
    console.log("✅ Gmail SMTP Connected");
  }
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.post("/api/contact", async (req, res) => {
  const ip =
    req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  if (isRateLimited(ip)) {
    return res.status(429).json({
      success: false,
      error: "Too many requests. Try again later.",
    });
  }

  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({
      success: false,
      error: "All fields are required.",
    });
  }

  try {
    const info = await transporter.sendMail({
      from: `"Portfolio Contact Form" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_TO,
      replyTo: email,
      subject: `New Portfolio Message from ${name}`,
      text: `
Name: ${name}
Email: ${email}

Message:
${message}
      `,
      html: `
        <h2>New Portfolio Contact</h2>

        <p><b>Name:</b> ${name}</p>
        <p><b>Email:</b> ${email}</p>

        <hr>

        <p>${message}</p>
      `,
    });

    console.log("Email sent:");
    console.log(info);

    res.json({
      success: true,
      message: "Email sent successfully",
    });
  } catch (err) {
    console.error("SEND MAIL ERROR:");
    console.error(err);

    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

const PORT = process.env.PORT || 5000;

// app.listen(PORT, () => {
//   console.log(`Server running on http://localhost:${PORT}`);
// });
module.exports = app;