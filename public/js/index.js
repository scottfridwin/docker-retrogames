// Page setup: loads the session and game list, renders the game tiles and drives the game modal.
import { dos_play, dos_exit, dos_setOnStop } from "./dos_play.js";

const userdataUrl = (gameId) => `/api/games/${encodeURIComponent(gameId)}/userdata`;

async function getJson(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`${url}: HTTP ${resp.status}`);
  return resp.json();
}

function showUser(user) {
  if (!user?.username) return;
  $("#nav-username").text(user.username);
  if (user.email) $("#nav-email").text(`(${user.email})`);
  $("#nav-user").removeClass("d-none");
}

function renderTiles(games) {
  const gameRow = document.getElementById("gameRowId");
  for (const game of games) {
    if (String(game.emulation).toLowerCase() !== "dos") continue;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "game-tile col-sm-12 col-md-6 col-lg-4 col-xl-3 col-xxl-2";
    btn.dataset.bsToggle = "modal";
    btn.dataset.bsTarget = "#gameModal";
    btn.dataset.gameId = game.id;

    const img = document.createElement("img");
    img.className = "game-screenshot";
    img.src = `/api/games/${encodeURIComponent(game.id)}/screenshot`;
    img.alt = game.displayName;

    const title = document.createElement("h2");
    title.className = "game-title";
    title.textContent = game.displayName;

    btn.append(img, title);
    gameRow.appendChild(btn);
  }
}

function populateGameModal(game) {
  $("#modal-title").text(game.displayName || "Unknown Game");
  $("#modal-gameinfo-img")
    .attr("src", `/api/games/${encodeURIComponent(game.id)}/screenshot`)
    .attr("alt", game.displayName);
  $("#modal-gameinfo-age-text").text(game.ageLow ? `${game.ageLow}+` : "N/A");
  $("#modal-gameinfo-tags-text").text(Array.isArray(game.tags) ? game.tags.join(", ") : "N/A");
  $("#modal-gameinfo-publisher-text").text(
    game.publisher ? `${game.publisher} (${game.releaseYear || "Year N/A"})` : "Unknown",
  );

  const descContainer = $("#modal-gameinfo-descriptions").empty();
  if (Array.isArray(game.descriptions) && game.descriptions.length) {
    for (const desc of game.descriptions) {
      if (desc.header) descContainer.append($("<p>").addClass("fw-bold mt-2").text(desc.header));
      if (desc.body) descContainer.append($("<p>").addClass("fst-italic").text(desc.body));
    }
  } else {
    descContainer.append($("<p>").addClass("fst-italic").text("No description available."));
  }
}

function setupModal(gamesById) {
  const modalInfo = $("#modal-gameinfo");
  // dos_exit() replaces the #jsdos element, so look it up each time.
  const jsdosDiv = () => $("#jsdos");
  const savedDataDiv = $("#modal-gameinfo-saveddata");
  let selectedGame = null;
  let savedDataUrl = null;

  const clearSavedData = () => {
    if (savedDataUrl) URL.revokeObjectURL(savedDataUrl);
    savedDataUrl = null;
    savedDataDiv.addClass("d-none");
  };

  $("#gameModal").on("show.bs.modal", async (event) => {
    selectedGame = gamesById.get(event.relatedTarget?.dataset.gameId);
    if (!selectedGame) return;
    populateGameModal(selectedGame);
    clearSavedData();
    modalInfo.show();
    jsdosDiv().hide();

    const gameId = selectedGame.id;
    const resp = await fetch(userdataUrl(gameId));
    if (!resp.ok || selectedGame?.id !== gameId) return;
    const blob = await resp.blob();
    savedDataUrl = URL.createObjectURL(blob);
    $("#modal-gameinfo-saveddata-size").text(`Size: ${blob.size} bytes`);
    $("#modal-gameinfo-saveddata-date").text(`Modified: ${resp.headers.get("Last-Modified") || "N/A"}`);
    savedDataDiv.removeClass("d-none");
  });

  $("#modal-gameinfo-saveddata-download").on("click", () => {
    if (!savedDataUrl || !selectedGame) return;
    const link = document.createElement("a");
    link.href = savedDataUrl;
    link.download = `${selectedGame.id}.jsdos`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  });

  $("#modal-gameinfo-saveddata-delete").on("click", async () => {
    if (!selectedGame || !window.confirm(`Delete your saved progress for ${selectedGame.displayName}?`)) return;
    const resp = await fetch(userdataUrl(selectedGame.id), { method: "DELETE" });
    if (resp.ok || resp.status === 404) clearSavedData();
  });

  $("#modal-play").on("click", async () => {
    if (!selectedGame) return;
    modalInfo.hide();
    jsdosDiv().show();
    await dos_play(selectedGame.id, savedDataUrl);
  });

  $("#gameModal").on("hidden.bs.modal", async () => {
    await dos_exit();
    selectedGame = null;
    clearSavedData();
    modalInfo.show();
    jsdosDiv().hide();
  });

  dos_setOnStop(() => {
    modalInfo.show();
    jsdosDiv().hide();
  });
}

try {
  const [session, games] = await Promise.all([getJson("/api/session"), getJson("/api/games")]);
  showUser(session.user);
  window.autoSaveIntervalMs = session.autosaveIntervalMs;
  window.currentUser = session.user;
  renderTiles(games);
  setupModal(new Map(games.map((g) => [g.id, g])));
} catch (err) {
  console.error(err);
  $("#load-error").text("Could not load the game library. Please reload the page.").removeClass("d-none");
}
