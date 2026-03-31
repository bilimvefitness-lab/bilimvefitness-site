const apiBase = "http://127.0.0.1:8000/api/v1";

const uploadForm = document.getElementById("upload-form");
const fileInput = document.getElementById("pdf-file");
const uploadResult = document.getElementById("upload-result");
const refreshDocumentsButton = document.getElementById("refresh-documents");
const documentsContainer = document.getElementById("documents");
const chatForm = document.getElementById("chat-form");
const documentIdInput = document.getElementById("document-id");
const questionInput = document.getElementById("question");
const chatResult = document.getElementById("chat-result");
const trainingForm = document.getElementById("training-form");
const trainingProgramInput = document.getElementById("training-program");
const analysisStatus = document.getElementById("analysis-status");
const reportStatus = document.getElementById("report-status");
const analysisResult = document.getElementById("analysis-result");
const reportResult = document.getElementById("report-result");

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const file = fileInput.files[0];
  if (!file) {
    setMessage(uploadResult, "Select a PDF first.", "error");
    return;
  }

  const formData = new FormData();
  formData.append("file", file);
  setMessage(uploadResult, "Uploading PDF...", "loading");

  try {
    const payload = await request(`${apiBase}/upload`, {
      method: "POST",
      body: formData,
    });

    documentIdInput.value = payload.document_id;
    setMessage(
      uploadResult,
      `${payload.filename} uploaded successfully. ${payload.page_count} pages, ${payload.chunk_count} chunks, vector status: ${payload.vector_store_status}.`,
      "success",
    );
    await loadDocuments();
  } catch (error) {
    setMessage(uploadResult, error.message, "error");
  }
});

refreshDocumentsButton.addEventListener("click", () => {
  void loadDocuments();
});

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  chatResult.innerHTML = '<p class="muted-text">Generating answer from retrieved chunks...</p>';

  try {
    const payload = await request(`${apiBase}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question: questionInput.value,
        document_id: documentIdInput.value || null,
        top_k: 5,
      }),
    });

    renderChat(payload);
  } catch (error) {
    chatResult.innerHTML = `<p class="error-text">${escapeHtml(error.message)}</p>`;
  }
});

trainingForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  analysisStatus.textContent = "Analyzing...";
  reportStatus.textContent = "Waiting for analysis...";
  analysisResult.innerHTML = '<p class="muted-text">Running training analysis...</p>';
  reportResult.innerHTML = '<p class="muted-text">Preparing report...</p>';

  try {
    const analysis = await request(`${apiBase}/training/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        program_text: trainingProgramInput.value,
      }),
    });

    analysisStatus.textContent = "Analysis ready";
    renderAnalysis(analysis);

    const report = await request(`${apiBase}/training/report`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(analysis),
    });

    reportStatus.textContent = "Report ready";
    renderReport(report);
  } catch (error) {
    analysisStatus.textContent = "Error";
    reportStatus.textContent = "Error";
    analysisResult.innerHTML = `<p class="error-text">${escapeHtml(error.message)}</p>`;
    reportResult.innerHTML = `<p class="error-text">${escapeHtml(error.message)}</p>`;
  }
});

async function request(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.detail || "Request failed");
  }

  return payload;
}

async function loadDocuments() {
  documentsContainer.innerHTML = '<p class="muted-text">Loading documents...</p>';

  try {
    const payload = await request(`${apiBase}/documents`);

    if (!payload.length) {
      documentsContainer.innerHTML = '<p class="muted-text">No documents uploaded yet.</p>';
      return;
    }

    documentsContainer.innerHTML = "";
    payload.forEach((documentItem) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "document-card";
      item.innerHTML = `
        <strong>${escapeHtml(documentItem.filename)}</strong>
        <span>${escapeHtml(documentItem.document_id)}</span>
        <span>${documentItem.chunk_count} chunks</span>
      `;
      item.addEventListener("click", () => {
        documentIdInput.value = documentItem.document_id;
      });
      documentsContainer.appendChild(item);
    });
  } catch (error) {
    documentsContainer.innerHTML = `<p class="error-text">${escapeHtml(error.message)}</p>`;
  }
}

function renderChat(payload) {
  const sources = (payload.sources || [])
    .map((source) => {
      const bits = [];
      if (source.filename) {
        bits.push(source.filename);
      }
      if (source.page) {
        bits.push(`p.${source.page}${source.page_end && source.page_end !== source.page ? `-${source.page_end}` : ""}`);
      }
      if (source.chapter) {
        bits.push(source.chapter);
      }
      if (source.section) {
        bits.push(source.section);
      }
      return `<li>${escapeHtml(bits.join(" | ") || source.vector_id)}</li>`;
    })
    .join("");

  chatResult.innerHTML = `
    <div class="chat-answer">
      <p class="label">Answer</p>
      <p>${escapeHtml(payload.answer)}</p>
    </div>
    <div class="chat-meta">
      <p><strong>Supported:</strong> ${payload.answer_supported ? "Yes" : "No"}</p>
      <p><strong>Retrieved chunks:</strong> ${payload.retrieved_chunk_count}</p>
    </div>
    <div class="source-list">
      <p class="label">Sources</p>
      <ul>${sources || "<li>No sources returned.</li>"}</ul>
    </div>
  `;
}

function renderAnalysis(analysis) {
  const scoreCards = [
    metricCard("Hypertrophy Score", `${analysis.hypertrophy_score}/100`, analysis.overall_interpretation),
    metricCard("Fatigue Risk", titleCase(analysis.fatigue_risk), analysis.score_breakdown.fatigue_balance.explanation),
    metricCard("Estimated RIR", `${Number(analysis.estimated_rir_level.estimated_average_rir).toFixed(2)}`, analysis.estimated_rir_level.interpretation),
  ].join("");

  const breakdownCards = [
    breakdownCard("Volume", analysis.score_breakdown.weekly_volume_adequacy),
    breakdownCard("Frequency", analysis.score_breakdown.frequency_adequacy),
    breakdownCard("Effort", analysis.score_breakdown.estimated_effort_quality),
    breakdownCard("Exercise Selection", analysis.score_breakdown.exercise_selection_quality),
    breakdownCard("Fatigue Balance", analysis.score_breakdown.fatigue_balance),
  ].join("");

  const strengths = listItems(analysis.main_strengths);
  const limiters = listItems(analysis.main_limiters);
  const actions = (analysis.next_best_actions || [])
    .map(
      (action) => `
        <article class="action-card">
          <div class="action-header">
            <strong>${escapeHtml(action.title)}</strong>
            <span class="priority-pill ${priorityClass(action.priority)}">${escapeHtml(titleCase(action.priority))}</span>
          </div>
          <p>${escapeHtml(action.description)}</p>
        </article>
      `,
    )
    .join("");

  const metricsRows = Object.keys(analysis.weekly_volume_per_muscle_group || {})
    .sort()
    .map((muscle) => {
      const sets = analysis.weekly_volume_per_muscle_group[muscle];
      const frequency = analysis.frequency_per_muscle_group[muscle] ?? 0;
      return `
        <tr>
          <td>${escapeHtml(titleCase(muscle))}</td>
          <td>${Number(sets).toFixed(2)}</td>
          <td>${frequency}x</td>
        </tr>
      `;
    })
    .join("");

  analysisResult.innerHTML = `
    <div class="score-grid">${scoreCards}</div>
    <section class="subsection">
      <h3>Score Breakdown</h3>
      <div class="breakdown-grid">${breakdownCards}</div>
    </section>
    <section class="subsection two-col">
      <div>
        <h3>Strengths</h3>
        ${strengths}
      </div>
      <div>
        <h3>Limiters</h3>
        ${limiters}
      </div>
    </section>
    <section class="subsection">
      <h3>Key Metrics</h3>
      <table class="metrics-table">
        <thead>
          <tr>
            <th>Muscle Group</th>
            <th>Weekly Volume</th>
            <th>Frequency</th>
          </tr>
        </thead>
        <tbody>
          ${metricsRows || '<tr><td colspan="3">No muscle metrics available.</td></tr>'}
        </tbody>
      </table>
    </section>
    <section class="subsection">
      <h3>Next Best Actions</h3>
      <div class="actions-list">${actions || '<p class="muted-text">No actions generated.</p>'}</div>
    </section>
  `;
}

function renderReport(report) {
  const sectionsHtml = (report.report_sections || [])
    .map((section) => {
      const bullets = section.bullets?.length
        ? `<ul class="bullet-list">${section.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
        : "";
      const metrics = section.metrics?.length
        ? `<div class="report-metrics">${section.metrics
            .map(
              (metric) => `
                <article class="mini-metric">
                  <strong>${escapeHtml(metric.label)}</strong>
                  <span>${escapeHtml(metric.value)}</span>
                  ${metric.detail ? `<p>${escapeHtml(metric.detail)}</p>` : ""}
                </article>
              `,
            )
            .join("")}</div>`
        : "";
      const actions = section.actions?.length
        ? `<div class="actions-list">${section.actions
            .map(
              (action) => `
                <article class="action-card">
                  <div class="action-header">
                    <strong>${escapeHtml(action.title)}</strong>
                    <span class="priority-pill ${priorityClass(action.priority)}">${escapeHtml(titleCase(action.priority))}</span>
                  </div>
                  <p>${escapeHtml(action.description)}</p>
                </article>
              `,
            )
            .join("")}</div>`
        : "";

      return `
        <section class="report-section">
          <h3>${escapeHtml(section.title)}</h3>
          ${section.summary ? `<p>${escapeHtml(section.summary)}</p>` : ""}
          ${bullets}
          ${metrics}
          ${actions}
        </section>
      `;
    })
    .join("");

  reportResult.innerHTML = `
    <div class="report-sections">${sectionsHtml}</div>
    <section class="subsection">
      <h3>Formatted Report Text</h3>
      <pre class="report-text">${escapeHtml(report.report_text)}</pre>
    </section>
  `;
}

function breakdownCard(label, metric) {
  return `
    <article class="mini-metric">
      <strong>${escapeHtml(label)}</strong>
      <span>${metric.score}/100</span>
      <p>${escapeHtml(metric.explanation)}</p>
    </article>
  `;
}

function metricCard(label, value, detail) {
  return `
    <article class="score-card">
      <p class="label">${escapeHtml(label)}</p>
      <strong>${escapeHtml(value)}</strong>
      <p>${escapeHtml(detail)}</p>
    </article>
  `;
}

function listItems(items) {
  if (!items?.length) {
    return '<p class="muted-text">No items available.</p>';
  }

  return `<ul class="bullet-list">${items
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("")}</ul>`;
}

function setMessage(element, message, tone) {
  element.className = `message-box ${tone ? `message-${tone}` : ""}`;
  element.textContent = message;
}

function priorityClass(priority) {
  const normalized = String(priority || "").toLowerCase();
  if (normalized === "high") {
    return "priority-high";
  }
  if (normalized === "medium") {
    return "priority-medium";
  }
  return "priority-low";
}

function titleCase(value) {
  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

void loadDocuments();
