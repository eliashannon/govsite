(() => {
    const storageKey = "trainingManagerTqsDrafts";
    const hasText = value => typeof value === "string" && Boolean(value.trim());
    const sameRole = (a, b) => a && b && a.division === b.division && a.branch === b.branch && a.role === b.role;

    function readAll() {
        const records = JSON.parse(localStorage.getItem(storageKey) || "{}");
        if (!records || typeof records !== "object" || Array.isArray(records)) {
            throw new Error("Invalid TQS storage.");
        }
        return records;
    }

    function validate(record, hierarchy) {
        const errors = [];
        if (!hasText(record.id)) errors.push("Missing internal TQS ID.");
        if (!hasText(record.identifier)) errors.push("Enter a TQS ID.");
        if (!hasText(record.title)) errors.push("Enter a TQS title.");
        if (!hasText(record.version)) errors.push("Enter a version.");
        if (!hasText(record.effectiveDate) || !/^\d{4}-\d{2}-\d{2}$/.test(record.effectiveDate)
            || Number.isNaN(Date.parse(`${record.effectiveDate}T00:00:00Z`))
            || new Date(`${record.effectiveDate}T00:00:00Z`).toISOString().slice(0, 10) !== record.effectiveDate) {
            errors.push("Enter a valid effective date.");
        }
        const role = record.assignment;
        if (!role || !hierarchy[role.division]?.[role.branch]?.includes(role.role)) errors.push("Select an existing role.");
        if (!Array.isArray(record.unassignedRequirements) || record.unassignedRequirements.length) {
            errors.push("Assign or remove all unassigned requirements.");
        }
        if (!Array.isArray(record.modules) || !record.modules.length) {
            errors.push("Add at least one module.");
            return errors;
        }
        const moduleNumbers = new Set();
        const requirementNumbers = new Set();
        const requirementIds = new Set();
        let count = 0;
        record.modules.forEach(module => {
            if (!hasText(module.moduleNumber) || !hasText(module.moduleTitle)) errors.push("Each module needs a number and title.");
            const number = String(module.moduleNumber || "").trim().toLowerCase();
            if (moduleNumbers.has(number)) errors.push("Module numbers must be unique.");
            moduleNumbers.add(number);
            if (!Array.isArray(module.requirements) || !module.requirements.length) {
                errors.push("Each module needs at least one requirement.");
                return;
            }
            module.requirements.forEach(requirement => {
                count++;
                if (!hasText(requirement.id) || ["__proto__", "constructor", "prototype"].includes(requirement.id)
                    || requirementIds.has(requirement.id)) errors.push("Requirement IDs must be unique and valid.");
                requirementIds.add(requirement.id);
                if (!hasText(requirement.requirementNumber) || !hasText(requirement.requirementText)) errors.push("Each requirement needs a number and text.");
                const requirementNumber = String(requirement.requirementNumber || "").trim().toLowerCase();
                if (requirementNumbers.has(requirementNumber)) errors.push("Requirement numbers must be unique.");
                requirementNumbers.add(requirementNumber);
            });
        });
        if (!count) errors.push("Add at least one requirement.");
        return [...new Set(errors)];
    }

    function publishedForRole(role) {
        const matches = Object.values(readAll()).filter(record => record.status === "published" && sameRole(record.assignment, role));
        if (matches.length > 1) throw new Error("Multiple TQS records are published for this role.");
        if (matches.length && validate(matches[0], window.PortalData.organizationHierarchy).length) {
            throw new Error("The published TQS has invalid data.");
        }
        return matches[0] || null;
    }

    window.TqsStore = Object.freeze({storageKey, readAll, validate, sameRole, publishedForRole});
})();
