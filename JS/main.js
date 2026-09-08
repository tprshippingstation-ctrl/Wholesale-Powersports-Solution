const bikesContainer = document.getElementById("bikes-container");
const bikeTemplate = document.getElementById("bike-template");
const addBikeBtn = document.getElementById("add-bike");
const form = document.getElementById("intake-form");
const statusEl = document.getElementById("form-status");
const successBanner = document.getElementById("submission-success");
const nextField = document.getElementById("form-next");
const subjectField = document.getElementById("form-subject");

const MAX_PHOTOS_PER_BIKE = 4;
const MAX_MB_PER_BIKE = 6; // stays well under FormSubmit's 10MB total-per-submission cap
const MAX_DIMENSION = 1600; // px, longest side, after compression
const JPEG_QUALITY = 0.75;

// ---------------------------------------------------------------
// Add / remove motorcycle rows, each with its own photo field
// ---------------------------------------------------------------
function renumberBikes() {
  const panels = bikesContainer.querySelectorAll(".bike-panel");
  panels.forEach((panel, i) => {
    panel.querySelector(".bike-index").textContent = i + 1;
    const removeBtn = panel.querySelector(".remove-bike");
    removeBtn.style.display = panels.length > 1 ? "block" : "none";
  });
}

function addBike() {
  const clone = bikeTemplate.content.cloneNode(true);
  const panel = clone.querySelector(".bike-panel");

  panel.querySelector(".remove-bike").addEventListener("click", (e) => {
    e.target.closest(".bike-panel").remove();
    renumberBikes();
  });

  const photoInput = panel.querySelector(".bike-photos");
  const photoHint = panel.querySelector(".photo-hint");
  photoInput.addEventListener("change", () => handlePhotoChange(panel, photoInput, photoHint));

  bikesContainer.appendChild(clone);
  renumberBikes();
}

addBikeBtn.addEventListener("click", addBike);
addBike(); // start with one motorcycle block on the page

// ---------------------------------------------------------------
// Photo compression: resize + re-encode as JPEG in the browser so a
// handful of full-size phone photos still fit comfortably under
// FormSubmit's 10MB-per-submission cap. Runs per bike, and renames
// files to include the bike number so attachments are easy to sort
// once they land in your inbox.
// ---------------------------------------------------------------
function compressImage(file, label) {
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      let { width, height } = img;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const scale = MAX_DIMENSION / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(objectUrl);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file); // fall back to original if canvas export fails
            return;
          }
          resolve(new File([blob], `${label}.jpg`, { type: "image/jpeg" }));
        },
        "image/jpeg",
        JPEG_QUALITY
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file); // couldn't decode it (e.g. an unsupported HEIC file) — pass through as-is
    };

    img.src = objectUrl;
  });
}

async function handlePhotoChange(panel, photoInput, photoHint) {
  const files = Array.from(photoInput.files || []);
  const bikeNumber = panel.querySelector(".bike-index").textContent;

  if (files.length === 0) {
    photoHint.textContent = "A few clear shots of this bike help us quote faster.";
    photoHint.dataset.state = "";
    return;
  }

  if (files.length > MAX_PHOTOS_PER_BIKE) {
    photoHint.textContent = `Please choose ${MAX_PHOTOS_PER_BIKE} photos or fewer for this bike (you selected ${files.length}).`;
    photoHint.dataset.state = "error";
    photoInput.value = "";
    return;
  }

  photoHint.textContent = `Preparing ${files.length} photo${files.length > 1 ? "s" : ""}...`;
  photoHint.dataset.state = "";

  const compressed = await Promise.all(
    files.map((file, i) => compressImage(file, `Bike-${bikeNumber}-photo-${i + 1}`))
  );
  const totalMb = compressed.reduce((sum, f) => sum + f.size, 0) / (1024 * 1024);

  if (totalMb > MAX_MB_PER_BIKE) {
    photoHint.textContent = `Even compressed, these photos add up to about ${totalMb.toFixed(1)}MB — please try fewer images for this bike.`;
    photoHint.dataset.state = "error";
    photoInput.value = "";
    return;
  }

  // Swap the input's files for the compressed, renamed versions so the
  // real form submission sends these instead of the originals.
  const dataTransfer = new DataTransfer();
  compressed.forEach((f) => dataTransfer.items.add(f));
  photoInput.files = dataTransfer.files;

  photoHint.textContent = `${compressed.length} photo${compressed.length > 1 ? "s" : ""} ready (about ${totalMb.toFixed(1)}MB after compression).`;
  photoHint.dataset.state = "ok";
}

// ---------------------------------------------------------------
// Submission: this is a real form POST to FormSubmit (not AJAX),
// because file attachments need a plain multipart/form-data submit.
// We point "_next" back to this page with a query flag, then show
// a banner if that flag is present when the page loads.
// ---------------------------------------------------------------
if (nextField) {
  const cleanUrl = window.location.origin + window.location.pathname;
  nextField.value = `${cleanUrl}?submitted=true`;
}

function setStatus(message, state) {
  statusEl.textContent = message;
  statusEl.dataset.state = state || "";
}

form.addEventListener("submit", (e) => {
  if (!form.checkValidity()) {
    e.preventDefault();
    form.reportValidity();
    return;
  }

  const bikeCount = bikesContainer.querySelectorAll(".bike-panel").length;
  if (subjectField) {
    subjectField.value = `New wholesale submission: ${bikeCount} motorcycle${bikeCount > 1 ? "s" : ""}`;
  }
  setStatus("Sending...", "");
  // No preventDefault here — let the browser submit the form normally
  // so FormSubmit receives the file attachments.
});

// ---------------------------------------------------------------
// Show a success banner if we've just been redirected back here
// ---------------------------------------------------------------
const params = new URLSearchParams(window.location.search);
if (params.get("submitted") === "true" && successBanner) {
  successBanner.hidden = false;
  successBanner.scrollIntoView({ behavior: "smooth", block: "center" });
  const cleanUrl = window.location.origin + window.location.pathname;
  window.history.replaceState({}, document.title, cleanUrl);
}
