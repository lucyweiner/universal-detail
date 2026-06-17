const phoneNumber = "(480) 364-9446";
const reviewsStorageKey = "universalDetailReviews_v4";
const phoneHtml = `<span>Call or text for a quote</span><strong>${phoneNumber}</strong>`;
const appointmentLength = "4.5 hours";
const starterReviews = [
  {
    name: "Ari",
    rating: 5,
    review: "Super clean interior and the outside looked brand new. Easy to schedule and quick to respond."
  },
  {
    name: "Marcus",
    rating: 5,
    review: "Great attention to detail. Wheels, glass, seats, everything came out sharp."
  }
];

const reviewForm = document.querySelector("#reviewForm");
const reviewsList = document.querySelector("#reviewsList");
const quoteOutput = document.querySelector("#quoteOutput");
const quickQuote = document.querySelector("#quickQuote");
const revealButtons = document.querySelectorAll(".reveal-phone");
const quoteForm = document.querySelector("#quoteForm");
const quoteFormNote = document.querySelector("#quoteFormNote");
const bookingRequestForm = document.querySelector("#bookingRequestForm");
const bookingRequestNote = document.querySelector("#bookingRequestNote");
const slotsList = document.querySelector("#slotsList");
const slotsStatus = document.querySelector("#slotsStatus");
const refreshSlotsButton = document.querySelector("#refreshSlotsButton");

const getReviews = () => {
  const savedReviews = localStorage.getItem(reviewsStorageKey);
  return savedReviews ? JSON.parse(savedReviews) : starterReviews;
};

const saveReviews = (reviews) => {
  localStorage.setItem(reviewsStorageKey, JSON.stringify(reviews));
};

const quotePrices = {
  star: {
    label: "Star Package",
    car: 150,
    midsize: 175,
    fullsize: 215
  },
  galaxy: {
    label: "Galaxy Package",
    car: 250,
    midsize: 285,
    fullsize: 325
  }
};

const vehicleTypeLabels = {
  car: "Car/Sedan",
  midsize: "Mid-Size SUV / Mid-Size Truck",
  fullsize: "Full Size SUV/Truck"
};

const getQuoteSelection = () => {
  if (!quoteForm) return null;
  const formData = new FormData(quoteForm);
  const service = formData.get("service");
  const vehicleType = formData.get("vehicleType");
  const price = quotePrices[service]?.[vehicleType];

  if (!price) return null;

  return {
    price,
    serviceLabel: quotePrices[service].label,
    vehicleTypeLabel: vehicleTypeLabels[vehicleType]
  };
};

const readPhotoFile = (file) =>
  new Promise((resolve) => {
    if (!file) {
      resolve("");
      return;
    }

    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => resolve(""));
    reader.readAsDataURL(file);
  });

const escapeHtml = (value) =>
  value.replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };
    return entities[character];
  });

const renderReviews = () => {
  const reviews = getReviews();

  if (!reviews.length) {
    reviewsList.innerHTML = `<div class="empty-reviews">No reviews yet. Be the first to post one.</div>`;
    return;
  }

  reviewsList.innerHTML = reviews
    .map((item) => {
      const rating = Number(item.rating);
      return `
        <article class="review-card">
          <header>
            <strong>${escapeHtml(item.name)}</strong>
            <span class="stars" aria-label="${rating} out of 5 stars">${"★".repeat(rating)}${"☆".repeat(5 - rating)}</span>
          </header>
          <p>${escapeHtml(item.review)}</p>
          ${
            item.photo
              ? `<img class="review-photo" src="${item.photo}" alt="Photo shared with ${escapeHtml(item.name)}'s review">`
              : ""
          }
        </article>
      `;
    })
    .join("");
};

revealButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (quoteOutput) quoteOutput.innerHTML = phoneHtml;
    if (quickQuote) {
      quickQuote.hidden = false;
      quickQuote.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  });
});

if (reviewForm) {
  reviewForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(reviewForm);
    const photoFile = formData.get("photo");
    const review = {
      name: formData.get("name").trim(),
      rating: Number(formData.get("rating")),
      review: formData.get("review").trim(),
      photo: await readPhotoFile(photoFile)
    };

    if (!review.name || !review.review) return;

    const reviews = [review, ...getReviews()];
    saveReviews(reviews);
    reviewForm.reset();
    renderReviews();
  });
}

if (reviewsList) renderReviews();

if (quoteForm) {
  quoteForm.addEventListener("change", () => {
    if (quoteFormNote) quoteFormNote.textContent = "";
  });

  quoteForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(quoteForm);
    const quote = getQuoteSelection();

    if (!quote) {
      if (quoteFormNote) quoteFormNote.textContent = "Please choose a service and vehicle type.";
      return;
    }

    if (quoteFormNote) quoteFormNote.textContent = "Getting your quote...";

    try {
      const response = await fetch("/api/quote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: formData.get("name"),
          email: formData.get("email"),
          phone: formData.get("phone"),
          service: formData.get("service"),
          vehicleType: formData.get("vehicleType")
        })
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Could not send quote request.");

      if (quoteFormNote) {
        quoteFormNote.textContent = `Your estimated quote is $${data.quote.price} for the ${data.quote.serviceLabel} on a ${data.quote.vehicleTypeLabel}.`;
      }
    } catch (error) {
      if (quoteFormNote) {
        quoteFormNote.textContent = `Your estimated quote is $${quote.price} for the ${quote.serviceLabel} on a ${quote.vehicleTypeLabel}.`;
      }
    }
  });
}

const formatSlotDate = (date) =>
  new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric"
  }).format(date);

const formatSlotTime = (date) =>
  new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Phoenix"
  }).format(date);

const bookingTimeZone = "America/Phoenix";
let bookingSlots = [];
let selectedDateKey = "";
let visibleBookingMonth = null;

const getDateParts = (date) =>
  new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: bookingTimeZone,
    year: "numeric"
  })
    .formatToParts(date)
    .reduce((parts, part) => {
      if (part.type !== "literal") parts[part.type] = part.value;
      return parts;
    }, {});

const getSlotDateKey = (slot) => {
  const parts = getDateParts(new Date(slot.start));
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const getReadableDate = (date) =>
  new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: bookingTimeZone
  }).format(date);

const getMonthLabel = (date) =>
  new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric"
  }).format(date);

const getDateKey = (year, month, day) =>
  `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

const getSlotsForDate = (dateKey) => bookingSlots.filter((slot) => getSlotDateKey(slot) === dateKey);

const selectSlot = (slot) => {
  if (!bookingRequestForm) return;

  bookingRequestForm.elements.slotStart.value = slot.start;
  if (bookingRequestNote) bookingRequestNote.textContent = "";
  renderBookingCalendar();
};

const renderBookingCalendar = () => {
  if (!slotsList || !slotsStatus) return;

  if (!bookingSlots.length) {
    slotsList.innerHTML = "";
    slotsStatus.textContent = "No appointment slots are available right now. Check back soon or text Noah.";
    return;
  }

  const availableDateKeys = new Set(bookingSlots.map(getSlotDateKey));
  const selectedSlots = getSlotsForDate(selectedDateKey);
  const year = visibleBookingMonth.getFullYear();
  const month = visibleBookingMonth.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const blankDays = Array.from({ length: firstWeekday }, () => `<span class="calendar-empty"></span>`).join("");
  const dayButtons = Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    const dateKey = getDateKey(year, month, day);
    const hasSlots = availableDateKeys.has(dateKey);
    const isSelected = dateKey === selectedDateKey;
    return `
      <button class="calendar-day${hasSlots ? " has-slots" : ""}${isSelected ? " selected" : ""}" type="button" data-date-key="${dateKey}" ${hasSlots ? "" : "disabled"}>
        <span>${day}</span>
        ${hasSlots ? "<small></small>" : ""}
      </button>
    `;
  }).join("");
  const selectedDate = selectedSlots.length ? new Date(selectedSlots[0].start) : null;

  slotsStatus.textContent = `${bookingSlots.length} appointment slot${bookingSlots.length === 1 ? "" : "s"} available.`;
  slotsList.innerHTML = `
    <div class="booking-calendar">
      <div class="calendar-pane">
        <div class="calendar-top">
          <button class="month-nav" type="button" data-month-step="-1" aria-label="Previous month">
            <i data-lucide="chevron-left" aria-hidden="true"></i>
          </button>
          <strong>${getMonthLabel(visibleBookingMonth)}</strong>
          <button class="month-nav" type="button" data-month-step="1" aria-label="Next month">
            <i data-lucide="chevron-right" aria-hidden="true"></i>
          </button>
        </div>
        <div class="calendar-weekdays" aria-hidden="true">
          <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
        </div>
        <div class="calendar-days">${blankDays}${dayButtons}</div>
      </div>
      <div class="time-pane">
        <h3>${selectedDate ? getReadableDate(selectedDate) : "Select a date"}</h3>
        <div class="time-list">
          ${
            selectedSlots.length
              ? selectedSlots
                  .map((slot) => {
                    const start = new Date(slot.start);
                    const isSelected = bookingRequestForm?.elements.slotStart.value === slot.start;
                    return `
                      <button class="time-card${isSelected ? " selected" : ""}" type="button" data-slot-start="${slot.start}">
                        <i data-lucide="calendar-clock" aria-hidden="true"></i>
                        <span>${formatSlotTime(start)} MST</span>
                        <strong>Available</strong>
                      </button>
                    `;
                  })
                  .join("")
              : `<p class="form-note">No times available for this date.</p>`
          }
        </div>
      </div>
    </div>
  `;

  slotsList.querySelectorAll(".month-nav").forEach((button) => {
    button.addEventListener("click", () => {
      visibleBookingMonth = new Date(year, month + Number(button.dataset.monthStep), 1);
      renderBookingCalendar();
    });
  });

  slotsList.querySelectorAll(".calendar-day.has-slots").forEach((button) => {
    button.addEventListener("click", () => {
      selectedDateKey = button.dataset.dateKey;
      renderBookingCalendar();
    });
  });

  slotsList.querySelectorAll(".time-card").forEach((button) => {
    button.addEventListener("click", () => {
      const slot = bookingSlots.find((item) => item.start === button.dataset.slotStart);
      selectSlot(slot);
    });
  });

  if (window.lucide) window.lucide.createIcons();
};

const renderSlots = (slots) => {
  if (!slotsList || !slotsStatus) return;

  bookingSlots = slots;
  if (!bookingSlots.length) {
    renderBookingCalendar();
    return;
  }

  selectedDateKey = getSlotDateKey(bookingSlots[0]);
  visibleBookingMonth = new Date(new Date(bookingSlots[0].start).getFullYear(), new Date(bookingSlots[0].start).getMonth(), 1);
  renderBookingCalendar();
};

const loadSlots = async () => {
  if (!slotsList || !slotsStatus) return;

  slotsStatus.textContent = "Loading availability...";
  slotsList.innerHTML = "";

  try {
    const response = await fetch("/api/availability");
    const data = await response.json();

    if (!response.ok) throw new Error(data.error || "Could not load availability.");
    renderSlots(data.slots || []);
  } catch (error) {
    slotsStatus.textContent = error.message;
  }
};

if (slotsList) loadSlots();

if (refreshSlotsButton) {
  refreshSlotsButton.addEventListener("click", loadSlots);
}

if (bookingRequestForm) {
  bookingRequestForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(bookingRequestForm);

    if (!formData.get("slotStart")) {
      if (bookingRequestNote) bookingRequestNote.textContent = "Please choose an available appointment time.";
      return;
    }

    if (bookingRequestNote) bookingRequestNote.textContent = "Booking appointment...";

    try {
      const response = await fetch("/api/book", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          slotStart: formData.get("slotStart"),
          name: formData.get("name"),
          phone: formData.get("phone"),
          email: formData.get("email"),
          service: formData.get("service"),
          vehicle: formData.get("vehicle")
        })
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Could not book appointment.");

      if (bookingRequestNote) {
        bookingRequestNote.textContent = `Booked. Your ${appointmentLength} appointment has been added to the calendar.`;
      }
      bookingRequestForm.reset();
      await loadSlots();
    } catch (error) {
      if (bookingRequestNote) bookingRequestNote.textContent = error.message;
    }
  });
}

if (window.lucide) {
  window.lucide.createIcons();
}
