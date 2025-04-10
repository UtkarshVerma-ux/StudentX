document.addEventListener("DOMContentLoaded", () => {
  const toggleBtn = createButton("🌙 Toggle Dark Mode", {
    position: "fixed",
    top: "1rem",
    right: "1rem",
    padding: "0.5rem 1rem",
    zIndex: "1000",
    backgroundColor: "#0f172a",
    color: "white",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
  });

  document.body.appendChild(toggleBtn);

  toggleBtn.addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");
  });
});

let selectedFiles = [];
const form = document.getElementById("issueForm");
const proofFile = document.getElementById("proofFile");
const previewContainer = document.getElementById("previewContainer");
const messageBox = document.getElementById("messageBox");
const submitBtn = document.getElementById("submitBtn");
const modal = document.getElementById("successModal");
const closeModalBtn = document.getElementById("closeModalBtn");

form.addEventListener("submit", async function (e) {
  e.preventDefault();

  const issueText = document.getElementById("issueText").value.trim();
  const guidelines = [
    document.getElementById("guideline1").checked,
    document.getElementById("guideline2").checked,
    document.getElementById("guideline3").checked,
  ];

  messageBox.textContent = "";
  messageBox.style.color = "red";
  messageBox.style.textAlign = "center";

  if (!issueText) {
    messageBox.textContent = "Please enter your issue.";
    return;
  }

  if (guidelines.includes(false)) {
    messageBox.textContent = "Please agree to all guidelines before submitting.";
    return;
  }

  const formData = new FormData();
  formData.append("description", issueText);
  formData.append("userId", getOrCreateUserId());

  selectedFiles.forEach(file => formData.append("media", file));

  // Disable submit and show loading state
  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting...";

  try {
    const res = await fetch("/api/submitIssue", {
      method: "POST",
      body: formData,
    });

    const result = await res.json();

    if (!res.ok) throw new Error(result.message || "Submission failed.");

    form.reset();
    selectedFiles = [];
    renderPreviews();
    showModal();

  } catch (err) {
    messageBox.textContent = err.message;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit Issue";
  }
});

proofFile.addEventListener("change", async function () {
  const filePromises = Array.from(this.files).map(async file => {
    if (file.size > 1024 * 1024) {
      alert(`"${file.name}" is larger than 1MB and will be compressed.`);
      return await compressFile(file);
    }
    return file;
  });

  const files = (await Promise.all(filePromises)).filter(Boolean);
  selectedFiles = [...selectedFiles, ...files];
  renderPreviews();
  this.value = "";
});

function renderPreviews() {
  previewContainer.innerHTML = "";

  selectedFiles.forEach((file, index) => {
    const fileReader = new FileReader();
    fileReader.onload = function (e) {
      const previewItem = document.createElement("div");
      previewItem.className = "preview-item";

      const media = createMediaElement(file, e.target.result);
      const removeBtn = createButton("×", { className: "remove-btn" });

      removeBtn.addEventListener("click", () => {
        selectedFiles.splice(index, 1);
        renderPreviews();
      });

      previewItem.appendChild(media);
      previewItem.appendChild(removeBtn);
      previewContainer.appendChild(previewItem);
    };
    fileReader.readAsDataURL(file);
  });
}

function createButton(text, styles = {}) {
  const button = document.createElement("button");
  button.textContent = text;
  Object.assign(button.style, styles);
  return button;
}

function createMediaElement(file, src) {
  let media;
  if (file.type.startsWith("image")) {
    media = document.createElement("img");
    media.src = src;
  } else if (file.type.startsWith("video")) {
    media = document.createElement("video");
    media.src = src;
    media.controls = true;
  }
  return media;
}

function compressFile(file) {
  return new Promise(resolve => {
    if (file.type.startsWith("image")) {
      const img = new Image();
      const reader = new FileReader();
      reader.onload = e => (img.src = e.target.result);
      reader.readAsDataURL(file);

      img.onload = function () {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        const maxSize = 800;
        let { width, height } = img;

        if (width > height && width > maxSize) {
          height *= maxSize / width;
          width = maxSize;
        } else if (height > maxSize) {
          width *= maxSize / height;
          height = maxSize;
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(blob => {
          resolve(new File([blob], file.name, { type: file.type }));
        }, file.type, 0.7);
      };
    } else {
      resolve(file);
    }
  });
}

function getOrCreateUserId() {
  let userId = localStorage.getItem("userId");
  if (!userId) {
    userId = crypto.randomUUID();
    localStorage.setItem("userId", userId);
  }
  return userId;
}

// Modal handling
function showModal() {
  modal.style.display = "block";
}

closeModalBtn.addEventListener("click", () => {
  modal.style.display = "none";
});

window.addEventListener("click", e => {
  if (e.target === modal) modal.style.display = "none";
});
