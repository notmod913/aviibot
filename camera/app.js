let capturedLocation = null;
let capturedPhoto = null;
let cameraStream = null;
let photoPreviewUrl = null;

const locationButton = document.querySelector("#getLocation");
const locationResult = document.querySelector("#locationResult");
const form = document.querySelector("form");
const saveResult = document.querySelector("#saveResult");
const cameraPreview = document.querySelector("#cameraPreview");
const photoCanvas = document.querySelector("#photoCanvas");
const photoPreview = document.querySelector("#photoPreview");
const cameraStatus = document.querySelector("#cameraStatus");
const openCameraButton = document.querySelector("#openCamera");
const capturePhotoButton = document.querySelector("#capturePhoto");
const closeCameraButton = document.querySelector("#closeCamera");
const evidenceCardObserver =
  "IntersectionObserver" in window
    ? new IntersectionObserver(function (entries, observer) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.remove("is-reveal-pending");
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12 })
    : null;

function formatCoordinates(location) {
  const lat = Number(location.latitude);
  const lon = Number(location.longitude);

  const latitude = `${Math.abs(lat).toFixed(5)}° ${lat >= 0 ? "N" : "S"}`;
  const longitude = `${Math.abs(lon).toFixed(5)}° ${lon >= 0 ? "E" : "W"}`;

  return `${latitude}, ${longitude}`;
}
function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(function (track) {
      track.stop();
    });
    cameraStream = null;
  }

  cameraPreview.srcObject = null;
  cameraPreview.hidden = true;
  capturePhotoButton.disabled = true;
  closeCameraButton.disabled = true;
}

openCameraButton.addEventListener("click", async function () {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    cameraStatus.textContent = "Camera is not available in this browser.";
    return;
  }

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false
    });

    cameraPreview.srcObject = cameraStream;
    cameraPreview.hidden = false;
    await cameraPreview.play();

    capturePhotoButton.disabled = false;
    closeCameraButton.disabled = false;
    cameraStatus.textContent = "Camera is open. Take the inspection photo.";
  } catch (error) {
    cameraStatus.textContent =
      "Could not open camera. Allow camera access and try again.";
  }
});

capturePhotoButton.addEventListener("click", function () {
  const width = cameraPreview.videoWidth;
  const height = cameraPreview.videoHeight;

  if (!width || !height) {
    cameraStatus.textContent = "Camera is still starting. Please wait.";
    return;
  }

  photoCanvas.width = width;
  photoCanvas.height = height;

  const context = photoCanvas.getContext("2d");
  context.drawImage(cameraPreview, 0, 0, width, height);

  photoCanvas.toBlob(function (blob) {
    if (!blob) {
      cameraStatus.textContent = "Photo capture failed. Please try again.";
      return;
    }

    capturedPhoto = blob;

    if (photoPreviewUrl) {
      URL.revokeObjectURL(photoPreviewUrl);
    }

    photoPreviewUrl = URL.createObjectURL(blob);
    photoPreview.src = photoPreviewUrl;
    photoPreview.hidden = false;

    stopCamera();
    cameraStatus.textContent =
      "Live photo captured. Open the camera again to retake it.";
  }, "image/jpeg", 0.9);
});

closeCameraButton.addEventListener("click", function () {
  stopCamera();
  cameraStatus.textContent = "Camera closed.";
});
locationButton.addEventListener("click", function () {
  if (!navigator.geolocation) {
    locationResult.textContent = "Location is not available in this browser.";
    return;
  }

  locationResult.textContent = "Getting location...";

  navigator.geolocation.getCurrentPosition(
    function (position) {
      capturedLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: Math.round(position.coords.accuracy),
        gpsTime: new Date(position.timestamp).toISOString()
      };

      locationResult.textContent =

  `Location captured: ${formatCoordinates(capturedLocation)}. Accuracy: about ${capturedLocation.accuracy} metres. GPS Reading time: ${capturedLocation.gpsTime}`;
    },
    function () {
      locationResult.textContent =
        "Could not get location. Allow location access and try again.";
    }
  );
});

function openDatabase() {
  return new Promise(function (resolve, reject) {
    const request = indexedDB.open("SatarkEvidence", 1);

    request.onupgradeneeded = function () {
      request.result.createObjectStore("records", { keyPath: "id" });
    };

    request.onsuccess = function () {
      resolve(request.result);
    };

    request.onerror = function () {
      reject(request.error);
    };
  });
}
async function loadSavedRecords() {
  const container = document.querySelector("#savedRecords");

  try {
    const database = await openDatabase();
    const transaction = database.transaction("records", "readonly");
    const request = transaction.objectStore("records").getAll();

    request.onsuccess = function () {
      const records = request.result.sort(
        function (a, b) {
          return new Date(b.savedAt) - new Date(a.savedAt);
        }
      );

      database.close();
      container.replaceChildren();

      if (records.length === 0) {
        container.textContent = "No saved evidence yet.";
        return;
      }

      records.forEach(function (record) {
  const item = document.createElement("article");
  item.className = "evidence-card";
  if (evidenceCardObserver) {
  item.classList.add("is-reveal-pending");
}

  const header = document.createElement("div");
  header.className = "evidence-card-header";

  const title = document.createElement("h3");
  title.className = "evidence-title";
  title.textContent = record.description || "Inspection evidence";

  const status = document.createElement("span");
  const isSynced = record.syncStatus === "synced";
  status.className = isSynced
    ? "evidence-status is-synced"
    : "evidence-status is-pending";
  status.textContent = isSynced ? "Synced" : "Pending sync";

  header.append(title, status);

  const savedTime = document.createElement("p");
  savedTime.className = "evidence-saved-time";
  savedTime.textContent =
    "Saved on this device · " +
    (record.savedAt ? new Date(record.savedAt).toLocaleString() : "Time unavailable");

  item.append(header, savedTime);

  if (record.photo) {
    const image = document.createElement("img");
    image.className = "evidence-photo";
    image.src = URL.createObjectURL(record.photo);
    image.alt = "Inspection photo";
    item.append(image);
  }

  const location = record.location;
  const coordinates = document.createElement("p");
  coordinates.className = "evidence-coordinates";
  coordinates.textContent = location
    ? "Location · " + formatCoordinates(location)
    : "Location · Not captured";
  item.append(coordinates);

  const details = document.createElement("details");
  details.className = "evidence-details";

  const summary = document.createElement("summary");
  summary.textContent = "View full details";
  details.append(summary);

  const detailList = document.createElement("div");
  detailList.className = "evidence-detail-list";

  function addDetail(labelText, valueText) {
    const row = document.createElement("div");
    row.className = "evidence-detail-row";

    const label = document.createElement("span");
    label.className = "evidence-detail-label";
    label.textContent = labelText;

    const value = document.createElement("span");
    value.className = "evidence-detail-value";
    value.textContent = valueText;

    row.append(label, value);
    detailList.append(row);
  }

  addDetail(
    "Coordinates",
    location ? formatCoordinates(location) : "Not captured"
  );

  addDetail(
    "GPS accuracy",
    location && Number.isFinite(Number(location.accuracy))
      ? "About " + location.accuracy + " metres"
      : "Unavailable"
  );

  addDetail(
    "GPS reading time",
    location && location.gpsTime
      ? new Date(location.gpsTime).toLocaleString()
      : "Unavailable"
  );

  addDetail(
    "Saved time",
    record.savedAt ? new Date(record.savedAt).toLocaleString() : "Unavailable"
  );

  addDetail("Sync status", isSynced ? "Synced" : "Pending sync");

  details.append(detailList);
  item.append(details);
  container.append(item);
  if (evidenceCardObserver) {
  evidenceCardObserver.observe(item);
}
      });

    };

    request.onerror = function () {
      database.close();
      container.textContent = "Could not load saved evidence.";
    };
  } catch (error) {
    container.textContent = "Could not open saved evidence.";
  }
}
form.addEventListener("submit", async function (event) {
  event.preventDefault();

  const description = document.querySelector("#description").value.trim();
  const photo = capturedPhoto;

  if (!capturedLocation) {
    saveResult.textContent = "Please capture your location first.";
    return;
  }

  if (!photo) {
    saveResult.textContent = "Please take a live photo first.";
    return;
  }

  const record = {
    id: Date.now(),
    description: description,
    photo: photo,
    location: capturedLocation,
    savedAt: new Date().toISOString(),
    syncStatus: "pending"
  };

  try {
    const database = await openDatabase();
    const transaction = database.transaction("records", "readwrite");

    transaction.objectStore("records").add(record);

    transaction.oncomplete = function () {
      database.close();
      saveResult.textContent = "Evidence saved on this device.";
      form.reset();
      capturedLocation = null;
      locationResult.textContent = "Location not captured yet";
      function formatCoordinates(location) {
  const lat = Number(location.latitude);
  const lon = Number(location.longitude);

  const latitude = `${Math.abs(lat).toFixed(5)}° ${lat >= 0 ? "N" : "S"}`;
  const longitude = `${Math.abs(lon).toFixed(5)}° ${lon >= 0 ? "E" : "W"}`;

  return `${latitude}, ${longitude}`;
}
      loadSavedRecords();
   };

    transaction.onerror = function () {
      database.close();
      saveResult.textContent = "Could not save. Please try again.";
    };
  } catch (error) {
    saveResult.textContent = "Local storage could not be opened.";
  }
});
if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker
      .register("./sw.js")
      .then(function () {
        console.log("Offline app cache is ready.");
      })
      .catch(function (error) {
        console.log("Offline setup error:", error);
      });
  });
}
loadSavedRecords();