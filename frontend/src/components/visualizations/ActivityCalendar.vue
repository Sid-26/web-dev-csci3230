<script setup>
import { onMounted, ref, watch, nextTick, computed } from "vue";
import * as d3 from "d3";
import { getNotes, buildCalendarData } from "../../services/api.js";
import { useTheme } from "../../composables/useTheme.js";

const { isDark } = useTheme();

const svgRef = ref(null);
const containerRef = ref(null);
const loading = ref(true);
const error = ref(null);
const viewMode = ref("year");
const selectedYear = ref(new Date().getFullYear());
const selectedMonth = ref(new Date().getMonth());
const hoveredDay = ref(null);
const tooltipX = ref(0);
const tooltipY = ref(0);

const streakCount = ref(0);
const totalNotes = ref(0);
const activeDays = ref(0);
const maxPerDay = ref(0);

let calendarData = {};
let maxActivityCount = 1;

const CELL_PAD = 3;

function getCellSize() {
  if (!containerRef.value) return 18;
  const availableWidth = containerRef.value.clientWidth - 60;
  const totalWeeks = 53;
  const computed = Math.floor(availableWidth / totalWeeks) - CELL_PAD;
  return Math.max(12, Math.min(computed, 28));
}

const activityScale = computed(() =>
  d3.scaleSequential(d3.interpolateBlues).domain([0, maxPerDay.value]),
);

const emptyColor = computed(() => (isDark.value ? "#1e293b" : "#e2e8f0"));

function getCellColor(key) {
  if (!calendarData[key]) return emptyColor.value;
  return activityScale.value(calendarData[key].count);
}

async function loadAndDraw() {
  try {
    loading.value = true;
    const notes = await getNotes();
    calendarData = buildCalendarData(notes);
    totalNotes.value = notes.length;
    activeDays.value = Object.keys(calendarData).length;
    maxActivityCount = Math.max(
      ...Object.values(calendarData).map((d) => d.count),
      1,
    );
    maxPerDay.value = maxActivityCount;
    computeStreak();
    loading.value = false;
    await nextTick();
    draw();
  } catch (e) {
    error.value = e.message;
    loading.value = false;
  }
}

function computeStreak() {
  const dates = Object.keys(calendarData).sort();
  let maxStreak = 0,
    curr = 0;
  for (let i = 0; i < dates.length; i++) {
    if (i === 0) {
      curr = 1;
      maxStreak = Math.max(maxStreak, curr);
      continue;
    }
    const diff = (new Date(dates[i]) - new Date(dates[i - 1])) / 86400000;
    curr = diff === 1 ? curr + 1 : 1;
    maxStreak = Math.max(maxStreak, curr);
  }
  streakCount.value = maxStreak;
}

function draw() {
  if (!svgRef.value) return;
  d3.select(svgRef.value).selectAll("*").remove();
  viewMode.value === "year" ? drawYear() : drawMonth();
}

function drawYear() {
  const CELL_SIZE = getCellSize();
  const year = selectedYear.value;
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);
  const days = d3.timeDays(startDate, d3.timeDay.offset(endDate, 1));
  const weekOffset = startDate.getDay();
  const totalWeeks = Math.ceil((days.length + weekOffset) / 7);
  const marginLeft = 28,
    marginTop = 24;
  const width = marginLeft + totalWeeks * (CELL_SIZE + CELL_PAD) + 20;
  const height = marginTop + 7 * (CELL_SIZE + CELL_PAD) + 30;
  const svg = d3
    .select(svgRef.value)
    .attr("width", width)
    .attr("height", height);
  const g = svg
    .append("g")
    .attr("transform", `translate(${marginLeft},${marginTop})`);

  const months = d3.timeMonths(startDate, d3.timeMonth.offset(endDate, 1));
  g.selectAll(".month-label")
    .data(months)
    .join("text")
    .attr("class", "month-label")
    .attr(
      "x",
      (d) => d3.timeWeek.count(d3.timeYear(d), d) * (CELL_SIZE + CELL_PAD),
    )
    .attr("y", -6)
    .text((d) => d3.timeFormat("%b")(d))
    .style("font-size", "11px")
    .style("fill", cssVar("--text-muted"));

  g.selectAll(".dow-label")
    .data(["S", "M", "T", "W", "T", "F", "S"])
    .join("text")
    .attr("class", "dow-label")
    .attr("x", -14)
    .attr("y", (d, i) => i * (CELL_SIZE + CELL_PAD) + CELL_SIZE - 2)
    .text((d) => d)
    .style("font-size", "9px")
    .style("fill", cssVar("--text-dim"));

  g.selectAll(".day")
    .data(days)
    .join("rect")
    .attr("class", "day")
    .attr("width", CELL_SIZE)
    .attr("height", CELL_SIZE)
    .attr("rx", 2)
    .attr(
      "x",
      (d) => d3.timeWeek.count(d3.timeYear(d), d) * (CELL_SIZE + CELL_PAD),
    )
    .attr("y", (d) => d.getDay() * (CELL_SIZE + CELL_PAD))
    .attr("fill", (d) => getCellColor(d3.timeFormat("%Y-%m-%d")(d)))
    .attr("cursor", (d) =>
      calendarData[d3.timeFormat("%Y-%m-%d")(d)] ? "pointer" : "default",
    )
    .on("mouseover", (event, d) => {
      const key = d3.timeFormat("%Y-%m-%d")(d);
      if (calendarData[key]) {
        hoveredDay.value = { date: key, ...calendarData[key] };
        tooltipX.value = event.pageX + 12;
        tooltipY.value = event.pageY - 28;
      }
    })
    .on("mousemove", (event) => {
      tooltipX.value = event.pageX + 12;
      tooltipY.value = event.pageY - 28;
    })
    .on("mouseout", () => {
      hoveredDay.value = null;
    });
}

function drawMonth() {
  const year = selectedYear.value;
  const month = selectedMonth.value;
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0);
  const days = d3.timeDays(startDate, d3.timeDay.offset(endDate, 1));
  const LARGE = 36,
    PAD = 4;
  const startDow = startDate.getDay();
  const cols = 7;
  const rows = Math.ceil((days.length + startDow) / 7);
  const marginLeft = 30,
    marginTop = 30;
  const width = marginLeft + cols * (LARGE + PAD) + 20;
  const height = marginTop + rows * (LARGE + PAD) + 20;
  const svg = d3
    .select(svgRef.value)
    .attr("width", width)
    .attr("height", height);
  const g = svg
    .append("g")
    .attr("transform", `translate(${marginLeft},${marginTop})`);

  g.selectAll(".dow-label")
    .data(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"])
    .join("text")
    .attr("x", (d, i) => i * (LARGE + PAD) + LARGE / 2)
    .attr("y", -8)
    .attr("text-anchor", "middle")
    .text((d) => d)
    .style("font-size", "10px")
    .style("fill", cssVar("--text-muted"));

  g.selectAll(".day")
    .data(days)
    .join("rect")
    .attr("width", LARGE)
    .attr("height", LARGE)
    .attr("rx", 4)
    .attr("x", (d) => d.getDay() * (LARGE + PAD))
    .attr(
      "y",
      (d) => Math.floor((d.getDate() - 1 + startDow) / 7) * (LARGE + PAD),
    )
    .attr("fill", (d) => getCellColor(d3.timeFormat("%Y-%m-%d")(d)))
    .attr("cursor", (d) =>
      calendarData[d3.timeFormat("%Y-%m-%d")(d)] ? "pointer" : "default",
    )
    .on("mouseover", (event, d) => {
      const key = d3.timeFormat("%Y-%m-%d")(d);
      if (calendarData[key]) {
        hoveredDay.value = { date: key, ...calendarData[key] };
        tooltipX.value = event.pageX + 12;
        tooltipY.value = event.pageY - 28;
      }
    })
    .on("mousemove", (event) => {
      tooltipX.value = event.pageX + 12;
      tooltipY.value = event.pageY - 28;
    })
    .on("mouseout", () => {
      hoveredDay.value = null;
    });

  g.selectAll(".day-num")
    .data(days)
    .join("text")
    .attr("x", (d) => d.getDay() * (LARGE + PAD) + 4)
    .attr(
      "y",
      (d) => Math.floor((d.getDate() - 1 + startDow) / 7) * (LARGE + PAD) + 14,
    )
    .text((d) => d.getDate())
    .style("font-size", "10px")
    .style("fill", cssVar("--text-dim"))
    .style("pointer-events", "none");
}

const monthNames = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function cssVar(name) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

watch([viewMode, selectedYear, selectedMonth, isDark], () => draw());
onMounted(() => loadAndDraw());
</script>

<template>
  <div class="flex flex-col h-full bg-c-bg text-c-text p-4">
    <!-- Header -->
    <div class="flex flex-wrap items-center gap-4 mb-6">
      <h2 class="text-lg font-semibold text-c-text">Writing Activity</h2>

      <!-- View toggle -->
      <div class="flex rounded-lg overflow-hidden border border-c-border">
        <button
          @click="viewMode = 'year'"
          :class="
            viewMode === 'year'
              ? 'bg-c-surface-hover text-c-text'
              : 'bg-c-surface text-c-text-muted hover:text-c-text'
          "
          class="px-3 py-1.5 text-sm transition"
        >
          Year
        </button>
        <button
          @click="viewMode = 'month'"
          :class="
            viewMode === 'month'
              ? 'bg-c-surface-hover text-c-text'
              : 'bg-c-surface text-c-text-muted hover:text-c-text'
          "
          class="px-3 py-1.5 text-sm transition"
        >
          Month
        </button>
      </div>

      <!-- Year selector -->
      <div class="flex items-center gap-2">
        <button
          @click="selectedYear--"
          class="text-c-text-muted hover:text-c-text px-2"
        >
          ‹
        </button>
        <span class="text-sm font-medium w-12 text-center">{{
          selectedYear
        }}</span>
        <button
          @click="selectedYear++"
          class="text-c-text-muted hover:text-c-text px-2"
        >
          ›
        </button>
      </div>

      <!-- Month selector -->
      <div v-if="viewMode === 'month'" class="flex items-center gap-2">
        <button
          @click="selectedMonth = (selectedMonth - 1 + 12) % 12"
          class="text-c-text-muted hover:text-c-text px-2"
        >
          ‹
        </button>
        <span class="text-sm font-medium w-8 text-center">{{
          monthNames[selectedMonth]
        }}</span>
        <button
          @click="selectedMonth = (selectedMonth + 1) % 12"
          class="text-c-text-muted hover:text-c-text px-2"
        >
          ›
        </button>
      </div>

      <!-- Stats -->
      <div class="ml-auto flex gap-6 text-sm text-c-text-muted">
        <div>
          Longest streak
          <span class="text-c-text font-semibold">{{ streakCount }}d</span>
        </div>
        <div>
          Active days
          <span class="text-c-text font-semibold">{{ activeDays }}</span>
        </div>
        <div>
          Max per day
          <span class="text-blue-400 font-semibold">{{ maxPerDay }}</span>
        </div>
        <div>
          Total notes
          <span class="text-c-text font-semibold">{{ totalNotes }}</span>
        </div>
      </div>
    </div>

    <!-- Calendar SVG -->
    <div
      v-if="loading"
      class="flex-1 flex items-center justify-center text-c-text-muted"
    >
      Loading…
    </div>
    <div
      v-else-if="error"
      class="flex-1 flex items-center justify-center text-red-400"
    >
      {{ error }}
    </div>
    <div
      v-else
      ref="containerRef"
      class="flex-1 flex items-center justify-center overflow-x-auto"
    >
      <svg ref="svgRef" />
    </div>

    <!-- Legend -->
    <div class="flex items-center gap-3 mt-4 text-xs text-c-text-muted">
      <span>Less</span>
      <div class="flex gap-0.5">
        <div
          v-for="v in [0, 0.25, 0.5, 0.75, 1]"
          :key="v"
          class="w-5 h-3 rounded-sm"
          :style="{ background: activityScale(v * maxPerDay) }"
        />
      </div>
      <span>More</span>
      <div
        class="ml-4 w-5 h-3 rounded-sm"
        :style="{ background: emptyColor }"
      />
      <span>No notes</span>
    </div>

    <!-- Tooltip -->
    <Teleport to="body">
      <div
        v-if="hoveredDay"
        class="fixed z-50 pointer-events-none bg-c-surface border border-c-border rounded-lg shadow-xl p-3 text-sm max-w-xs"
        :style="{ left: tooltipX + 'px', top: tooltipY + 'px' }"
      >
        <p class="font-semibold text-c-text mb-2">{{ hoveredDay.date }}</p>
        <p class="text-blue-400 text-xs font-semibold mb-2">
          {{ hoveredDay.count }} note{{ hoveredDay.count > 1 ? "s" : "" }}
        </p>
        <ul class="text-c-text-muted text-xs space-y-1">
          <li v-for="n in hoveredDay.notes" :key="n.id">{{ n.title }}</li>
        </ul>
      </div>
    </Teleport>
  </div>
</template>
