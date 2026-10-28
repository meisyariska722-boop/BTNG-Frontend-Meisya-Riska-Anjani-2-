/* =========================================================
   AutoPrima Showroom - script.js (Vanilla JavaScript)
   Isi: 1.Config 2.State 3.Helper 4.Fetch API 5.Render
        6.Filter & sort 7.Modal 8.Favorit 9.Booking 10.UI 11.Init
   ========================================================= */

"use strict";

/* ---------- 1. Konfigurasi ---------- */
const API_URL = "https://api-web.dnccudinus.org/api/mobil";
const FAV_KEY = "autoprima_favorites";
const FALLBACK_IMG =
  "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&q=80";

/* ---------- 2. State ---------- */
const state = {
  cars: [],
  search: "",
  brand: "Semua",
  fuel: "Semua",
  sort: "default",
  favorites: loadFavorites(),
  activeCar: null,
};

/* ---------- 3. Helper & referensi elemen ---------- */
const $ = (selector) => document.querySelector(selector);

const el = {
  navbar: $("#navbar"),
  navMenu: $("#navMenu"),
  hamburger: $("#hamburger"),
  grid: $("#carGrid"),
  stateBox: $("#stateBox"),
  info: $("#resultInfo"),
  search: $("#searchInput"),
  brandSelect: $("#brandSelect"),
  sortSelect: $("#sortSelect"),
  chips: $("#fuelChips"),
  favCount: $("#favCount"),
  favList: $("#favList"),
  toast: $("#toast"),
};

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

function formatRupiah(value) {
  return rupiah.format(Number(value) || 0);
}

function isAvailable(car) {
  return String(car.status).toLowerCase() === "tersedia";
}

function statusLabel(car) {
  return isAvailable(car) ? "Tersedia" : "Terjual";
}

function escapeHTML(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

function showToast(message) {
  el.toast.textContent = message;
  el.toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => el.toast.classList.remove("show"), 2400);
}

/* ---------- 4. Ambil data dari API (fetch) ---------- */
async function fetchCars() {
  renderSkeleton();
  el.stateBox.hidden = true;

  try {
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error(`Server merespons dengan status ${response.status}`);
    }

    const result = await response.json();
    const list = Array.isArray(result) ? result : result.data;
    if (!Array.isArray(list)) {
      throw new Error("Format data dari API tidak sesuai.");
    }

    state.cars = list;
    setupFilters();
    updateHero();
    render();
  } catch (error) {
    console.error("Gagal mengambil data mobil:", error);
    el.grid.innerHTML = "";
    el.info.textContent = "Data tidak dapat dimuat.";
    showState(
      "⚠️",
      "Gagal memuat data mobil",
      "Periksa koneksi internet Anda lalu coba lagi.",
      "Coba Lagi",
      fetchCars
    );
  }
}

/* ---------- 5. Render (DOM Manipulation) ---------- */
function renderSkeleton() {
  el.grid.innerHTML = "";
  el.info.textContent = "Memuat data mobil...";
  for (let i = 0; i < 6; i++) {
    const card = document.createElement("div");
    card.className = "car-card skeleton";
    card.innerHTML = `
      <div class="sk sk-img"></div>
      <div class="car-body">
        <div class="sk sk-line w40"></div>
        <div class="sk sk-line"></div>
        <div class="sk sk-line w60"></div>
      </div>`;
    el.grid.appendChild(card);
  }
}

function createCarCard(car, index) {
  const isFav = state.favorites.includes(car.id);

  const card = document.createElement("article");
  card.className = "car-card" + (isAvailable(car) ? "" : " is-sold");
  card.style.animationDelay = `${Math.min(index, 8) * 60}ms`;
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `Lihat detail ${car.nama}`);

  card.innerHTML = `
    <div class="car-media">
      <img src="${escapeHTML(car.foto)}" alt="${escapeHTML(car.nama)}" loading="lazy">
      <span class="status-pill ${isAvailable(car) ? "" : "sold"}">${statusLabel(car)}</span>
      <button class="heart ${isFav ? "on" : ""}" type="button"
        aria-label="Tambah ke favorit" aria-pressed="${isFav}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.1C.9 8.7 2.6 5 6.1 5c2 0 3.3 1 3.9 2 .6-1 1.9-2 3.9-2 3.5 0 5.2 3.7 3.7 6.9C19.5 16.4 12 21 12 21z"/></svg>
      </button>
    </div>
    <div class="car-body">
      <span class="car-brand">${escapeHTML(car.brand)}</span>
      <h3 class="car-name">${escapeHTML(car.nama)}</h3>
      <div class="car-tags">
        <span class="tag">${escapeHTML(car.tahun)}</span>
        <span class="tag">${escapeHTML(car.transmisi)}</span>
        <span class="tag">${escapeHTML(car.bahan_bakar)}</span>
      </div>
      <div class="car-foot">
        <strong class="car-price">${formatRupiah(car.harga)}</strong>
        <span class="car-more">Detail &rarr;</span>
      </div>
    </div>`;

  // Fallback jika gambar gagal dimuat
  const img = card.querySelector("img");
  img.addEventListener("error", () => {
    img.src = FALLBACK_IMG;
  }, { once: true });

  // Tombol favorit tidak boleh membuka modal
  card.querySelector(".heart").addEventListener("click", (event) => {
    event.stopPropagation();
    toggleFavorite(car.id);
  });

  card.addEventListener("click", () => openDetail(car));
  card.addEventListener("keydown", (event) => {
    if (event.target === card && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      openDetail(car);
    }
  });

  return card;
}

function render() {
  const cars = getVisibleCars();
  el.grid.innerHTML = "";
  el.stateBox.hidden = true;

  el.info.innerHTML = `Menampilkan <b>${cars.length}</b> dari ${state.cars.length} unit mobil. <em>Klik kartu untuk detail & simulasi cicilan.</em>`;

  if (cars.length === 0) {
    showState(
      "🔍",
      "Mobil tidak ditemukan",
      "Coba ubah kata kunci atau reset filter.",
      "Reset Filter",
      resetFilters
    );
    return;
  }

  const fragment = document.createDocumentFragment();
  cars.forEach((car, index) => fragment.appendChild(createCarCard(car, index)));
  el.grid.appendChild(fragment);
}

function showState(icon, title, text, buttonLabel, onClick) {
  el.stateBox.innerHTML = `
    <div class="s-icon">${icon}</div>
    <h3>${title}</h3>
    <p>${text}</p>
    <button class="btn btn-primary btn-sm" type="button">${buttonLabel}</button>`;
  el.stateBox.querySelector("button").addEventListener("click", onClick);
  el.stateBox.hidden = false;
}

function updateHero() {
  const available = state.cars.filter(isAvailable);
  const brands = new Set(state.cars.map((car) => car.brand));
  $("#statTotal").textContent = state.cars.length;
  $("#statAvail").textContent = available.length;
  $("#statBrand").textContent = brands.size;

  // Unit unggulan: mobil tersedia dengan harga tertinggi
  const pool = available.length ? available : state.cars;
  const featured = [...pool].sort((a, b) => b.harga - a.harga)[0];
  if (!featured) return;

  $("#featuredName").textContent = featured.nama;
  $("#featuredPrice").textContent = formatRupiah(featured.harga);
  const btn = $("#featuredCard");
  btn.disabled = false;
  btn.onclick = () => openDetail(featured);

  const heroImg = $("#heroImg");
  heroImg.src = featured.foto;
  heroImg.alt = featured.nama;
}

/* ---------- 6. Filter, pencarian & sort ---------- */
function getVisibleCars() {
  const keyword = state.search.trim().toLowerCase();

  let result = state.cars.filter((car) => {
    const matchKeyword =
      !keyword ||
      `${car.nama} ${car.brand}`.toLowerCase().includes(keyword);
    const matchBrand = state.brand === "Semua" || car.brand === state.brand;
    const matchFuel = state.fuel === "Semua" || car.bahan_bakar === state.fuel;
    return matchKeyword && matchBrand && matchFuel;
  });

  const sorters = {
    "price-asc": (a, b) => a.harga - b.harga,
    "price-desc": (a, b) => b.harga - a.harga,
    "name-asc": (a, b) => a.nama.localeCompare(b.nama, "id"),
    "year-desc": (a, b) => b.tahun - a.tahun,
  };
  if (sorters[state.sort]) {
    result = [...result].sort(sorters[state.sort]);
  }
  return result;
}

function setupFilters() {
  // Dropdown merek
  const brands = [...new Set(state.cars.map((car) => car.brand))].sort();
  el.brandSelect.innerHTML = '<option value="Semua">Semua Merek</option>';
  brands.forEach((brand) => {
    const option = document.createElement("option");
    option.value = brand;
    option.textContent = brand;
    el.brandSelect.appendChild(option);
  });

  // Chip bahan bakar
  const fuels = [...new Set(state.cars.map((car) => car.bahan_bakar))];
  el.chips.innerHTML = "";
  ["Semua", ...fuels].forEach((fuel) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip" + (fuel === state.fuel ? " active" : "");
    chip.dataset.fuel = fuel;
    chip.textContent = fuel;
    el.chips.appendChild(chip);
  });
}

function resetFilters() {
  state.search = "";
  state.brand = "Semua";
  state.fuel = "Semua";
  state.sort = "default";
  el.search.value = "";
  el.brandSelect.value = "Semua";
  el.sortSelect.value = "default";
  el.chips.querySelectorAll(".chip").forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.fuel === "Semua");
  });
  render();
}

el.search.addEventListener("input", (event) => {
  state.search = event.target.value;
  render();
});
el.brandSelect.addEventListener("change", (event) => {
  state.brand = event.target.value;
  render();
});
el.sortSelect.addEventListener("change", (event) => {
  state.sort = event.target.value;
  render();
});
el.chips.addEventListener("click", (event) => {
  const chip = event.target.closest(".chip");
  if (!chip) return;
  state.fuel = chip.dataset.fuel;
  el.chips.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", c === chip));
  render();
});

/* ---------- 7. Modal detail + simulasi cicilan ---------- */
const detailModal = $("#detailModal");
const dpRange = $("#dpRange");
const tenorSelect = $("#tenorSelect");

function openDetail(car) {
  state.activeCar = car;

  const img = $("#dImg");
  img.src = car.foto;
  img.alt = car.nama;
  img.onerror = () => { img.src = FALLBACK_IMG; };

  $("#dBrand").textContent = car.brand;
  $("#dName").textContent = car.nama;
  $("#dPrice").textContent = formatRupiah(car.harga);
  $("#dYear").textContent = car.tahun;
  $("#dTrans").textContent = car.transmisi;
  $("#dFuel").textContent = car.bahan_bakar;
  $("#dStatusText").textContent = statusLabel(car);

  const pill = $("#dStatus");
  pill.textContent = statusLabel(car);
  pill.className = "status-pill" + (isAvailable(car) ? "" : " sold");

  $("#dBook").disabled = !isAvailable(car);
  $("#dBook").textContent = isAvailable(car) ? "Booking Test Drive" : "Unit Terjual";

  updateFavButton();
  updateSimulation();
  openModal(detailModal);
}

function updateSimulation() {
  const car = state.activeCar;
  if (!car) return;

  const dpPercent = Number(dpRange.value);
  const years = Number(tenorSelect.value);
  const dp = car.harga * (dpPercent / 100);
  const loan = car.harga - dp;
  const interest = loan * 0.05 * years; // bunga flat 5% / tahun
  const monthly = (loan + interest) / (years * 12);

  $("#dpLabel").textContent = `${dpPercent}%`;
  $("#simDp").textContent = formatRupiah(dp);
  $("#simMonthly").textContent = formatRupiah(Math.round(monthly));
}

dpRange.addEventListener("input", updateSimulation);
tenorSelect.addEventListener("change", updateSimulation);

$("#dBook").addEventListener("click", () => {
  const car = state.activeCar;
  closeModal(detailModal);
  openBooking(car ? car.id : null);
});

$("#dFav").addEventListener("click", () => {
  if (state.activeCar) toggleFavorite(state.activeCar.id);
});

/* ---------- 8. Favorit (localStorage) ---------- */
function loadFavorites() {
  try {
    const saved = JSON.parse(localStorage.getItem(FAV_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveFavorites() {
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify(state.favorites));
  } catch {
    /* penyimpanan tidak tersedia, abaikan */
  }
}

function toggleFavorite(id) {
  const car = state.cars.find((item) => item.id === id);
  if (state.favorites.includes(id)) {
    state.favorites = state.favorites.filter((favId) => favId !== id);
    showToast("Dihapus dari favorit");
  } else {
    state.favorites.push(id);
    showToast(`${car ? car.nama : "Mobil"} ditambahkan ke favorit`);
  }
  saveFavorites();
  updateFavUI();
}

function updateFavButton() {
  const btn = $("#dFav");
  const isFav = state.activeCar && state.favorites.includes(state.activeCar.id);
  btn.textContent = isFav ? "Hapus dari Favorit" : "Tambah Favorit";
  btn.classList.toggle("is-fav", !!isFav);
}

function updateFavUI() {
  el.favCount.textContent = state.favorites.length;

  // Sinkronkan ikon hati pada kartu tanpa render ulang penuh
  el.grid.querySelectorAll(".car-card").forEach((card, index) => {
    const cars = getVisibleCars();
    const car = cars[index];
    const heart = card.querySelector(".heart");
    if (!car || !heart) return;
    const on = state.favorites.includes(car.id);
    heart.classList.toggle("on", on);
    heart.setAttribute("aria-pressed", on);
  });

  updateFavButton();
  renderFavList();
}

function renderFavList() {
  el.favList.innerHTML = "";
  const favCars = state.cars.filter((car) => state.favorites.includes(car.id));

  if (favCars.length === 0) {
    el.favList.innerHTML = '<p class="fav-empty">Belum ada mobil favorit. Klik ikon hati pada kartu mobil.</p>';
    return;
  }

  favCars.forEach((car) => {
    const item = document.createElement("div");
    item.className = "fav-item";
    item.innerHTML = `
      <img src="${escapeHTML(car.foto)}" alt="${escapeHTML(car.nama)}">
      <div>
        <strong>${escapeHTML(car.nama)}</strong>
        <span>${formatRupiah(car.harga)}</span>
      </div>
      <button type="button">Hapus</button>`;
    item.querySelector("button").addEventListener("click", () => toggleFavorite(car.id));
    item.querySelector("img").addEventListener("click", () => {
      closeModal($("#favModal"));
      openDetail(car);
    });
    el.favList.appendChild(item);
  });
}

$("#openFavs").addEventListener("click", () => {
  renderFavList();
  openModal($("#favModal"));
});

/* ---------- 9. Booking test drive ---------- */
const bookModal = $("#bookModal");
const bookForm = $("#bookForm");

function openBooking(carId) {
  // Isi pilihan mobil (hanya yang tersedia)
  const select = $("#bCar");
  select.innerHTML = "";
  state.cars.filter(isAvailable).forEach((car) => {
    const option = document.createElement("option");
    option.value = car.id;
    option.textContent = car.nama;
    select.appendChild(option);
  });
  if (carId) select.value = carId;

  // Tanggal minimal: hari ini
  const today = new Date().toISOString().split("T")[0];
  $("#bDate").min = today;

  bookForm.hidden = false;
  $("#bookSuccess").hidden = true;
  openModal(bookModal);
}

document.querySelectorAll('input[name="bPlace"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    $("#addrField").hidden = radio.value !== "Rumah" || !radio.checked;
  });
});

function setError(inputId, message) {
  const input = $(`#${inputId}`);
  const note = document.querySelector(`[data-err="${inputId}"]`);
  input.closest(".field").classList.toggle("invalid", !!message);
  if (note) note.textContent = message || "";
  return !message;
}

bookForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const name = $("#bName").value.trim();
  const phone = $("#bPhone").value.replace(/\s|-/g, "");
  const date = $("#bDate").value;
  const place = bookForm.querySelector('input[name="bPlace"]:checked').value;
  const address = $("#bAddr").value.trim();

  let valid = true;
  valid = setError("bName", name.length < 3 ? "Nama minimal 3 karakter." : "") && valid;
  valid = setError("bPhone", /^(\+62|62|0)8\d{7,12}$/.test(phone) ? "" : "Nomor WhatsApp tidak valid.") && valid;
  valid = setError("bDate", date ? "" : "Pilih tanggal test drive.") && valid;
  valid = setError("bAddr", place === "Rumah" && address.length < 8 ? "Alamat belum lengkap." : "") && valid;
  if (!valid) return;

  const carName = $("#bCar").selectedOptions[0].textContent;
  const dateText = new Date(date).toLocaleDateString("id-ID", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  $("#successText").textContent =
    `Terima kasih, ${name}. Test drive ${carName} dijadwalkan pada ${dateText} (${place === "Rumah" ? "diantar ke rumah" : "di showroom"}). Tim kami akan menghubungi Anda via WhatsApp.`;

  bookForm.hidden = true;
  $("#bookSuccess").hidden = false;
  bookForm.reset();
  $("#addrField").hidden = true;
});

$("#openBooking").addEventListener("click", () => openBooking(null));

/* ---------- 10. UI umum (modal, navbar, scroll) ---------- */
function openModal(dialog) {
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
  document.body.classList.add("no-scroll");
}

function closeModal(dialog) {
  if (typeof dialog.close === "function") dialog.close();
  else dialog.removeAttribute("open");
}

document.querySelectorAll("dialog.modal").forEach((dialog) => {
  // Tombol tutup
  dialog.addEventListener("click", (event) => {
    if (event.target.closest("[data-close]")) closeModal(dialog);
    // Klik di area backdrop menutup modal
    if (event.target === dialog) closeModal(dialog);
  });
  dialog.addEventListener("close", () => {
    if (!document.querySelector("dialog[open]")) {
      document.body.classList.remove("no-scroll");
    }
  });
});

// Menu mobile
function setMenu(open) {
  el.navMenu.classList.toggle("open", open);
  el.hamburger.setAttribute("aria-expanded", open);
}
el.hamburger.addEventListener("click", () => {
  setMenu(!el.navMenu.classList.contains("open"));
});
el.navMenu.addEventListener("click", (event) => {
  if (event.target.closest("a")) setMenu(false);
});

// Navbar berubah saat scroll + highlight menu aktif
const sections = [...document.querySelectorAll("main section[id]")];
const navLinks = [...el.navMenu.querySelectorAll("a")];

function onScroll() {
  el.navbar.classList.toggle("scrolled", window.scrollY > 20);

  const position = window.scrollY + 140;
  let currentId = sections[0] ? sections[0].id : "";
  sections.forEach((section) => {
    if (section.offsetTop <= position) currentId = section.id;
  });
  navLinks.forEach((link) => {
    link.classList.toggle("active", link.getAttribute("href") === `#${currentId}`);
  });
}
window.addEventListener("scroll", onScroll, { passive: true });

// Animasi muncul saat di-scroll
function setupReveal() {
  const items = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) {
    items.forEach((item) => item.classList.add("visible"));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  items.forEach((item) => observer.observe(item));
}

/* ---------- 11. Inisialisasi ---------- */
document.addEventListener("DOMContentLoaded", () => {
  el.favCount.textContent = state.favorites.length;
  setupReveal();
  onScroll();
  fetchCars();
});