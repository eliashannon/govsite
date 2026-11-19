(() => {
    const parse = text => {
        if (typeof text !== "string") throw new TypeError("TQS source text must be a string.");

        const modules = [];
        const unassignedRequirements = [];
        const warnings = [];
        const seenModules = new Set();
        const seenRequirements = new Set();
        let currentModule = null;

        text.split(/\r\n|\n|\r/).forEach((sourceLine, index) => {
            const line = sourceLine.trim();
            if (!line) return;

            const moduleMatch = line.match(/^(\d+\.0)\s+(\S.*)$/);
            if (moduleMatch) {
                const [, moduleNumber, moduleTitle] = moduleMatch;
                if (seenModules.has(moduleNumber)) {
                    warnings.push({line: index + 1, message: `Duplicate module number ${moduleNumber} requires review.`});
                }
                seenModules.add(moduleNumber);
                currentModule = {
                    id: crypto.randomUUID(),
                    moduleNumber,
                    moduleTitle,
                    displayOrder: modules.length,
                    requirements: []
                };
                modules.push(currentModule);
                return;
            }

            const requirementMatch = line.match(/^(\d+(?:\.\d+){2,})\s+(\S.*)$/);
            if (requirementMatch) {
                const [, requirementNumber, requirementText] = requirementMatch;
                const requirement = {
                    id: crypto.randomUUID(),
                    requirementNumber,
                    requirementText,
                    displayOrder: currentModule ? currentModule.requirements.length : unassignedRequirements.length,
                    sourceLine: index + 1,
                    required: true
                };
                if (seenRequirements.has(requirementNumber)) {
                    warnings.push({line: index + 1, message: `Duplicate requirement number ${requirementNumber} requires review.`});
                }
                seenRequirements.add(requirementNumber);
                if (!currentModule || requirementNumber.split(".")[0] !== currentModule.moduleNumber.split(".")[0]) {
                    requirement.displayOrder = unassignedRequirements.length;
                    unassignedRequirements.push(requirement);
                    warnings.push({line: index + 1, message: `Requirement ${requirementNumber} could not be assigned to the current module.`});
                    return;
                }
                currentModule.requirements.push(requirement);
                return;
            }

            if (/^\d+\.0(?:\s|$)/.test(line)) currentModule = null;
            warnings.push({line: index + 1, message: "Unrecognized source line requires review.", sourceText: line});
        });

        return {modules, unassignedRequirements, warnings};
    };

    if (typeof module !== "undefined" && module.exports) module.exports = {parse};
    else window.TqsParser = Object.freeze({parse});
})();
