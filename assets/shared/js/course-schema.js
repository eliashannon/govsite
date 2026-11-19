(() => {
    const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);
    const hasText = value => typeof value === "string" && Boolean(value.trim());
    const slug = value => String(value || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    function safeUrl(value, image = false) {
        if (!hasText(value)) return false;
        const url = value.trim();
        if (image && /^data:image\/(?:png|jpeg|gif|webp);base64,[a-z0-9+/]+={0,2}$/i.test(url)) return true;
        if (/[\u0000-\u001f\u007f\\]/.test(url) || url.startsWith("//")) return false;
        if (/^[a-z][a-z0-9+.-]*:/i.test(url)) {
            try {
                const parsed = new URL(url);
                return ["http:", "https:"].includes(parsed.protocol) && !parsed.username && !parsed.password;
            } catch (_) {
                return false;
            }
        }
        return true;
    }

    function validateCourse(course, options = {}) {
        const errors = [];
        if (!isObject(course)) return ["Course data is invalid."];
        if (!hasText(course.id)) errors.push("Missing course ID.");
        else if (!/^[a-z0-9][a-z0-9_-]*$/i.test(course.id) || ["__proto__", "constructor", "prototype"].includes(course.id.toLowerCase())) errors.push("Course ID must use letters, numbers, hyphens, or underscores and not be a reserved name.");
        if (!hasText(course.title)) errors.push("Missing course title.");
        if (options.complete) {
            if (!hasText(course.description)) errors.push("Missing course description.");
            if (!hasText(course.category)) errors.push("Missing course category.");
            if (!hasText(course.difficulty)) errors.push("Missing course difficulty.");
            if (!Number.isFinite(course.durationMinutes) || course.durationMinutes <= 0) errors.push("Duration must be a positive number of minutes.");
            if (!Array.isArray(course.learningObjectives) || !course.learningObjectives.length || !course.learningObjectives.every(hasText)) errors.push("Add at least one course learning objective and remove empty objectives.");
            if (!Array.isArray(course.roleAssignments) || !course.roleAssignments.length) errors.push("Add at least one Division, Branch, and Role assignment.");
            const assignments = new Set();
            (Array.isArray(course.roleAssignments) ? course.roleAssignments : []).forEach(assignment => {
                if (!isObject(assignment) || !hasText(assignment.divisionId) || !hasText(assignment.branchId) || !hasText(assignment.roleId)) {
                    errors.push("Each assignment must include a Division, Branch, and Role.");
                    return;
                }
                if (typeof assignment.required !== "boolean") errors.push("Each assignment must specify whether it is required.");
                const key = `${assignment.divisionId}|${assignment.branchId}|${assignment.roleId}`;
                if (assignments.has(key)) errors.push(`Duplicate role assignment: ${key.replace(/\|/g, " / ")}.`);
                assignments.add(key);
                if (options.hierarchy) {
                    const division = Object.keys(options.hierarchy).find(name => slug(name) === assignment.divisionId);
                    const branch = division && Object.keys(options.hierarchy[division]).find(name => slug(name) === assignment.branchId);
                    if (!branch || !options.hierarchy[division][branch].some(role => slug(role) === assignment.roleId)) {
                        errors.push(`Assignment ${key.replace(/\|/g, " / ")} is not in the organization hierarchy. Remove it and select a valid assignment.`);
                    }
                }
            });
        }
        if (!Array.isArray(course.modules) || !course.modules.length) {
            errors.push("Add at least one module.");
            return errors;
        }
        const ids = new Set();
        const assessmentIds = new Set();
        const validateAssessment = (assessment, label) => {
            const questions = assessment?.questions;
            if (!isObject(assessment) || !Array.isArray(questions) || !questions.length) {
                errors.push(`${label} is invalid.`);
                return;
            }
            questions.forEach((question, questionIndex) => {
                const questionLabel = `${label} question ${questionIndex + 1}`;
                if (!isObject(question) || !hasText(question.prompt)) {
                    errors.push(`${questionLabel} has no question text.`);
                    return;
                }
                if (!Array.isArray(question.choices) || question.choices.length < 2 || !question.choices.every(hasText)) {
                    errors.push(`${questionLabel} needs at least two non-empty answer choices.`);
                }
                if (!Number.isInteger(question.answerIndex) || question.answerIndex < 0
                    || question.answerIndex >= (Array.isArray(question.choices) ? question.choices.length : 0)) {
                    errors.push(`${questionLabel} needs a valid correct answer.`);
                }
            });
        };
        course.modules.forEach((module, index) => {
            const label = `Module ${module?.sourceModuleNumber || index + 1}`;
            if (!isObject(module)) { errors.push(`${label} is invalid.`); return; }
            if (!hasText(module.id)) errors.push(`${label} has no valid module ID.`);
            else if (ids.has(module.id)) errors.push(`Duplicate module ID: ${module.id}.`);
            ids.add(module.id);
            if (!hasText(module.title)) errors.push(`${label} has no title.`);
            if (!Number.isFinite(module.order) || module.order <= 0 || !Number.isFinite(module.estimatedMinutes) || module.estimatedMinutes < 0) errors.push(`${label} has invalid ordering or duration.`);
            if (!Array.isArray(module.learningObjectives) || !module.learningObjectives.every(hasText)) errors.push(`${label} has invalid learning objectives.`);
            if (!Array.isArray(module.content) || !module.content.length) {
                errors.push(`${label} has no content.`);
            } else {
                module.content.forEach((block, blockIndex) => {
                    const prefix = `${label} block ${blockIndex + 1}`;
                    if (!isObject(block) || !["heading","paragraph","list","callout","link","image","table"].includes(block.type)) {
                        errors.push(`${prefix} has an unsupported type.`);
                    } else if (block.type === "link" && !safeUrl(block.url)) errors.push(`${prefix} contains an unsafe or missing link.`);
                    else if (block.type === "image" && !safeUrl(block.src, true)) errors.push(`${prefix} contains an unsafe or missing image source.`);
                    else if (["heading", "paragraph", "callout"].includes(block.type) && !hasText(block.text)) errors.push(`${prefix} has no text.`);
                    else if (block.type === "list" && (!Array.isArray(block.items) || !block.items.length || !block.items.every(hasText))) errors.push(`${prefix} has invalid list items.`);
                    else if (block.type === "table" && (!Array.isArray(block.headers) || !block.headers.every(item => typeof item === "string")
                        || !Array.isArray(block.rows) || !block.rows.length
                        || !block.rows.every(row => Array.isArray(row) && row.length && row.every(item => typeof item === "string")))) errors.push(`${prefix} has invalid table rows.`);
                });
            }
            if (module.assessment !== undefined) {
                validateAssessment(module.assessment, `${label} assessment`);
            }
            if (module.assessments !== undefined) {
                if (!Array.isArray(module.assessments)) {
                    errors.push(`${label} has invalid assessments.`);
                } else module.assessments.forEach((assessment, assessmentIndex) => {
                    const assessmentLabel = `${label} assessment ${assessmentIndex + 1}`;
                    if (!isObject(assessment) || !hasText(assessment.id) || !hasText(assessment.title)) {
                        errors.push(`${assessmentLabel} needs a valid ID and title.`);
                        return;
                    }
                    if (assessmentIds.has(assessment.id)) errors.push(`Duplicate assessment ID: ${assessment.id}.`);
                    assessmentIds.add(assessment.id);
                    validateAssessment(assessment, assessmentLabel);
                });
            }
        });
        return errors;
    }

    window.CourseSchema = Object.freeze({isObject, safeUrl, validateCourse});
})();
