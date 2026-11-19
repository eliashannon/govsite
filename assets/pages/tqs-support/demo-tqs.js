document.addEventListener("DOMContentLoaded", async () => {
    await window.PortalDataReady;
    let profile;
    let selectedRole;
    try {
        profile = JSON.parse(sessionStorage.getItem("govsiteAccountProfile") || "null");
        selectedRole = JSON.parse(localStorage.getItem("portal.selectedRole") || "null");
    } catch (error) {
        console.error("Unable to read the demo account or role.", error);
        return;
    }
    if (typeof profile?.email !== "string" || profile.email.toLowerCase() !== "demo@navy.mil"
        || selectedRole?.division !== "Demo: D" || selectedRole?.branch !== "Demo D"
        || selectedRole?.role !== "Demo D") return;

    const modules = [
        {
            number: "1.0", title: "ORIENTATION AND COMMUNICATION",
            requirements: [
                ["1.1.1", "Describe the purpose of the Demo D role."],
                ["1.1.2", "Identify the team's primary points of contact."],
                ["1.1.3", "Locate the sample reference library."],
                ["1.1.4", "Demonstrate a clear routine status update."],
                ["1.1.5", "Explain how to raise a question or concern."]
            ]
        },
        {
            number: "2.0", title: "SAFETY AND RECORDS",
            requirements: [
                ["2.1.1", "Identify a sample workplace safety concern."],
                ["2.1.2", "Describe the process for reporting a concern."],
                ["2.1.3", "Identify an approved location for sample records."],
                ["2.1.4", "Demonstrate an accurate sample record entry."],
                ["2.1.5", "Explain how to request a correction to a record."]
            ]
        }
    ];
    const requirementIds = new Set(modules.flatMap(module => module.requirements.map(([number]) => number)));
    const storageKey = "portal.demoTqsProgress:demo%40navy.mil:DEMO-TQS-001";
    const section = document.getElementById("demoTqs");
    const container = document.getElementById("demoTqsModules");
    const notice = document.getElementById("demoTqsNotice");
    const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
    const formatter = new Intl.DateTimeFormat("en-GB", {
        day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC"
    });
    const checkedBy = [profile.firstName, profile.lastName].filter(value => typeof value === "string" && value.trim()).join(" ") || "Demo User";
    let progress = {};
    let storageAvailable = true;

    const showError = message => {
        notice.textContent = message;
        notice.hidden = false;
        notice.classList.add("is-error");
    };
    try {
        const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
        if (!saved || typeof saved !== "object" || Array.isArray(saved)
            || Object.entries(saved).some(([number, entry]) => !requirementIds.has(number)
                || !entry || typeof entry.checkedBy !== "string" || !entry.checkedBy
                || typeof entry.checkedAt !== "string" || Number.isNaN(Date.parse(entry.checkedAt)))) {
            throw new Error("Invalid demo TQS progress.");
        }
        progress = saved;
    } catch (error) {
        console.error("Unable to read demo TQS progress.", error);
        storageAvailable = false;
        showError("Sample checkoffs could not be read from this browser. Check storage before continuing.");
    }

    const render = () => {
        const completed = Object.keys(progress).length;
        document.getElementById("demoTqsProgress").textContent = `${completed} of ${requirementIds.size} requirements complete`;
        container.innerHTML = modules.map(module => {
            const moduleCompleted = module.requirements.filter(([number]) => progress[number]).length;
            return `<section class="demo-tqs-module">
                <h3>${escapeHtml(module.number)} ${escapeHtml(module.title)}</h3>
                <p>${moduleCompleted} of ${module.requirements.length} complete</p>
                <div class="demo-tqs-table-wrap"><table class="demo-tqs-table" aria-label="${escapeHtml(`${module.number} ${module.title}`)}">
                  <thead><tr><th scope="col">Requirement Number</th><th scope="col">Requirement</th><th scope="col">Complete</th><th scope="col">Checked By</th><th scope="col">Date Checked</th></tr></thead>
                  <tbody>${module.requirements.map(([number, text]) => {
                      const entry = progress[number];
                      return `<tr><td>${escapeHtml(number)}</td><td>${escapeHtml(text)}</td><td>
                        <input type="checkbox" data-demo-requirement="${escapeHtml(number)}" aria-label="${escapeHtml(`${number} ${text}`)}" ${entry ? "checked" : ""} ${storageAvailable ? "" : "disabled"}>
                        </td><td>${entry ? escapeHtml(entry.checkedBy) : ""}</td><td>${entry ? escapeHtml(formatter.format(new Date(entry.checkedAt))) : ""}</td></tr>`;
                  }).join("")}</tbody>
                </table></div>
              </section>`;
        }).join("");
    };
    container.addEventListener("change", event => {
        const checkbox = event.target.closest("[data-demo-requirement]");
        const number = checkbox?.dataset.demoRequirement;
        if (!storageAvailable || !requirementIds.has(number)) return;
        const next = {...progress};
        if (checkbox.checked) next[number] = {checkedBy, checkedAt: new Date().toISOString()};
        else delete next[number];
        try {
            localStorage.setItem(storageKey, JSON.stringify(next));
            progress = next;
            notice.hidden = false;
            notice.classList.remove("is-error");
            notice.textContent = "Sample checkoff saved in this browser.";
            render();
            container.querySelector(`[data-demo-requirement="${number}"]`)?.focus();
        } catch (error) {
            console.error("Unable to save demo TQS progress.", error);
            checkbox.checked = Boolean(progress[number]);
            showError("Sample checkoff could not be saved in this browser.");
        }
    });
    section.hidden = false;
    render();
});
