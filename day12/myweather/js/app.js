const API_URL = "https://api.open-meteo.com/v1/forecast";
const CURRENT_FIELDS = "temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,precipitation,weather_code";
const DAILY_FIELDS = "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_direction_10m_dominant";

const DIRECTIONS = ["북", "북동", "동", "남동", "남", "남서", "서", "북서"];
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const RAIN_PROBABILITY_MIN = 30;

// WMO 날씨 코드 → 설명, 아이콘, 색상 그룹
const WEATHER_TYPES = [
    { codes: [0], label: "맑음", icon: "bi-sun", group: "sunny" },
    { codes: [1, 2], label: "구름 조금", icon: "bi-cloud-sun", group: "sunny" },
    { codes: [3], label: "흐림", icon: "bi-clouds", group: "cloudy" },
    { codes: [45, 48], label: "안개", icon: "bi-cloud-fog", group: "cloudy" },
    { codes: [51, 53, 55, 56, 57], label: "이슬비", icon: "bi-cloud-drizzle", group: "rainy" },
    { codes: [61, 63, 65, 66, 67], label: "비", icon: "bi-cloud-rain", group: "rainy" },
    { codes: [71, 73, 75, 77], label: "눈", icon: "bi-cloud-snow", group: "rainy" },
    { codes: [80, 81, 82], label: "소나기", icon: "bi-cloud-rain-heavy", group: "rainy" },
    { codes: [85, 86], label: "눈 소나기", icon: "bi-cloud-snow", group: "rainy" },
    { codes: [95, 96, 99], label: "뇌우", icon: "bi-cloud-lightning-rain", group: "storm" }
];
const DEFAULT_WEATHER = WEATHER_TYPES[2];
const SNOW_CODES = [71, 73, 75, 77, 85, 86];

const grid = document.getElementById("cityGrid");
const loading = document.getElementById("loading");
const errorBox = document.getElementById("errorBox");
const emptyMessage = document.getElementById("emptyMessage");
const updatedAt = document.getElementById("updatedAt");
const searchInput = document.getElementById("searchInput");
const refreshBtn = document.getElementById("refreshBtn");
const forecastModal = new bootstrap.Modal(document.getElementById("forecastModal"));

let weatherList = [];
let currentGroup = "korea";

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

function icon(name, extraClass) {
    const node = el("i", "bi " + name + (extraClass ? " " + extraClass : ""));
    node.setAttribute("aria-hidden", "true");
    return node;
}

function getWeatherType(code) {
    return WEATHER_TYPES.find(type => type.codes.includes(code)) || DEFAULT_WEATHER;
}

function toDirection(deg) {
    return DIRECTIONS[Math.round(deg / 45) % 8];
}

function isRainy(sum, probability) {
    return sum > 0 || probability >= RAIN_PROBABILITY_MIN;
}

// 강수확률과 강수량을 "70% · 4.2 mm" 형태로 만든다. 없는 값은 뺀다.
function formatRain(sum, probability) {
    const parts = [];
    if (probability !== null && probability !== undefined) parts.push(probability + "%");
    if (sum > 0) parts.push(sum.toFixed(1) + " mm");
    return parts.join(" · ");
}

function buildUrl() {
    const params = new URLSearchParams({
        latitude: CITIES.map(city => city.lat).join(","),
        longitude: CITIES.map(city => city.lon).join(","),
        current: CURRENT_FIELDS,
        daily: DAILY_FIELDS,
        wind_speed_unit: "kmh",
        timezone: "auto",
        forecast_days: "7"
    });
    return API_URL + "?" + params.toString();
}

async function loadWeather() {
    loading.classList.remove("d-none");
    errorBox.classList.add("d-none");
    errorBox.classList.remove("d-flex");
    refreshBtn.disabled = true;

    try {
        const response = await fetch(buildUrl());
        if (!response.ok) throw new Error("HTTP " + response.status);
        const data = await response.json();
        // 도시가 하나뿐이면 배열이 아닌 객체로 응답한다
        weatherList = Array.isArray(data) ? data : [data];
        updatedAt.textContent = "마지막 갱신: " + new Date().toLocaleTimeString("ko-KR");
        renderCards();
    } catch (error) {
        console.error(error);
        errorBox.classList.remove("d-none");
        errorBox.classList.add("d-flex");
    } finally {
        loading.classList.add("d-none");
        refreshBtn.disabled = false;
    }
}

function createCard(city, weather, index) {
    const current = weather.current;
    const daily = weather.daily;
    const type = getWeatherType(current.weather_code);

    const col = el("div", "col");
    const card = el("div", "city-card weather-" + type.group);
    card.dataset.index = index;
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-label", city.name + " 7일 예보 보기");

    const head = el("div", "d-flex justify-content-between align-items-center");
    head.append(el("span", "city-name", city.name));
    const chip = el("span", "weather-chip");
    chip.title = type.label;
    chip.append(icon(type.icon));
    head.append(chip);

    const wind = el("div", "city-meta");
    wind.append(
        icon("bi-wind", "icon-wind"),
        el("span", "", Math.round(current.wind_speed_10m) + " km/h · " + toDirection(current.wind_direction_10m))
    );

    const humidity = el("div", "city-meta");
    humidity.append(
        icon("bi-droplet", "icon-humidity"),
        el("span", "", "습도 " + current.relative_humidity_2m + "%")
    );

    card.append(head, el("div", "city-temp", Math.round(current.temperature_2m) + "°"), wind, humidity);

    const rainSum = daily.precipitation_sum[0];
    const rainProbability = daily.precipitation_probability_max[0];
    if (isRainy(rainSum, rainProbability)) {
        const word = SNOW_CODES.includes(daily.weather_code[0]) ? "눈" : "비";
        card.append(el("span", "rain-badge", word + " " + formatRain(rainSum, rainProbability)));
    }

    col.append(card);
    return col;
}

function renderCards() {
    const keyword = searchInput.value.trim().toLowerCase();
    grid.replaceChildren();

    CITIES.forEach((city, index) => {
        const weather = weatherList[index];
        if (!weather || city.group !== currentGroup) return;
        if (keyword && !city.name.toLowerCase().includes(keyword)) return;
        grid.append(createCard(city, weather, index));
    });

    const isEmpty = weatherList.length > 0 && grid.children.length === 0;
    emptyMessage.classList.toggle("d-none", !isEmpty);
}

function dayLabel(dateText, index) {
    if (index === 0) return "오늘";
    // "2026-10-06"을 그대로 Date에 넘기면 UTC로 해석되어 요일이 밀릴 수 있다
    const [year, month, day] = dateText.split("-").map(Number);
    return WEEKDAYS[new Date(year, month - 1, day).getDay()];
}

function createForecastRow(daily, index) {
    const type = getWeatherType(daily.weather_code[index]);
    const row = el("tr", "weather-" + type.group);

    const weatherCell = el("td");
    weatherCell.append(icon(type.icon, "forecast-icon"), el("span", "weather-label", type.label));

    const tempCell = el("td");
    tempCell.append(
        el("span", "temp-low", Math.round(daily.temperature_2m_min[index]) + "°"),
        " / ",
        el("span", "temp-high", Math.round(daily.temperature_2m_max[index]) + "°")
    );

    const rainSum = daily.precipitation_sum[index];
    const rainProbability = daily.precipitation_probability_max[index];
    const rainCell = el("td");
    if (isRainy(rainSum, rainProbability)) {
        rainCell.append(el("span", "rain-badge", formatRain(rainSum, rainProbability)));
    } else {
        rainCell.append(el("span", "text-secondary", formatRain(0, rainProbability) || "-"));
    }

    const windCell = el("td", "text-secondary");
    windCell.append(
        Math.round(daily.wind_speed_10m_max[index]) + " km/h",
        el("span", "wind-dir", " " + toDirection(daily.wind_direction_10m_dominant[index]))
    );

    row.append(el("td", "", dayLabel(daily.time[index], index)), weatherCell, tempCell, rainCell, windCell);
    return row;
}

function openForecast(index) {
    const city = CITIES[index];
    const weather = weatherList[index];
    const current = weather.current;
    const type = getWeatherType(current.weather_code);

    document.getElementById("forecastTitle").textContent = city.name + " · 7일 예보";
    const chip = document.getElementById("forecastIcon");
    chip.className = "weather-chip weather-" + type.group;
    chip.replaceChildren(icon(type.icon));

    document.getElementById("summaryTemp").textContent = Math.round(current.temperature_2m) + "°C";
    document.getElementById("summaryWind").textContent = Math.round(current.wind_speed_10m) + " km/h";
    document.getElementById("summaryDir").textContent = toDirection(current.wind_direction_10m);
    document.getElementById("summaryHumidity").textContent = current.relative_humidity_2m + "%";

    const body = document.getElementById("forecastBody");
    body.replaceChildren(...weather.daily.time.map((_, i) => createForecastRow(weather.daily, i)));

    forecastModal.show();
}

document.getElementById("groupTabs").addEventListener("click", event => {
    const tab = event.target.closest("[data-group]");
    if (!tab) return;
    currentGroup = tab.dataset.group;
    document.querySelectorAll("#groupTabs .nav-link").forEach(link => {
        link.classList.toggle("active", link === tab);
    });
    renderCards();
});

grid.addEventListener("click", event => {
    const card = event.target.closest(".city-card");
    if (card) openForecast(Number(card.dataset.index));
});

grid.addEventListener("keydown", event => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const card = event.target.closest(".city-card");
    if (!card) return;
    event.preventDefault();
    openForecast(Number(card.dataset.index));
});

searchInput.addEventListener("input", renderCards);
refreshBtn.addEventListener("click", loadWeather);
document.getElementById("retryBtn").addEventListener("click", loadWeather);

loadWeather();
