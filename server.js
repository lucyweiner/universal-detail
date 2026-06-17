require("dotenv").config();

const path = require("path");
const express = require("express");
const { google } = require("googleapis");
const ical = require("node-ical");
const nodemailer = require("nodemailer");

const app = express();
const port = Number(process.env.PORT || 8080);
const calendarId =
  process.env.GOOGLE_CALENDAR_ID ||
  "8a10096f46dc60cb39f41f55ac185b03f002d63240d316bb77c1d538037d5369@group.calendar.google.com";
const calendarFeedUrl =
  process.env.CALENDAR_FEED_URL ||
  process.env.PUBLIC_CALENDAR_FEED_URL ||
  "https://calendar.google.com/calendar/ical/8a10096f46dc60cb39f41f55ac185b03f002d63240d316bb77c1d538037d5369%40group.calendar.google.com/public/basic.ics";
const timeZone = process.env.TIME_ZONE || "America/Phoenix";
const appointmentDurationMinutes = Number(process.env.APPOINTMENT_DURATION_MINUTES || 270);
const slotIntervalMinutes = Number(process.env.SLOT_INTERVAL_MINUTES || 30);
const appointmentSummaryEmail = process.env.APPOINTMENT_SUMMARY_EMAIL || "Universaldetailservices@gmail.com";
const availabilityKeywords = (process.env.AVAILABILITY_KEYWORDS || "available for details,available,availability,open")
  .split(",")
  .map((keyword) => keyword.trim().toLowerCase())
  .filter(Boolean);

app.use(express.json());
app.use(express.static(__dirname));

const addMinutes = (date, minutes) => new Date(date.getTime() + minutes * 60000);

const rangesOverlap = (startA, endA, startB, endB) => startA < endB && startB < endA;

const formatAppointmentDateTime = (dateValue) =>
  new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
    timeZoneName: "short"
  }).format(new Date(dateValue));

const getEventStart = (event) => event.start?.dateTime || event.start?.date;
const getEventEnd = (event) => event.end?.dateTime || event.end?.date;

const isAvailabilityEvent = (event) => {
  const summary = (event.summary || "").toLowerCase();
  return availabilityKeywords.some((keyword) => summary.includes(keyword));
};

const hasGoogleCredentials = () =>
  Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS) ||
  Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY);

const hasEmailCredentials = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

const getMailTransporter = () => {
  if (!hasEmailCredentials()) {
    const error = new Error("Email credentials are not configured.");
    error.status = 503;
    throw error;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true" || Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

const sendAppointmentSummaryEmail = async ({ slot, name, phone, email, service, vehicle }) => {
  const transporter = getMailTransporter();
  const start = formatAppointmentDateTime(slot.start);
  const end = formatAppointmentDateTime(slot.end);
  const summaryLines = [
    "New Universal Detail appointment",
    "",
    `Appointment: ${start} - ${end}`,
    `Name: ${name}`,
    `Phone: ${phone}`,
    email ? `Email: ${email}` : "",
    service ? `Service: ${service}` : "",
    vehicle ? `Vehicle: ${vehicle}` : ""
  ].filter(Boolean);

  await transporter.sendMail({
    to: appointmentSummaryEmail,
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    replyTo: email || undefined,
    subject: `New appointment: ${name} - ${formatAppointmentDateTime(slot.start)}`,
    text: summaryLines.join("\n")
  });
};

const getCalendarClient = async () => {
  if (!hasGoogleCredentials()) {
    const error = new Error("Google Calendar credentials are not configured.");
    error.status = 503;
    throw error;
  }

  const auth = process.env.GOOGLE_APPLICATION_CREDENTIALS
    ? new google.auth.GoogleAuth({
        keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
        scopes: ["https://www.googleapis.com/auth/calendar"]
      })
    : new google.auth.GoogleAuth({
        credentials: {
          client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
        },
        scopes: ["https://www.googleapis.com/auth/calendar"]
      });

  return google.calendar({ version: "v3", auth: await auth.getClient() });
};

const listCalendarEvents = async (calendar, days = 45) => {
  const timeMin = new Date();
  const timeMax = addMinutes(timeMin, Number(days) * 24 * 60);
  const response = await calendar.events.list({
    calendarId,
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    showDeleted: false,
    maxResults: 2500
  });

  return response.data.items || [];
};

const parseIcsEvents = (calendarData, days = 45) => {
  const now = new Date();
  const rangeEnd = addMinutes(now, Number(days) * 24 * 60);

  return Object.values(calendarData)
    .filter((event) => event.type === "VEVENT" && event.start && event.end)
    .flatMap((event) => {
      const eventStart = new Date(event.start);
      const eventEnd = new Date(event.end);
      const durationMs = eventEnd.getTime() - eventStart.getTime();

      if (!event.rrule?.between) {
        return [
          {
            summary: event.summary || "",
            start: {
              dateTime: eventStart.toISOString()
            },
            end: {
              dateTime: eventEnd.toISOString()
            }
          }
        ];
      }

      return event.rrule.between(now, rangeEnd, true).map((occurrenceStart) => ({
        summary: event.summary || "",
        start: {
          dateTime: occurrenceStart.toISOString()
        },
        end: {
          dateTime: new Date(occurrenceStart.getTime() + durationMs).toISOString()
        }
      }));
    });
};

const listPublicFeedEvents = async (days = 45) => {
  const response = await fetch(calendarFeedUrl);
  const text = await response.text();

  if (!response.ok || !text.includes("BEGIN:VCALENDAR")) {
    const error = new Error("Online booking is being connected. Please text Noah to book for now.");
    error.status = 502;
    throw error;
  }

  return parseIcsEvents(ical.sync.parseICS(text), days);
};

const listAvailabilitySourceEvents = async (days = 45) => {
  try {
    return await listPublicFeedEvents(days);
  } catch (feedError) {
    if (!hasGoogleCredentials()) throw feedError;

    const calendar = await getCalendarClient();
    return listCalendarEvents(calendar, days);
  }
};

const buildSlots = (events) => {
  const availabilityEvents = events.filter(isAvailabilityEvent);
  const bookedEvents = events.filter((event) => !isAvailabilityEvent(event));
  const slots = [];

  availabilityEvents.forEach((event) => {
    const windowStart = new Date(getEventStart(event));
    const windowEnd = new Date(getEventEnd(event));

    for (
      let slotStart = new Date(windowStart);
      addMinutes(slotStart, appointmentDurationMinutes) <= windowEnd;
      slotStart = addMinutes(slotStart, slotIntervalMinutes)
    ) {
      const slotEnd = addMinutes(slotStart, appointmentDurationMinutes);
      const overlapsBooking = bookedEvents.some((bookedEvent) => {
        const bookedStart = new Date(getEventStart(bookedEvent));
        const bookedEnd = new Date(getEventEnd(bookedEvent));
        return rangesOverlap(slotStart, slotEnd, bookedStart, bookedEnd);
      });

      if (!overlapsBooking && slotStart > new Date()) {
        slots.push({
          start: slotStart.toISOString(),
          end: slotEnd.toISOString()
        });
      }
    }
  });

  return slots.sort((a, b) => new Date(a.start) - new Date(b.start));
};

app.get("/api/availability", async (request, response) => {
  try {
    const events = await listAvailabilitySourceEvents(request.query.days || 45);
    response.json({
      slots: buildSlots(events),
      durationMinutes: appointmentDurationMinutes,
      timeZone
    });
  } catch (error) {
    response.status(error.status || 500).json({
      error: error.message || "Could not load availability."
    });
  }
});

app.post("/api/book", async (request, response) => {
  try {
    const { slotStart, name, phone, email, service, vehicle } = request.body;

    if (!slotStart || !name || !phone) {
      response.status(400).json({ error: "Name, phone, and appointment time are required." });
      return;
    }

    const calendar = await getCalendarClient();
    const events = await listAvailabilitySourceEvents(45);
    const slots = buildSlots(events);
    const selectedSlot = slots.find((slot) => slot.start === slotStart);

    if (!selectedSlot) {
      response.status(409).json({ error: "That appointment time is no longer available." });
      return;
    }

    const calendarEvent = await calendar.events.insert({
      calendarId,
      sendUpdates: "none",
      requestBody: {
        summary: `Universal Detail Appointment - ${name}`,
        description: [
          `Name: ${name}`,
          `Phone: ${phone}`,
          email ? `Email: ${email}` : "",
          service ? `Service: ${service}` : "",
          vehicle ? `Vehicle: ${vehicle}` : ""
        ]
          .filter(Boolean)
          .join("\n"),
        start: {
          dateTime: selectedSlot.start,
          timeZone
        },
        end: {
          dateTime: selectedSlot.end,
          timeZone
        }
      }
    });

    let emailSent = true;
    let emailWarning = null;

    try {
      await sendAppointmentSummaryEmail({
        slot: selectedSlot,
        name,
        phone,
        email,
        service,
        vehicle
      });
    } catch (emailError) {
      emailSent = false;
      emailWarning = emailError.message || "Appointment was booked, but the email summary could not be sent.";
      console.warn("Appointment summary email failed:", emailWarning);
    }

    response.json({
      ok: true,
      eventId: calendarEvent.data.id,
      start: selectedSlot.start,
      end: selectedSlot.end,
      emailSent,
      emailWarning
    });
  } catch (error) {
    response.status(error.status || 500).json({
      error: error.message || "Could not book appointment."
    });
  }
});

app.get("*", (request, response) => {
  response.sendFile(path.join(__dirname, "index.html"));
});

app.listen(port, () => {
  console.log(`Universal Detail site running at http://localhost:${port}`);
});
