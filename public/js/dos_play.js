// dos_play.js

let ci = null;
let gameid = null;
let onStopFn = null;
let intervalFn = null;

/**
 * Set a callback to run when the emulator stops.
 */
function dos_setOnStop(onStop) {
  onStopFn = onStop;
}

/**
 * Start the js-dos emulator for the specified game.
 */
async function dos_play(gameName, savedData) {
  if (ci) await dos_exit();

  ci = null;
  gameid = gameName;

  const jsdosDiv = document.getElementById("jsdos");
  jsdosDiv.style.width = "100%";
  jsdosDiv.style.height = `${jsdosDiv.parentElement.clientHeight}px`;

  emulators.pathPrefix = "/js-dos/";
  ci = await Dos(jsdosDiv).run(`/api/games/${encodeURIComponent(gameid)}/data`, savedData);

  const canvas = jsdosDiv.querySelector(".emulator-canvas");
  if (canvas) {
    canvas.style.width = "100%";
    canvas.style.height = "100%";
  }

  // Autosave (the interval is in milliseconds)
  if (window.autoSaveIntervalMs > 0) {
    clearInterval(intervalFn);
    intervalFn = setInterval(dos_save, window.autoSaveIntervalMs);
  }
}

/**
 * Stop the js-dos emulator and run the stop callback.
 */
async function dos_exit() {
  if (!ci) return;

  await dos_save();
  recreateJsDos();

  if (onStopFn) onStopFn();

  ci = null;
  clearInterval(intervalFn);
}

/**
 * Remove and recreate the js-dos div.
 */
function recreateJsDos() {
  const jsdosElement = document.getElementById("jsdos");
  const parent = jsdosElement.parentNode;
  parent.removeChild(jsdosElement);

  const newDiv = document.createElement("div");
  newDiv.id = "jsdos";
  newDiv.style.width = "100%";
  newDiv.style.height = "100%";
  parent.appendChild(newDiv);
}

/**
 * Persist the user's progress via the API.
 */
async function dos_save() {
  if (!ci || !gameid || !window.currentUser?.username) return;

  const changesBundle = await ci.persist();
  if (!changesBundle) return;

  const blobData = new Blob([changesBundle.buffer], { type: "application/zip" });
  const userDataUrl = `/api/games/${encodeURIComponent(gameid)}/userdata`;

  try {
    const resp = await fetch(userDataUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/zip" },
      body: blobData,
    });
    if (!resp.ok) throw new Error("Save failed: " + resp.status);

    console.log("User data successfully saved!");
  } catch (err) {
    console.error("Failed to save user data:", err);
  }
}

export { dos_play, dos_exit, dos_setOnStop, dos_save };
