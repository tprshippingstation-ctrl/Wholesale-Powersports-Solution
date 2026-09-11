const form = document.getElementById("quote-form");
const step1 = document.querySelector('.quote-step[data-step="1"]');
const step2 = document.querySelector('.quote-step[data-step="2"]');
const progressStep1 = document.querySelector('.progress-step[data-step="1"]');
const progressStep2 = document.querySelector('.progress-step[data-step="2"]');
const toStep2Btn = document.getElementById("to-step-2");
const backToStep1Btn = document.getElementById("back-to-step-1");

const bikesContainer = document.getElementById("bikes-container");
const bikeTemplate = document.getElementById("bike-template");
const addBikeBtn = document.getElementById("add-bike");

const statusEl = document.getElementById("form-status");
const successBanner = document.getElementById("submission-success");
const nextField = document.getElementById("form-next");
const subjectField = document.getElementById("form-subject");

const CONTACT_STORAGE_KEY = "wps_contact_info";
const MAX_PHOTOS_PER_BIKE = 4;
const MAX_MB_PER_BIKE = 6;
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.75;

// ---------------------------------------------------------------
// Step navigation
// ---------------------------------------------------------------
function goToStep(stepNumber) {
  if (stepNumber === 1) {
    step1.hidden = false;
    step2.hidden = true;
    progressStep1.classList.add("active");
    progressStep1.classList.remove("done");
    progressStep2.classList.remove("active", "done");
  } else {
    step1.hidden = true;
    step2.hidden = false;
    progressStep1.classList.remove("active");
    progressStep1.classList.add("done");
    progressStep2.classList.add("active");
  }
  window.scrollTo({ top: form.offsetTop - 20, behavior: "smooth" });
}

function validateStep1() {
  const fields = step1.querySelectorAll("input[required], select[required]");
  for (const field of fields) {
    if (!field.checkValidity()) {
      field.reportValidity();
      return false;
    }
  }
  return true;
}

if (toStep2Btn) {
  toStep2Btn.addEventListener("click", () => {
    if (!validateStep1()) return;
    saveContactInfo();
    goToStep(2);
  });
}

if (backToStep1Btn) {
  backToStep1Btn.addEventListener("click", () => goToStep(1));
}

// ---------------------------------------------------------------
// Remember contact info without an account (localStorage only,
// stays on this device/browser — nothing sent anywhere until they submit)
// ---------------------------------------------------------------
function saveContactInfo() {
  const data = {
    name: document.getElementById("q_name")?.value || "",
    business: document.getElementById("q_business")?.value || "",
    email: document.getElementById("q_email")?.value || "",
    phone: document.getElementById("q_phone")?.value || "",
  };
  try {
    localStorage.setItem(CONTACT_STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    // localStorage unavailable (private browsing, etc.) — fine, just won't persist
  }
}

function loadContactInfo() {
  try {
    const raw = localStorage.getItem(CONTACT_STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data.name) document.getElementById("q_name").value = data.name;
    if (data.business) document.getElementById("q_business").value = data.business;
    if (data.email) document.getElementById("q_email").value = data.email;
    if (data.phone) document.getElementById("q_phone").value = data.phone;
  } catch (e) {
    // ignore corrupted/missing data
  }
}
loadContactInfo();

// ---------------------------------------------------------------
// VIN decode via NHTSA's free public vPIC database
// ---------------------------------------------------------------
async function decodeVin(vin, panel) {
  const hint = panel.querySelector(".vin-hint");
  const cleanVin = vin.trim().toUpperCase();

  if (cleanVin.length !== 17) {
    hint.textContent = "VINs are 17 characters. Double-check and try again.";
    hint.dataset.state = "error";
    return;
  }

  hint.textContent = "Looking it up...";
  hint.dataset.state = "";

  try {
    const res = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${cleanVin}?format=json`);
    const data = await res.json();
    const results = data.Results || [];
    const get = (name) => results.find((r) => r.Variable === name)?.Value || "";

    const year = get("Model Year");
    const make = get("Make");
    const model = get("Model");

    if (year || make || model) {
      if (year) panel.querySelector(".bike-year").value = year;
      if (make) panel.querySelector(".bike-make").value = make;
      if (model) panel.querySelector(".bike-model").value = model;
      hint.textContent = `Found: ${[year, make, model].filter(Boolean).join(" ")}. Feel free to adjust if anything's off.`;
      hint.dataset.state = "ok";
    } else {
      hint.textContent = "No match found for that VIN. No problem, just fill in the details below.";
      hint.dataset.state = "error";
    }
  } catch (err) {
    hint.textContent = "Couldn't look that up right now. Just fill in the details below.";
    hint.dataset.state = "error";
  }
}

// ---------------------------------------------------------------
// Add / remove motorcycle rows, each with its own VIN decode + photos
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

  const vinInput = panel.querySelector(".bike-vin");
  const decodeBtn = panel.querySelector(".decode-vin");
  decodeBtn.addEventListener("click", () => decodeVin(vinInput.value, panel));
  vinInput.addEventListener("blur", () => {
    if (vinInput.value.trim().length === 17) decodeVin(vinInput.value, panel);
  });

  const photoInput = panel.querySelector(".bike-photos");
  const photoHint = panel.querySelector(".photo-hint");
  photoInput.addEventListener("change", () => handlePhotoChange(panel, photoInput, photoHint));

  bikesContainer.appendChild(clone);
  renumberBikes();
}

addBikeBtn.addEventListener("click", addBike);
addBike(); // start with one motorcycle block

// ---------------------------------------------------------------
// Photo compression: resize + re-encode as JPEG in the browser so a
// handful of full-size phone photos fit comfortably under FormSubmit's
// 10MB-per-submission cap. Files are renamed to include the bike
// number so attachments are easy to sort once they land in your inbox.
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
            resolve(file);
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
      resolve(file); // couldn't decode (e.g. an unsupported HEIC file) — pass through as-is
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
    photoHint.textContent = `Even compressed, these photos add up to about ${totalMb.toFixed(1)}MB. Please try fewer images for this bike.`;
    photoHint.dataset.state = "error";
    photoInput.value = "";
    return;
  }

  const dataTransfer = new DataTransfer();
  compressed.forEach((f) => dataTransfer.items.add(f));
  photoInput.files = dataTransfer.files; // keeps the native "X files" indicator accurate
  panel.compressedPhotos = compressed; // this is what actually gets submitted, see below

  photoHint.textContent = `${compressed.length} photo${compressed.length > 1 ? "s" : ""} ready (about ${totalMb.toFixed(1)}MB after compression).`;
  photoHint.dataset.state = "ok";
}

// ---------------------------------------------------------------
// Submission: a real form POST to FormSubmit (not AJAX), since file
// attachments need a plain multipart/form-data submit. "_next" points
// back to this page with a query flag so we can show a success banner.
// ---------------------------------------------------------------
if (nextField) {
  const cleanUrl = window.location.origin + window.location.pathname;
  nextField.value = `${cleanUrl}?submitted=true`;
}

function setStatus(message, state) {
  statusEl.textContent = message;
  statusEl.dataset.state = state || "";
}

// ---------------------------------------------------------------
// Right before submitting: give every bike's fields a labeled,
// unique name (e.g. "Bike 1 - Model") instead of the generic
// "Model[]" used while editing — this is what makes each bike show
// up as its own clearly labeled row in FormSubmit's email table
// instead of every bike's values getting mashed onto one line.
// ---------------------------------------------------------------
function labelBikeFields() {
  const fieldMap = [
    [".bike-vin", "VIN"],
    [".bike-year", "Year"],
    [".bike-make", "Make"],
    [".bike-model", "Model"],
    [".bike-mileage", "Mileage"],
    [".bike-title", "Title status"],
    [".bike-condition", "Condition"],
    [".bike-price", "Asking price"],
    [".bike-notes", "Notes"],
  ];
  bikesContainer.querySelectorAll(".bike-panel").forEach((panel, i) => {
    const n = i + 1;
    fieldMap.forEach(([selector, label]) => {
      const el = panel.querySelector(selector);
      if (el) el.name = `Bike ${n} - ${label}`;
    });
  });
}

// ---------------------------------------------------------------
// Right before submitting: FormSubmit only keeps one file per field
// name, so multiple photos (whether from one bike or spread across
// several) silently get dropped if they all share the same field
// name. To fix that, every compressed photo gets its own uniquely
// named hidden file input added directly to the form right before
// it submits.
// ---------------------------------------------------------------
function attachAllPhotos() {
  // Clear out any leftover hidden inputs from a previous attempt
  form.querySelectorAll('input[type="file"].generated-attachment').forEach((el) => el.remove());

  let counter = 1;
  bikesContainer.querySelectorAll(".bike-panel").forEach((panel) => {
    const files = panel.compressedPhotos || [];
    files.forEach((file) => {
      const hiddenInput = document.createElement("input");
      hiddenInput.type = "file";
      hiddenInput.name = `attachment${counter}`;
      hiddenInput.className = "generated-attachment";
      hiddenInput.style.display = "none";
      const dt = new DataTransfer();
      dt.items.add(file);
      hiddenInput.files = dt.files;
      form.appendChild(hiddenInput);
      counter++;
    });
  });
}

form.addEventListener("submit", (e) => {
  if (!form.checkValidity()) {
    e.preventDefault();
    // If something in step 1 is invalid, jump back so they can see it
    const invalidInStep1 = Array.from(step1.querySelectorAll("input, select")).some((f) => !f.checkValidity());
    if (invalidInStep1) goToStep(1);
    form.reportValidity();
    return;
  }

  const bikeCount = bikesContainer.querySelectorAll(".bike-panel").length;

  const totalMb = Array.from(bikesContainer.querySelectorAll(".bike-panel"))
    .flatMap((panel) => panel.compressedPhotos || [])
    .reduce((sum, f) => sum + f.size, 0) / (1024 * 1024);
  if (totalMb > 9.5) {
    e.preventDefault();
    setStatus(
      `All the photos across your motorcycles add up to about ${totalMb.toFixed(1)}MB, which is too much for one submission. Try removing a photo or two.`,
      "error"
    );
    return;
  }

  if (subjectField) {
    subjectField.value = `New quote request: ${bikeCount} motorcycle${bikeCount > 1 ? "s" : ""}`;
  }
  labelBikeFields();
  attachAllPhotos();
  setStatus("Sending...", "");
  saveContactInfo();
  // No preventDefault — let the browser submit normally so FormSubmit
  // receives the file attachments.
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
