(() => {
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
    const demoStorageKey = "portal.demoTqsProgress:demo%40navy.mil:DEMO-TQS-001";
    const storageKeyFor = (profile, record = null) => {
        const accountId = typeof profile?.email === "string" ? profile.email.trim().toLowerCase() : "";
        if (record) {
            const role = record.assignment;
            return `portal.tqsRequirementProgress:${encodeURIComponent(accountId)}:${encodeURIComponent(record.id)}:${encodeURIComponent(JSON.stringify([role.division, role.branch, role.role]))}`;
        }
        return accountId
            ? `portal.demoTqsProgress:${encodeURIComponent(accountId)}:DEMO-TQS-001`
            : demoStorageKey;
    };
    const modulesFor = record => record ? record.modules.map(module => ({
        number: module.moduleNumber, title: module.moduleTitle,
        requirements: module.requirements.map(requirement => [
            requirement.id, requirement.requirementText, requirement.requirementNumber, requirement.required !== false
        ])
    })) : modules.map(module => ({
        ...module, requirements: module.requirements.map(([number, text]) => [number, text, number, true])
    }));
    const totalFor = record => modulesFor(record).reduce((total, module) => total + module.requirements.length, 0);
    const matches = (profile, selectedRole) => typeof profile?.email === "string"
        && (profile.email.trim().toLowerCase() === "demo@navy.mil" || profile.isMaster === true)
        && selectedRole?.division === "Demo: D" && selectedRole?.branch === "Demo D"
        && selectedRole?.role === "Demo D";
    const readProgress = (profile = null, record = null, includeRemoved = false) => {
        const saved = JSON.parse(localStorage.getItem(storageKeyFor(profile, record)) || "{}");
        const ids = new Set(modulesFor(record).flatMap(module => module.requirements.map(([id]) => id)));
        if (!saved || typeof saved !== "object" || Array.isArray(saved)
            || Object.entries(saved).some(([id, entry]) => (!record && !ids.has(id))
                || !entry || typeof entry.checkedBy !== "string" || !entry.checkedBy
                || typeof entry.checkedAt !== "string" || Number.isNaN(Date.parse(entry.checkedAt)))) {
            throw new Error("Invalid TQS progress.");
        }
        return includeRemoved ? saved : Object.fromEntries(Object.entries(saved).filter(([id]) => ids.has(id)));
    };

    const start = (profile, selectedRole, record = null) => {
        const section = document.getElementById("demoTqs");
        const container = document.getElementById("demoTqsModules");
        const notice = document.getElementById("demoTqsNotice");
        const search = document.querySelector("[data-tqs-search]");
        const track = document.querySelector(".tqs-progress-track");
        const storageKey = storageKeyFor(profile, record);
        const displayedModules = modulesFor(record);
        const requirementIds = new Set(displayedModules.flatMap(module => module.requirements.map(([id]) => id)));
        const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        })[character]);
        const formatter = new Intl.DateTimeFormat("en-US", {
            day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC"
        });
        const checkedBy = [profile.firstName, profile.lastName].filter(value => typeof value === "string" && value.trim()).join(" ")
            || profile.email;
        let progress = {};
        let storageAvailable = true;

        const showError = message => {
            notice.textContent = message;
            notice.hidden = false;
            notice.classList.add("is-error");
        };
        try {
            progress = readProgress(profile, record);
        } catch (error) {
            console.error("Unable to read TQS progress.", error);
            storageAvailable = false;
            showError("Checkoffs could not be read from this browser. Check storage before continuing.");
        }

        const render = () => {
            const completed = Object.keys(progress).length;
            const total = requirementIds.size;
            const percentage = Math.round(completed / total * 100);
            document.getElementById("progressSummary").textContent = storageAvailable ? `${completed}/${total} requirements completed` : "Progress unavailable";
            document.getElementById("progressPercent").textContent = storageAvailable ? `${percentage}%` : "N/A";
            document.getElementById("totalCount").textContent = String(total);
            document.getElementById("completedCount").textContent = storageAvailable ? String(completed) : "N/A";
            document.getElementById("notStartedCount").textContent = storageAvailable ? String(total - completed) : "N/A";
            document.getElementById("progressBar").style.width = storageAvailable ? `${percentage}%` : "0%";
            if (storageAvailable) {
                track.removeAttribute("aria-valuetext");
                track.setAttribute("aria-valuenow", String(percentage));
            } else {
                track.removeAttribute("aria-valuenow");
                track.setAttribute("aria-valuetext", "Progress unavailable");
            }
            const query = search.value.trim().toLowerCase();
            container.innerHTML = displayedModules.map(module => {
                const moduleCompleted = module.requirements.filter(([id]) => progress[id]).length;
                const visible = module.requirements.filter(([, text, number]) =>
                    `${number} ${text} ${module.number} ${module.title}`.toLowerCase().includes(query));
                if (!visible.length) return "";
                return `<section class="demo-tqs-module">
                    <h3>${escapeHtml(module.number)} ${escapeHtml(module.title)}</h3>
                    <p>${moduleCompleted} of ${module.requirements.length} complete</p>
                    <div class="demo-tqs-table-wrap"><table class="demo-tqs-table" aria-label="${escapeHtml(`${module.number} ${module.title}`)}">
                      <thead><tr><th scope="col">Requirement Number</th><th scope="col">Requirement</th><th scope="col">Complete</th><th scope="col">Checked By</th><th scope="col">Date Checked</th></tr></thead>
                      <tbody>${visible.map(([id, text, number, required]) => {
                          const entry = progress[id];
                          return `<tr><td>${escapeHtml(number)}</td><td>${escapeHtml(text)}${required ? "" : " (Optional)"}</td><td>
                            <input type="checkbox" data-demo-requirement="${escapeHtml(id)}" aria-label="${escapeHtml(`${number} ${text}${required ? "" : " (optional)"}`)}" ${entry ? "checked" : ""} ${storageAvailable ? "" : "disabled"}>
                            </td><td>${entry ? escapeHtml(entry.checkedBy) : ""}</td><td>${entry ? escapeHtml(formatter.format(new Date(entry.checkedAt))) : ""}</td></tr>`;
                      }).join("")}</tbody>
                    </table></div>
                  </section>`;
            }).join("") || '<p class="tqs-list-empty">No requirements match this search.</p>';
        };
        container.addEventListener("change", event => {
            const checkbox = event.target.closest("[data-demo-requirement]");
            const number = checkbox?.dataset.demoRequirement;
            if (!storageAvailable || !requirementIds.has(number)) return;
            try {
                const next = {...readProgress(profile, record, true)};
                if (checkbox.checked) next[number] = {checkedBy, checkedAt: new Date().toISOString()};
                else delete next[number];
                localStorage.setItem(storageKey, JSON.stringify(next));
                progress = Object.fromEntries(Object.entries(next).filter(([id]) => requirementIds.has(id)));
                notice.hidden = false;
                notice.classList.remove("is-error");
                notice.textContent = "Checkoff saved in this browser.";
                render();
                [...container.querySelectorAll("[data-demo-requirement]")].find(input => input.dataset.demoRequirement === number)?.focus();
            } catch (error) {
                console.error("Unable to save TQS progress.", error);
                checkbox.checked = Boolean(progress[number]);
                showError("Checkoff could not be saved in this browser.");
            }
        });
        window.addEventListener("storage", event => {
            if (event.key !== storageKey && event.key !== null) return;
            try {
                progress = readProgress(profile, record);
                storageAvailable = true;
                notice.hidden = true;
                render();
            } catch (error) {
                console.error("Unable to read TQS progress.", error);
                storageAvailable = false;
                showError("Checkoffs could not be read from this browser. Check storage before continuing.");
                render();
            }
        });
        search.addEventListener("input", render);
        document.getElementById("selectedRoleName").textContent = selectedRole.role;
        document.getElementById("selectedRoleDescription").textContent = record ? "Published qualification standard." : "Synthetic sample qualification standard.";
        document.getElementById("selectedRoleDivision").textContent = selectedRole.division;
        document.getElementById("selectedRoleBranch").textContent = selectedRole.branch;
        document.getElementById("inProgressStat").hidden = true;
        document.getElementById("notStartedLabel").textContent = "Not Complete";
        document.getElementById("progressStats").classList.add("demo-tqs-stats");
        if (record) {
            document.getElementById("demoTqsLabel").textContent = "PUBLISHED TQS";
            document.getElementById("demoTqsTitle").textContent = record.title;
            document.getElementById("demoTqsMeta").textContent = `TQS ID: ${record.identifier} · Version ${record.version} · Effective: ${record.effectiveDate} · Role: ${record.assignment.role}`;
            document.getElementById("demoTqsNote").textContent = "Checkoffs are saved in this browser and are not authenticated or audited.";
        }
        document.getElementById("tqsTracker").hidden = false;
        section.hidden = false;
        render();
    };

    window.DemoTqs = Object.freeze({
        matches,
        start,
        readProgress,
        storageKeyFor,
        storageKey: demoStorageKey,
        totalFor,
        total: totalFor(null)
    });
})();
