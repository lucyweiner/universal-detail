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
const selectedSlotText = document.querySelector("#selectedSlotText");
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
  quoteForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(quoteForm);
    const services = formData.getAll("service");

    if (!services.length) {
      if (quoteFormNote) quoteFormNote.textContent = "Please choose at least one service.";
      return;
    }

    const message = [
      "Hi Noah, I would like a Universal Detail quote.",
      `Name: ${formData.get("name")}`,
      `Email: ${formData.get("email")}`,
      `Phone: ${formData.get("phone")}`,
      `Service: ${services.join(", ")}`,
      `Vehicle: ${formData.get("message") || "No vehicle details provided"}`
    ].join("\n");

    if (quoteFormNote) quoteFormNote.textContent = "Opening a text message with your quote details.";
    window.location.href = `sms:+14803649446?&body=${encodeURIComponent(message)}`;
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
    minute: "2-digit"
  }).format(date);

const selectSlot = (slot) => {
  if (!bookingRequestForm || !selectedSlotText) return;
  const start = new Date(slot.start);
  const end = new Date(slot.end);

  bookingRequestForm.hidden = false;
  bookingRequestForm.elements.slotStart.value = slot.start;
  selectedSlotText.textContent = `${formatSlotDate(start)} from ${formatSlotTime(start)} to ${formatSlotTime(end)}`;
  if (bookingRequestNote) bookingRequestNote.textContent = "";
  bookingRequestForm.scrollIntoView({ block: "nearest", behavior: "smooth" });
};

const renderSlots = (slots) => {
  if (!slotsList || !slotsStatus) return;

  if (!slots.length) {
    slotsList.innerHTML = "";
    slotsStatus.textContent = "No appointment slots are available right now. Check back soon or text Noah.";
    return;
  }

  const groupedSlots = slots.reduce((groups, slot) => {
    const date = formatSlotDate(new Date(slot.start));
    groups[date] = groups[date] || [];
    groups[date].push(slot);
    return groups;
  }, {});

  slotsStatus.textContent = `${slots.length} appointment slot${slots.length === 1 ? "" : "s"} available.`;
  slotsList.innerHTML = Object.entries(groupedSlots)
    .map(
      ([date, dateSlots]) => `
        <section class="slot-day">
          <h3>${date}</h3>
          <div class="slot-buttons">
            ${dateSlots
              .map((slot) => {
                const start = new Date(slot.start);
                const end = new Date(slot.end);
                return `<button class="slot-button" type="button" data-slot-start="${slot.start}">${formatSlotTime(start)}-${formatSlotTime(end)}</button>`;
              })
              .join("")}
          </div>
        </section>
      `
    )
    .join("");

  slotsList.querySelectorAll(".slot-button").forEach((button) => {
    button.addEventListener("click", () => {
      const slot = slots.find((item) => item.start === button.dataset.slotStart);
      selectSlot(slot);
    });
  });
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
      bookingRequestForm.hidden = true;
      await loadSlots();
    } catch (error) {
      if (bookingRequestNote) bookingRequestNote.textContent = error.message;
    }
  });
}

if (window.lucide) {
  window.lucide.createIcons();
}
