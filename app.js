const PROGRAMS = {
  mm_piano_performance: {
    label: "Piano Performance",
    shortLabel: "Piano Performance",
  },
  mm_collaborative_piano: {
    label: "Collaborative Piano",
    shortLabel: "Collaborative Piano",
  },
};

const FIELD_DEFINITIONS = [
  ["auditionRequirements", "Audition Requirements"],
  ["deadlines", "Deadlines"],
  ["englishScores", "English Scores"],
];

const APPLICATION_FIELD_DEFINITIONS = [
  ["applicationPortal", "Application Portal"],
  ["applicationFee", "Application Fee"],
];

const ALL_FIELD_DEFINITIONS = [
  ...APPLICATION_FIELD_DEFINITIONS,
  ...FIELD_DEFINITIONS,
  ["repertoireRequirements", "Repertoire Requirements"],
];

const STATUS_LABELS = {
  not_started: "Not started",
  needs_review: "Needs review",
  verified: "Verified",
};

const STATUS_CLASS = {
  not_started: "not-started",
  needs_review: "needs-review",
  verified: "verified",
};

const DATA_VERSION = "2026-05-25-university-of-georgia-audit-v44";

const state = {
  data: null,
  rows: [],
  selectedId: null,
  activeProgram: "mm_piano_performance",
  filters: {
    search: "",
  },
};

const els = {
  dataDate: document.querySelector("#dataDate"),
  schoolSelect: document.querySelector("#schoolSelect"),
  searchInput: document.querySelector("#searchInput"),
  detail: document.querySelector("#schoolDetail"),
};

init();

async function init() {
  try {
    const response = await fetch(`./data/schools.json?v=${DATA_VERSION}`, {
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.data = await response.json();
    state.rows = normalizeSchools(state.data.schools);
    state.selectedId = state.rows[0]?.id ?? null;
    bindEvents();
    render();
  } catch (error) {
    els.dataDate.textContent = "Data unavailable";
    els.detail.innerHTML = `<h2>Data load failed</h2><p>${escapeHtml(error.message)}</p>`;
  }
}

function bindEvents() {
  els.searchInput.addEventListener("input", (event) => {
    state.filters.search = event.target.value.trim().toLowerCase();
    render();
  });

  els.schoolSelect.addEventListener("change", (event) => {
    state.selectedId = event.target.value;
    render();
  });
}

function normalizeSchools(schools) {
  return schools.map((school) => ({
    ...school,
    programTargets: school.programTargets?.length
      ? school.programTargets
      : ["mm_piano_performance", "mm_collaborative_piano"],
    sourceStatus: school.sourceStatus ?? "not_started",
    officialSources: school.officialSources ?? [],
    fields: school.fields ?? {},
  }));
}

function render() {
  const filtered = getFilteredRows();

  if (!filtered.some((school) => school.id === state.selectedId)) {
    state.selectedId = filtered[0]?.id ?? null;
  }

  renderMeta();
  renderSchoolSelect(filtered);
  renderDetail(state.rows.find((school) => school.id === state.selectedId));
}

function renderMeta() {
  const total = state.rows.length;
  const verified = state.rows.filter((school) => school.sourceStatus === "verified").length;
  els.dataDate.textContent = `Data date: ${state.data.meta.generatedAt} | ${verified}/${total} verified`;
}

function getFilteredRows() {
  const query = state.filters.search;
  const filtered = state.rows.filter((school) => {
    const haystack = `${school.name} ${school.city} ${school.state} ${school.control}`.toLowerCase();
    return !query || haystack.includes(query);
  });

  return filtered.sort((a, b) => compare(a.name, b.name));
}

function renderSchoolSelect(rows) {
  if (!rows.length) {
    els.schoolSelect.innerHTML = `<option value="">No matching schools</option>`;
    els.schoolSelect.disabled = true;
    return;
  }

  els.schoolSelect.disabled = false;
  els.schoolSelect.innerHTML = rows
    .map((school) => {
      const meta = `${school.city}, ${school.state} | ${school.control}`;
      return `<option value="${escapeAttribute(school.id)}">${escapeHtml(school.name)} - ${escapeHtml(meta)}</option>`;
    })
    .join("");
  els.schoolSelect.value = state.selectedId;
}

function renderDetail(school) {
  if (!school) {
    els.detail.className = "detail-empty";
    els.detail.innerHTML = `
      <h2>No matches</h2>
      <p>Try another school, city, state, or type.</p>
    `;
    return;
  }

  els.detail.className = "detail-content";
  const program = school.programTargets.includes(state.activeProgram)
    ? state.activeProgram
    : school.programTargets[0];
  state.activeProgram = program;
  const fieldRecords = getProgramFields(school, program);
  const sourceLinks = renderSources(school.officialSources);
  const query = buildResearchQuery(school, program);
  const repertoireCard = renderField("Repertoire Requirements", fieldRecords.repertoireRequirements);
  const applicationCard = renderApplicationField(fieldRecords.applicationPortal, fieldRecords.applicationFee);

  els.detail.innerHTML = `
    <div class="detail-title">
      <div>
        <h2>${escapeHtml(school.name)}</h2>
        <div class="detail-meta">${escapeHtml(school.city)}, ${escapeHtml(school.state)} | ${school.control}</div>
      </div>
    </div>

    <div class="program-tabs" role="tablist" aria-label="Program">
      ${school.programTargets
        .map(
          (item) => `
            <button class="program-tab ${item === program ? "active" : ""}" type="button" data-program="${item}">
              ${PROGRAMS[item]?.shortLabel ?? item}
            </button>
          `,
        )
        .join("")}
    </div>

    ${repertoireCard}

    <div class="field-grid">
      ${applicationCard}
      ${FIELD_DEFINITIONS.map(([key, label]) => renderField(label, fieldRecords[key])).join("")}
    </div>

    <section class="field-card source-card">
      <header>
        <h3>Official Sources</h3>
        ${statusBadge(school.sourceStatus)}
      </header>
      <div class="source-list">${sourceLinks}</div>
    </section>

    <div class="detail-actions">
      <button class="copy-query" type="button" data-copy-query="${escapeHtml(query)}">Copy official search query</button>
    </div>
  `;

  [...document.querySelectorAll(".program-tab")].forEach((button) => {
    button.addEventListener("click", () => {
      state.activeProgram = button.dataset.program;
      render();
    });
  });

  const copyButton = document.querySelector("[data-copy-query]");
  copyButton?.addEventListener("click", async () => {
    const value = copyButton.dataset.copyQuery;
    await navigator.clipboard.writeText(value);
    copyButton.textContent = "Copied";
    setTimeout(() => {
      copyButton.textContent = "Copy official search query";
    }, 1400);
  });
}

function getProgramFields(school, program) {
  const records = school.fields?.[program] ?? {};
  return Object.fromEntries(
    ALL_FIELD_DEFINITIONS.map(([key]) => [
      key,
      {
        value: records[key]?.value ?? "Pending official-source research. Use the school admission page, program page, application portal, or official PDF as the source of record.",
        status: records[key]?.status ?? school.sourceStatus ?? "not_started",
        retrievedAt: records[key]?.retrievedAt ?? null,
        sources: records[key]?.sources ?? [],
      },
    ]),
  );
}

function renderField(label, record) {
  const sources = renderSources(record.sources);
  const retrieved = record.retrievedAt
    ? `<p class="retrieved">Retrieved: ${escapeHtml(record.retrievedAt)}</p>`
    : "";
  const sourceNote =
    label === "Repertoire Requirements"
      ? `<p class="source-note">Official source linked below for line-by-line verification.</p>`
      : "";
  return `
    <section class="field-card ${label === "Repertoire Requirements" ? "repertoire-card" : ""}">
      <header>
        <h3>${escapeHtml(label)}</h3>
        ${statusBadge(record.status)}
      </header>
      <div class="field-value">${formatFieldValue(label, record.value)}</div>
      ${sourceNote}
      ${retrieved}
      <div class="source-list compact">${sources}</div>
    </section>
  `;
}

function renderApplicationField(portalRecord, feeRecord) {
  const combinedStatus = portalRecord.status === "verified" && feeRecord.status === "verified"
    ? "verified"
    : portalRecord.status === "needs_review" || feeRecord.status === "needs_review"
      ? "needs_review"
      : "not_started";
  const retrieved = portalRecord.retrievedAt || feeRecord.retrievedAt;
  const retrievedText = retrieved ? `<p class="retrieved">Retrieved: ${escapeHtml(retrieved)}</p>` : "";
  const sources = renderSources([...(portalRecord.sources ?? []), ...(feeRecord.sources ?? [])]);

  return `
    <section class="field-card application-card">
      <header>
        <h3>Application</h3>
        ${statusBadge(combinedStatus)}
      </header>
      <div class="subfield">
        <h4>Portal</h4>
        <div class="field-value">${formatFieldValue("Application Portal", portalRecord.value)}</div>
      </div>
      <div class="subfield">
        <h4>Fee</h4>
        <div class="field-value">${formatFieldValue("Application Fee", feeRecord.value)}</div>
      </div>
      ${retrievedText}
      <div class="source-list compact">${sources}</div>
    </section>
  `;
}

function formatFieldValue(label, value) {
  const text = String(value).trim();
  if (label === "Repertoire Requirements") return formatRepertoireValue(text);
  if (label === "English Scores") return formatEnglishScoresValue(text);

  const display = splitIntoDisplayItems(text);

  if (display.items.length <= 1 && !display.intro) {
    return `<p>${formatInlineText(label, text)}</p>`;
  }

  const intro = display.intro ? `<p class="field-intro">${formatInlineText(label, display.intro)}</p>` : "";
  const list = display.items.length
    ? `<ul>${display.items.map((item) => `<li>${formatInlineText(label, item)}</li>`).join("")}</ul>`
    : "";

  return `${intro}${list}`;
}

function formatEnglishScoresValue(text) {
  const sections = parseLabeledSections(text, [
    "Minimum scores",
    "Validity",
    "Timing",
    "Exemptions",
    "Notes",
    "Program note",
  ]);

  if (!sections.length) {
    const display = splitIntoDisplayItems(text);
    const intro = display.intro ? `<p class="field-intro">${escapeHtml(display.intro)}</p>` : "";
    const list = display.items.length
      ? `<ul>${display.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
      : "";
    return `${intro}${list || `<p>${escapeHtml(text)}</p>`}`;
  }

  return `
    <div class="structured-sections">
      ${sections
        .map(
          (section) => `
            <section class="structured-section">
              <h4>${escapeHtml(section.label)}</h4>
              ${renderStructuredSectionBody(section.value)}
            </section>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderStructuredSectionBody(value) {
  const items = splitByStrongSeparators(value);
  if (items.length <= 1) return `<p>${formatEnglishScoreText(value)}</p>`;

  return `<ul>${items.map((item) => `<li>${formatEnglishScoreText(item)}</li>`).join("")}</ul>`;
}

function parseLabeledSections(text, labels) {
  const escapedLabels = labels.map(escapeRegExp).join("|");
  const pattern = new RegExp(`\\b(${escapedLabels})\\s*:\\s*`, "gi");
  const matches = [...text.matchAll(pattern)];
  if (!matches.length) return [];

  const intro = text.slice(0, matches[0].index).trim().replace(/[.;]\s*$/, "");
  const sections = intro ? [{ label: "Overview", value: intro }] : [];

  matches.forEach((match, index) => {
    const start = match.index + match[0].length;
    const end = matches[index + 1]?.index ?? text.length;
    const value = text.slice(start, end).trim().replace(/^[.;]\s*/, "").replace(/[.;]\s*$/, "");
    if (value) sections.push({ label: match[1], value });
  });

  return sections;
}

function formatRepertoireValue(text) {
  const { intro, sections } = parseRepertoireSections(text);
  const introText = intro ? `<p class="field-intro">${escapeHtml(intro)}</p>` : "";

  return `
    ${introText}
    <div class="repertoire-sections">
      ${renderRepertoireSection("Prescreening", sections.prescreening)}
      ${renderRepertoireSection("Final Audition", sections.final)}
      ${renderRepertoireSection("Additional Repertoire Notes", sections.notes)}
    </div>
  `;
}

function renderRepertoireSection(title, items) {
  if (!items.length) return "";
  return `
    <section class="repertoire-section">
      <h4>${escapeHtml(title)}</h4>
      <ul class="repertoire-list">${items.map(renderRepertoireItem).join("")}</ul>
    </section>
  `;
}

function renderRepertoireItem(item) {
  const nested = parseNestedRequirement(item);
  if (!nested) return `<li>${escapeHtml(item)}</li>`;

  return `
    <li>
      <span class="repertoire-item-label">${escapeHtml(nested.label)}</span>
      <ul class="repertoire-subitems">
        ${nested.items.map((subitem) => `<li>${escapeHtml(subitem)}</li>`).join("")}
      </ul>
    </li>
  `;
}

function parseNestedRequirement(item) {
  const colonIndex = item.indexOf(":");
  if (colonIndex < 12 || colonIndex > 140) return null;

  const label = item.slice(0, colonIndex + 1).trim();
  const rest = item.slice(colonIndex + 1).trim();
  const options = splitByStrongSeparators(rest).map((option) => option.replace(/^or\s+/i, "").trim());

  if (options.length < 2) return null;
  if (!/(following|choose|chosen|include|including|options|selections|songs|works)/i.test(label)) return null;

  return { label, items: options };
}

function parseRepertoireSections(text) {
  const markerMatches = [...text.matchAll(repertoireMarkerRegex())];
  if (!markerMatches.length) {
    const display = splitIntoDisplayItems(text);
    return {
      intro: display.intro,
      sections: classifyRepertoireItems(display.intro, display.items),
    };
  }

  const sections = {
    prescreening: [],
    final: [],
    notes: [],
  };
  const intro = text.slice(0, markerMatches[0].index).trim().replace(/[.;]\s*$/, "");

  markerMatches.forEach((match, index) => {
    const marker = match[1];
    const start = match.index + match[0].length;
    const end = markerMatches[index + 1]?.index ?? text.length;
    const item = text.slice(start, end).trim().replace(/^[.;]\s*/, "").replace(/[.;]\s*$/, "");
    if (!item) return;
    sections[sectionFromRepertoireMarker(marker)].push(item);
  });

  return { intro, sections };
}

function repertoireMarkerRegex() {
  return /\b(Prescreening(?: requirements| repertoire)?|Pre-?screening(?: requirements| repertoire)?|Final audition(?: repertoire| requirements)?|Audition repertoire|Live audition(?: repertoire| requirements)?|Recorded audition(?: repertoire| requirements)?|Additional repertoire notes?)\s*:\s*/gi;
}

function sectionFromRepertoireMarker(marker) {
  if (/pre-?screen|prescreen/i.test(marker)) return "prescreening";
  if (/final audition|audition repertoire|live audition|recorded audition/i.test(marker)) return "final";
  return "notes";
}

function classifyRepertoireItems(intro, items) {
  const sections = {
    prescreening: [],
    final: [],
    notes: [],
  };
  let current = /pre-?screen/i.test(intro) ? "prescreening" : "";
  if (/final audition|audition repertoire|live audition/i.test(intro)) current = "final";

  for (const rawItem of items) {
    const parsed = parseRepertoireMarker(rawItem);
    if (parsed.section) current = parsed.section;
    const item = parsed.text.trim();
    if (!item) continue;

    if (!current) current = inferRepertoireSection(item);
    sections[current || "notes"].push(item);
  }

  return sections;
}

function parseRepertoireMarker(item) {
  const markers = [
    [/^(?:MM\s+)?(?:Piano\s+)?Pre-?screening(?: repertoire| requirements)?\s*:\s*/i, "prescreening"],
    [/^Prescreening\s*:\s*/i, "prescreening"],
    [/^Pre-?screening\s+/i, "prescreening"],
    [/^Final audition(?: repertoire| requirements)?\s*:\s*/i, "final"],
    [/^Final audition(?: repertoire| requirements)?\s+/i, "final"],
    [/^Audition repertoire\s*:\s*/i, "final"],
    [/^Audition repertoire\s+/i, "final"],
    [/^Audition\s*:\s*/i, "final"],
    [/^Live audition(?: repertoire| requirements)?\s*:\s*/i, "final"],
    [/^Live audition(?: repertoire| requirements)?\s+/i, "final"],
    [/^Recorded audition(?: repertoire| requirements)?\s*:\s*/i, "final"],
    [/^Recorded audition(?: repertoire| requirements)?\s+/i, "final"],
    [/^Additional repertoire notes?\s*:\s*/i, "notes"],
    [/^Additional repertoire notes?\s+/i, "notes"],
  ];

  for (const [pattern, section] of markers) {
    if (pattern.test(item)) return { section, text: item.replace(pattern, "") };
  }

  return { section: "", text: item };
}

function inferRepertoireSection(item) {
  if (/pre-?screen|prescreen/i.test(item)) return "prescreening";
  if (/final audition|audition repertoire|live audition|memorization|memorized|sonata|Bach|etude|aria|song|concerto|movement|work|piece|repertoire list/i.test(item)) return "final";
  return "notes";
}

function formatInlineText(label, text) {
  if (label !== "Deadlines") return escapeHtml(text);
  return highlightDates(text);
}

function highlightDates(text) {
  const datePattern =
    /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:,\s*\d{4})?\b|\b(?:Jan\.|Feb\.|Mar\.|Apr\.|Jun\.|Jul\.|Aug\.|Sept\.|Oct\.|Nov\.|Dec\.)\s+\d{1,2}(?:,\s*\d{4})?\b|\b(?:Fall|Spring|Summer)\s+\d{4}\b|\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g;
  let html = "";
  let lastIndex = 0;

  for (const match of text.matchAll(datePattern)) {
    html += escapeHtml(text.slice(lastIndex, match.index));
    html += `<span class="date-highlight">${escapeHtml(match[0])}</span>`;
    lastIndex = match.index + match[0].length;
  }

  html += escapeHtml(text.slice(lastIndex));
  return html;
}

function splitIntoDisplayItems(text) {
  if (text.length < 95) return { intro: "", items: [text] };

  const colonIndex = text.indexOf(":");
  if (colonIndex > 0 && colonIndex < 90) {
    const intro = text.slice(0, colonIndex + 1).trim();
    const rest = text.slice(colonIndex + 1).trim();
    const restItems = splitByStrongSeparators(rest);
    if (restItems.length > 1) return { intro, items: restItems };
  }

  const semicolonItems = splitByStrongSeparators(text);
  if (semicolonItems.length > 1) return { intro: "", items: semicolonItems };

  const sentenceItems = splitSentencesSafely(text);

  return { intro: "", items: sentenceItems.length > 1 ? sentenceItems : [text] };
}

function splitByStrongSeparators(text) {
  return text
    .split(/;\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitSentencesSafely(text) {
  const items = [];
  let start = 0;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    const afterSpace = text[index + 2];
    const canSplit = [".", "!", "?"].includes(char) && next === " " && /[A-Z0-9]/.test(afterSpace ?? "");

    if (!canSplit || shouldKeepPeriod(index, text)) continue;

    items.push(text.slice(start, index + 1).trim());
    start = index + 2;
  }

  items.push(text.slice(start).trim());
  return items.filter(Boolean);
}

function shouldKeepPeriod(index, text) {
  const left = text.slice(Math.max(0, index - 18), index + 1);
  return /(?:J\.S\.|U\.S\.|U\.K\.|D\.M\.A\.|M\.M\.|B\.M\.|Ph\.D\.|MFA\.|BFA\.|Mr\.|Ms\.|Dr\.|Prof\.|St\.|No\.|vs\.|e\.g\.|i\.e\.)$/i.test(left);
}

function renderSources(sources) {
  if (!sources?.length) return `<span class="source-empty">No official source yet.</span>`;
  return sources
    .map((source) => {
      const label = source.label ?? source.url;
      return `<a href="${escapeAttribute(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`;
    })
    .join("");
}

function buildResearchQuery(school, program) {
  const major = PROGRAMS[program]?.label ?? program;
  return `${school.name} Master of Music ${major} audition requirements deadline TOEFL application fee official`;
}

function statusBadge(status) {
  return `<span class="badge ${STATUS_CLASS[status] ?? "not-started"}">${STATUS_LABELS[status] ?? status}</span>`;
}

function compare(a, b) {
  return a.localeCompare(b, "en", { sensitivity: "base" });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatEnglishScoreText(text) {
  const testScorePattern =
    /\b((?:TOEFL(?:\s+iBT|\s+Essentials)?|IELTS(?:\s+Academic)?|PTE(?:\s+Academic)?|Pearson\s+PTE|Duolingo(?:\s+English\s+Test)?|SAT(?:\s+Critical\s+Reading|\s+Evidence-Based\s+Reading\s+and\s+Writing)?|ACT(?:\s+English)?|Cambridge(?:\s+CPE|\s+CAE)?)(?:\s+(?:total|overall|score|scores|band))*\s+)(\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)?)/gi;

  return escapeHtml(text)
    .replace(testScorePattern, `$1<span class="score-highlight">$2</span>`)
    .replace(/(:\s*)(\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)?)(?=\b)/g, `$1<span class="score-highlight">$2</span>`);
}
