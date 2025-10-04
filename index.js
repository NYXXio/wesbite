import express from "express";
import { google } from "googleapis";
import { GoogleAuth } from "google-auth-library";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors()); // Allow frontend requests

// Health check route
app.get("/", (req, res) => {
  res.json({ message: "Backend is running ✅" });
});

// Google Auth setup
const auth = new GoogleAuth({
  keyFile: "service-account.json", // service account key file
  scopes: ["https://www.googleapis.com/auth/calendar.events"], // correct scope
});

const calendar = google.calendar({ version: "v3", auth });

// Reservation endpoint
app.post("/api/reservations", async (req, res) => {
  const { name, email, phone, startDateTime, partySize, notes } = req.body;

  if (!startDateTime) {
    return res.status(400).json({ error: "Missing startDateTime" });
  }

  try {
    const start = new Date(startDateTime);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000); // 2 hours

    // Check for conflicts
    const events = await calendar.events.list({
      calendarId: process.env.CALENDAR_ID,
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
    });

    if (events.data.items.length > 0) {
      return res.status(409).json({ error: "Time slot not available" });
    }

    // Create event
    const event = {
      summary: `Reservation: ${name} (${partySize || "N/A"} guests)`,
      description: `Email: ${email}\nPhone: ${phone}\nNotes: ${notes || "None"}`,
      start: { dateTime: start.toISOString(), timeZone: "Europe/Riga" },
      end: { dateTime: end.toISOString(), timeZone: "Europe/Riga" },
      attendees: email ? [{ email }] : [],
    };

    await calendar.events.insert({
      calendarId: process.env.CALENDAR_ID,
      requestBody: event,
    });

    res.json({ success: true, message: "Reservation added to calendar" });
  } catch (err) {
    console.error("Error creating reservation:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
