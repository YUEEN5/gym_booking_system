let selectedDate = null;
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();

// ----------------- CALENDAR -----------------
async function buildCalendar(trainerId, isTrainer=false) {
  const cal = document.getElementById("calendar");
  const title = document.getElementById("monthTitle");
  title.innerText = `${new Date(currentYear, currentMonth).toLocaleString("default",{month:"long"})} ${currentYear}`;
  cal.innerHTML = "";

  // Fetch month status
  const res = await fetch(`/get_month_status?trainer=${trainerId}&year=${currentYear}&month=${currentMonth+1}`);
  const statusData = await res.json();

  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const days = new Date(currentYear, currentMonth+1, 0).getDate();
  const today = new Date().setHours(0,0,0,0);

  for(let i=0;i<firstDay;i++) cal.innerHTML += `<div></div>`;

  for(let d=1; d<=days; d++){
    const dateObj = new Date(currentYear,currentMonth,d);
    const iso = dateObj.toISOString().split("T")[0];

    let colorClass = "grey";
    if (statusData[iso]) colorClass = statusData[iso];
    if (dateObj < today) colorClass = "past";

    let clickable = false;
    if(dateObj >= today){
      clickable = isTrainer || colorClass === "green" || colorClass === "red";
    }

    cal.innerHTML += `<div class="day ${colorClass}" ${clickable?`onclick="selectDate('${iso}','${trainerId}')"`:""}><div class="day-number">${d}</div></div>`;
  }
}

function nextMonth(trainerId) {currentMonth++; if(currentMonth>11){currentMonth=0;currentYear++;} buildCalendar(trainerId);}
function prevMonth(trainerId) {const today = new Date(); if(currentYear<today.getFullYear()||(currentYear===today.getFullYear()&&currentMonth<=today.getMonth())) return; currentMonth--; if(currentMonth<0){currentMonth=11;currentYear--;} buildCalendar(trainerId);}

// ----------------- SLOT VIEW -----------------
function selectDate(date, trainerId){
  selectedDate = date;
  document.getElementById("selectedDateTitle").innerText = "Available Slots for " + date;
  document.getElementById("calendarCard").style.display = "none";
  document.getElementById("slotCard").style.display = "block";
  loadSlots(trainerId);
}

function goBack(trainerId){
  selectedDate = null;
  document.getElementById("slotCard").style.display = "none";
  document.getElementById("calendarCard").style.display = "block";
  buildCalendar(trainerId);
}

// ----------------- LOAD SLOTS -----------------
async function loadSlots(trainerId){
  const trainerParam = trainerId === "me" && document.getElementById("trainer") ? document.getElementById("trainer").value : trainerId;
  const res = await fetch(`/get_slots?trainer=${trainerParam}&date=${selectedDate}`);
  const data = await res.json();
  const slotContainer = document.getElementById("slots");

  if(!data || data.length===0){
    slotContainer.innerHTML = `<div class="slot grey">No availability</div>`;
    return;
  }

  slotContainer.innerHTML = data.map(s=>{
    const cls = s[2] ? "red" : "green";
    let html = `<div class="slot ${cls}"><strong>${s[1]}</strong>`;
    if(!s[2]) html += ` <button onclick="book(${s[0]})">Book</button>`;
    if(s[2]) html += ` <span>Booked</span>`;
    html += `</div>`;
    return html;
  }).join("");
}

// ----------------- BOOK SLOT -----------------
async function book(slotId){
  await fetch("/book",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({slot:slotId})
  });
  loadSlots(document.getElementById("trainer").value);
}

// ----------------- INITIALIZATION -----------------
async function loadTrainers(){
  const res = await fetch("/trainers");
  const data = await res.json();
  const trainerSelect = document.getElementById("trainer");
  trainerSelect.innerHTML = data.map(t=>`<option value="${t[0]}">${t[1]}</option>`).join("");

  trainerSelect.addEventListener("change",()=>{buildCalendar(trainerSelect.value);});
  if(data.length>0) buildCalendar(trainerSelect.value);
}

loadTrainers();
