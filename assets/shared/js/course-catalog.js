(() => {
    async function load() {
        const portalCourses = window.PortalData?.courses || [];
        let builtInCourses = portalCourses;
        try {
            const response = await fetch("data/courses.json", {cache:"no-store"});
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            if (!Array.isArray(data?.courses)) throw new Error("Course data has an invalid structure.");
            const portalById = new Map(portalCourses.map(course => [course.id, course]));
            const merged = new Map(data.courses.map(course => {
                const portalCourse = portalById.get(course.id) || {};
                return [course.id, {
                    ...portalCourse, ...course,
                    duration: `${course.durationMinutes || 0} minutes`,
                    roles: portalCourse.roles || []
                }];
            }));
            portalCourses.forEach(course => { if (!merged.has(course.id)) merged.set(course.id, course); });
            builtInCourses = [...merged.values()];
        } catch (error) {
            console.error("Unable to load built-in course JSON.", error);
        }

        let localCourses = [];
        try {
            const parsed = JSON.parse(localStorage.getItem("trainingManagerCourses") || "{}");
            if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid local course store.");
            const hierarchy = window.PortalData?.organizationHierarchy || {};
            const slug = value => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
            localCourses = Object.values(parsed).filter(course =>
                course && typeof course === "object" && course.status === "published"
                && typeof course.id === "string"
                && window.CourseSchema.validateCourse(course, {complete:true, hierarchy}).length === 0
            ).map(course => {
                const roleNames = [];
                course.roleAssignments.forEach(assignment => {
                    Object.entries(hierarchy).forEach(([divisionName, branches]) => {
                        Object.entries(branches).forEach(([branchName, roles]) => {
                            roles.forEach(roleName => {
                                if (assignment.divisionId === slug(divisionName)
                                    && assignment.branchId === slug(branchName)
                                    && assignment.roleId === slug(roleName)
                                    && !roleNames.includes(roleName)) roleNames.push(roleName);
                            });
                        });
                    });
                });
                return {
                    ...course,
                    duration: `${course.durationMinutes || 0} minutes`,
                    requirement: course.roleAssignments.some(item => item.required) ? "Required" : "Optional",
                    roles: roleNames,
                    description: course.description || course.shortDescription || ""
                };
            });
        } catch (error) {
            console.error("Unable to load published local courses.", error);
        }
        const merged = new Map(builtInCourses.map(course => [course.id, course]));
        localCourses.forEach(course => merged.set(course.id, course));
        return [...merged.values()];
    }

    function status(course, completedIds, inProgressIds, progressStore) {
        const progress = progressStore[course.id];
        if (progress && progress.courseCompleted === true && Array.isArray(course.modules)
            && course.modules.length > 0 && Array.isArray(progress.continuedModuleIds)
            && course.modules.every(module => progress.continuedModuleIds.includes(module.id))) return "Completed";
        if (completedIds.includes(course.id)) return "Completed";
        if (inProgressIds.includes(course.id)
            || (Array.isArray(progress?.continuedModuleIds) && progress.continuedModuleIds.length > 0)) return "In Progress";
        return "Not Started";
    }

    window.CourseCatalog = Object.freeze({load, status});
})();
