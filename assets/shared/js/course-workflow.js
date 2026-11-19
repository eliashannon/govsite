(() => {
    const zones = ["course", "exam", "published"];

    function zone(course) {
        if (course.status === "published") return "published";
        if (zones.includes(course.managerZone)) return course.managerZone;
        const queue = JSON.parse(localStorage.getItem("trainingExamBuilderCourseIds") || "[]");
        if (!Array.isArray(queue) || !queue.every(id => typeof id === "string")) {
            throw new Error("The Exam Builder course queue has an invalid format.");
        }
        return queue.includes(course.id) ? "exam" : "course";
    }

    function move(course, destination) {
        if (!zones.includes(destination)) throw new Error("Invalid course destination.");
        if (course.status === "published") throw new Error("Unpublish this course before moving it.");
        if ((destination === "exam" || destination === "published") && course.status !== "approved") {
            throw new Error("Only approved courses can be moved to this destination.");
        }
        return {...course, managerZone:destination};
    }

    function publish(course) {
        if (zone(course) !== "published" || course.status !== "approved") {
            throw new Error("Only approved courses in Published Courses can be published.");
        }
        return {...course, managerZone:"published", status:"published", publishedAt:new Date().toISOString()};
    }

    function unpublish(course) {
        if (course.status !== "published") throw new Error("This course is not published.");
        return {...course, managerZone:"published", status:"approved", publishedAt:null, unpublishedAt:new Date().toISOString()};
    }

    window.CourseWorkflow = Object.freeze({zone, move, publish, unpublish});
})();
