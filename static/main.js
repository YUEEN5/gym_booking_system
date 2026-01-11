let selectedDate = null;
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();

// 30-minute time list for trainer slot creation
const ALL_TIMES = [
  "07:00","07:30","08:00","08:30","09:00","09:30",
  "10:00","10:30","11:00","11:30","12:00","12:30",
  "13:00","13:30","14:00","14:30","15:00","15:30",
  "16:00","16:30","17:00","17:30","18:00","18:30",
  "19:00","19:30","20:00","20:30","21:00","21:30"
];

function timeToMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

// ----------------- CALENDAR -----------------
async function buildCalendar(trainerId="me", isTrainer=true) {
  const cal = document.getElementById("calendar");
  const title = document.getElementById("monthTitle");
  title.innerText = `${new Date(currentYear, currentMonth).toLocaleString("default",{month:"long"})} ${currentYear}`;
  cal.innerHTML = "";

  // Fetch month-level slot status
  const res = await fetch(`/get_month_status?trainer=${trainerId}&year=${currentYear}&month=${currentMonth+1}`);
  const statusData = await res.json(); // { "2026-01-11":"green", ... }

  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const days = new Date(currentYear, currentMonth + 1, 0).getDate();
  const today = new Date().setHours(0,0,0,0);

  // Empty boxes before first day
  for (let i = 0; i < firstDay; i++) cal.innerHTML += `<div></div>`;

  for (let d = 1; d <= days; d++) {
    const dateObj = new Date(currentYear, currentMonth, d);
    const iso = dateObj.toISOString().split("T")[0];

    let colorClass = "grey"; // default
    if (statusData[iso]) colorClass = statusData[iso];
    if (dateObj < today) colorClass = "past"; // black past

    let clickable = false;
    if (dateObj >= today) {
      clickable = isTrainer || colorClass === "green" || colorClass === "red";
    }

    cal.innerHTML += `
      <div class="day ${colorClass}" ${clickable ? `onclick="selectDate('${iso}','${trainerId}')" ` : ""}>
        <div class="day-number">${d}</div>
      </div>
    `;
  }
}

function nextMonth(trainerId="me", isTrainer=true) {
  currentMonth++;
  if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  buildCalendar(trainerId, isTrainer);
}

function prevMonth(trainerId="me", isTrainer=true) {
  const today = new Date();
  if (currentYear < today.getFullYear() || (currentYear === today.getFullYear() && currentMonth <= today.getMonth())) return;
  currentMonth--;
  if (currentMonth < 0) { currentMonth = 11; currentYear--; }
  buildCalendar(trainerId, isTrainer);
}

// ----------------- SLOT VIEW -----------------
function selectDate(date, trainerId="me") {
  selectedDate = date;
  document.getElementById("selectedDateTitle").innerText = "Set Availability for " + date;
  document.getElementById("calendarCard").style.display = "none";
  document.getElementById("slotCard").style.display = "block";

  if (document.getElementById("start")) updateEndTimes();
  loadSlots(trainerId);
}

function goBack(trainerId="me") {
  selectedDate = null;
  document.getElementById("slotCard").style.display = "none";
  document.getElementById("calendarCard").style.display = "block";
  buildCalendar(trainerId, true);
}

// ----------------- DYNAMIC END TIME -----------------
function updateEndTimes() {
  const startSelect = document.getElementById("start");
  const endSelect = document.getElementById("end");
  const startMinutes = timeToMinutes(startSelect.value);
  endSelect.innerHTML = "";
  ALL_TIMES.forEach(t => {
    if (timeToMinutes(t) >= startMinutes + 60) {
      const opt = document.createElement("option");
      opt.value = t;
      opt.textContent = t;
      endSelect.appendChild(opt);
    }
  });
}

// ----------------- CREATE SLOTS -----------------
async function createSlots() {
  if (!selectedDate) return alert("Select a date");
  const start = document.getElementById("start").value;
  const end = document.getElementById("end").value;
  if (timeToMinutes(end)-timeToMinutes(start) < 60) return alert("End must be at least 1 hour after start");

  await fetch("/create_slots", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({date:selectedDate,start,end})
  });

  loadSlots("me");
}

// ----------------- LOAD SLOTS -----------------
async function loadSlots(trainerId="me") {
  const trainerParam = trainerId === "me" && document.getElementById("trainer") ? document.getElementById("trainer").value : trainerId;
  const res = await fetch(`/get_slots?trainer=${trainerParam}&date=${selectedDate}`);
  const data = await res.json();
  const slotContainer = document.getElementById("slots");

  if (!data || data.length===0) {
    slotContainer.innerHTML = `<div class="slot grey">No slots</div>`;
    return;
  }

  slotContainer.innerHTML = data.map(s => {
    const cls = s[2] ? "red" : "green";
    const label = s[2] ? `Booked by ${s[3] || ''}` : "Available";
    return `<div class="slot ${cls}"><strong>${s[1]}</strong> <span>${label}</span></div>`;
  }).join("");
}

// ----------------- INITIALIZATION -----------------
if (document.getElementById("start")) document.getElementById("start").addEventListener("change", updateEndTimes);

buildCalendar("me", true); // trainer default
