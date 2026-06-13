const phoneNumber = "(480) 364-9446";
const reviewsStorageKey = "universalDetailReviews_v4";
const phoneHtml = `<span>Call or text for a quote</span><strong>${phoneNumber}</strong>`;
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
    quoteOutput.innerHTML = phoneHtml;
    quickQuote.hidden = false;
    quickQuote.scrollIntoView({ block: "nearest", behavior: "smooth" });
  });
});

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

renderReviews();

if (window.lucide) {
  window.lucide.createIcons();
}
