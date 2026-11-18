window.PortalData = {
    organizationHierarchy: {
        Operations: {
            Logistics: ["Operations Supervisor", "Fleet Coordinator", "Warehouse Lead"],
            "Safety & Compliance": ["Safety Officer", "Compliance Analyst", "Incident Coordinator"],
            Facilities: ["Facilities Manager", "Maintenance Technician", "Grounds Supervisor"]
        },
        Administration: {
            "Human Resources": ["HR Generalist", "Recruitment Specialist", "Benefits Coordinator"],
            Finance: ["Accounting Technician", "Budget Analyst", "Procurement Specialist"],
            "Executive Support": ["Executive Assistant", "Office Manager", "Program Coordinator"]
        },
        "Technical Services": {
            IT: ["IT Support Analyst", "Systems Administrator", "Network Technician"],
            Engineering: ["Engineering Technician", "Project Engineer", "Quality Engineer"],
            Communications: ["Communications Specialist", "Public Affairs Officer", "Digital Media Coordinator"]
        },
        "Test Division": {
            "Test Branch": ["Test Role"]
        }
    },
    announcements: [
        {title:"Training Portal Launch",description:"Welcome to the Training and Qualification Portal.",date:"November 2026",type:"General"},
        {title:"Training Requirements",description:"Review applicable training requirements and qualification guidance.",date:"November 2026",type:"Reminder"},
        {title:"Reference Library Update",description:"New reference materials have been added to the resource library.",date:"November 2026",type:"Update"}
    ],
    courses: [
        {id:"TRN-001",title:"Initial Orientation",description:"Introduction to organizational processes, responsibilities, and expectations.",category:"Initial",requirement:"Required",duration:"2 hours",frequency:"One-time",link:"#",roles:["Operations Supervisor","Fleet Coordinator","Warehouse Lead","Safety Officer","Compliance Analyst","Incident Coordinator","HR Generalist","Recruitment Specialist","Benefits Coordinator","Accounting Technician","Budget Analyst","Procurement Specialist","Executive Assistant","Office Manager","Program Coordinator","IT Support Analyst","Systems Administrator","Network Technician","Engineering Technician","Project Engineer","Quality Engineer","Communications Specialist","Public Affairs Officer","Digital Media Coordinator"]},
        {id:"TRN-002",title:"Annual Information Security",description:"Information security awareness and responsible handling of information.",category:"Mandatory",requirement:"Required",duration:"1 hour",frequency:"Annual",link:"#",roles:["Operations Supervisor","Fleet Coordinator","Warehouse Lead","Safety Officer","Compliance Analyst","Incident Coordinator","HR Generalist","Recruitment Specialist","Benefits Coordinator","Accounting Technician","Budget Analyst","Procurement Specialist","Executive Assistant","Office Manager","Program Coordinator","IT Support Analyst","Systems Administrator","Network Technician","Engineering Technician","Project Engineer","Quality Engineer","Communications Specialist","Public Affairs Officer","Digital Media Coordinator"]},
        {id:"TRN-003",title:"Role-Specific Qualification",description:"Training associated with the responsibilities of your assigned position.",category:"Role-Specific",requirement:"Required",duration:"Varies",frequency:"As assigned",link:"#",roles:["Operations Supervisor","Fleet Coordinator","Warehouse Lead","Safety Officer","Compliance Analyst","Incident Coordinator","HR Generalist","Recruitment Specialist","Benefits Coordinator","Accounting Technician","Budget Analyst","Procurement Specialist","Executive Assistant","Office Manager","Program Coordinator","IT Support Analyst","Systems Administrator","Network Technician","Engineering Technician","Project Engineer","Quality Engineer","Communications Specialist","Public Affairs Officer","Digital Media Coordinator"]},
        {id:"TRN-004",title:"Advanced Professional Development",description:"Additional technical and professional development opportunities.",category:"Advanced",requirement:"Optional",duration:"4 hours",frequency:"As available",link:"#",roles:["Operations Supervisor","Safety Officer","Compliance Analyst","HR Generalist","Accounting Technician","Budget Analyst","IT Support Analyst","Systems Administrator","Project Engineer","Quality Engineer","Communications Specialist","Public Affairs Officer","Digital Media Coordinator"]},
        {id:"TRN-005",title:"Annual Refresher",description:"Review of applicable processes and qualification expectations.",category:"Refresher",requirement:"Required",duration:"1 hour",frequency:"Annual",link:"#",roles:["Operations Supervisor","Fleet Coordinator","Warehouse Lead","Safety Officer","Compliance Analyst","Incident Coordinator","HR Generalist","Recruitment Specialist","Benefits Coordinator","Accounting Technician","Budget Analyst","Procurement Specialist","Executive Assistant","Office Manager","Program Coordinator","IT Support Analyst","Systems Administrator","Network Technician","Engineering Technician","Project Engineer","Quality Engineer","Communications Specialist","Public Affairs Officer","Digital Media Coordinator"]},
        {id:"TRN-006",title:"Fleet Operations Safety",description:"Safe operations, vehicle readiness checks, and proper use of operational equipment.",category:"Role-Specific",requirement:"Required",duration:"3 hours",frequency:"Annual",link:"#",roles:["Fleet Coordinator","Warehouse Lead","Operations Supervisor"]},
        {id:"TRN-007",title:"Recruitment and Onboarding Workflow",description:"Best practices for hiring coordination, onboarding support, and employee documentation.",category:"Role-Specific",requirement:"Required",duration:"2 hours",frequency:"Annual",link:"#",roles:["HR Generalist","Recruitment Specialist","Executive Assistant","Office Manager"]},
        {id:"TRN-008",title:"IT Help Desk Fundamentals",description:"Support techniques for troubleshooting, access requests, and service documentation.",category:"Role-Specific",requirement:"Required",duration:"3 hours",frequency:"Annual",link:"#",roles:["IT Support Analyst","Systems Administrator","Network Technician"]},
        {id:"TRN-009",title:"Engineering Quality Standards",description:"Quality review processes and technical validation standards used by engineering teams.",category:"Role-Specific",requirement:"Required",duration:"3 hours",frequency:"Annual",link:"#",roles:["Engineering Technician","Project Engineer","Quality Engineer"]},
        {id:"TRN-010",title:"Public Communications Essentials",description:"Core communication standards, message consistency, and audience awareness.",category:"Role-Specific",requirement:"Required",duration:"2 hours",frequency:"Annual",link:"#",roles:["Communications Specialist","Public Affairs Officer","Digital Media Coordinator"]}
    ],
    references: [
        {id:"REF-001",title:"Governing Instructions",description:"Official instructions and governing guidance.",category:"Policies",revision:"Review date: Not specified",type:"Document",link:"#"},
        {id:"REF-002",title:"Standard Operating Procedures",description:"Procedures supporting routine organizational activities.",category:"SOPs",revision:"Review date: Not specified",type:"Document",link:"#"},
        {id:"REF-003",title:"Training Guide",description:"General training guidance and qualification information.",category:"Training Guides",revision:"Review date: Not specified",type:"PDF",link:"#"},
        {id:"REF-004",title:"Qualification Checklist",description:"A reference checklist for tracking qualification requirements.",category:"Templates",revision:"Review date: Not specified",type:"Template",link:"#"}
    ],
    faqs: [
        {category:"Access & Roles",question:"Can I search for a role if I do not sign in?",answer:"You can browse the Division and Branch choices and see available roles, but selecting Search Role requires a signed-in profile and sends signed-out visitors to Sign In. Sign in first to view and save a role."},
        {category:"Access & Roles",question:"How do I sign in or create an account?",answer:"Use the Account button in the upper-right corner. On the Sign In page, enter your account details or choose Create an Account. This portal uses a temporary browser-side account flow and is not a secure production authentication service."},
        {category:"Access & Roles",question:"How do I sign out?",answer:"Open the Account menu in the upper-right corner and choose Sign out. Signing out clears the selected role for the current browser session."},
        {category:"Access & Roles",question:"How do I select a role?",answer:"Open Role Overview, choose a Division, Branch, and Role, then select Search Role. The selected role is used to filter role-related information elsewhere in the portal."},
        {category:"Access & Roles",question:"How do I change or clear my selected role?",answer:"Go to Role Overview and choose a different role, or use Clear Filters to clear the current selection. You can then search for and save another role."},
        {category:"Access & Roles",question:"What happens if I have not selected a role?",answer:"If you are signed in without a selected role, the Dashboard shows N/A for role details and 0 available courses. Signed-out role-specific data is shown as N/A. Sign in, then select a role in Role Overview to see role-based courses and TQS requirements."},
        {category:"Training Courses",question:"Where do I find courses for my role?",answer:"Open Training Courses from the main menu or Dashboard Quick Access. After you sign in and select a role, the catalog lists courses associated with that role."},
        {category:"Training Courses",question:"How do I search or filter the course catalog?",answer:"Use the course search and the category, status, and sort controls above the catalog. Choose Clear Filters to restore the default view."},
        {category:"Training Courses",question:"How do I start a course?",answer:"Choose View Details for a course, then select Start Course. The portal records it as In Progress. If course materials are linked, Continue Course opens them."},
        {category:"Training Courses",question:"Why does a course not have a link to training materials?",answer:"Some catalog entries do not yet have course materials linked. You can still see the course and its tracking status, but the portal cannot open materials that have not been provided. Contact the appropriate support team for guidance."},
        {category:"Training Courses",question:"Where can I find courses I have started?",answer:"When signed in with a selected role, started courses associated with that role appear in Continue Learning on the Dashboard."},
        {category:"Training Courses",question:"How do I mark a course complete or undo completion?",answer:"Open View Details and use Mark as completed. To undo it, choose Mark as not completed. Course completion is stored in this browser and is not submitted to a training system."},
        {category:"Training Courses",question:"How is the Role Qualification Progress percentage calculated?",answer:"It is the number of completed required courses for the selected role divided by that role's required courses. Optional courses are not included. TQS Support uses its own requirement progress tracker."},
        {category:"TQS & Progress",question:"Why are Training Courses progress and TQS progress different?",answer:"Training Courses tracks course catalog completion and started-course status. TQS Support tracks each listed role requirement by account and role. Updating one tracker does not automatically update the other."},
        {category:"TQS & Progress",question:"Where do I find my role's TQS requirements?",answer:"Open TQS Support from the main menu or Dashboard Quick Access. Sign in and select a role in Role Overview first. The page organizes the role's listed required courses into a progress checklist."},
        {category:"TQS & Progress",question:"How do I mark a TQS requirement In Progress or Completed?",answer:"In TQS Support, use the requirement's checkbox to mark it complete or incomplete. Open its details to use the available status actions, including In Progress."},
        {category:"TQS & Progress",question:"Is my TQS progress saved?",answer:"TQS progress is saved locally in this browser and associated with the signed-in account identifier and selected role. It is not synced to a server or other devices, so browser storage may need to be retained to preserve it."},
        {category:"TQS & Progress",question:"What does Qualified mean on the Dashboard?",answer:"It means all required items tracked for the selected role are marked complete in TQS Support. This status is a progress indicator only; it is not an official certification or approval."},
        {category:"Help & Resources",question:"Where can I find policies and reference materials?",answer:"Open References from the main menu or Dashboard Helpful Resources. Check the revision and currency of any document with its authoritative source before relying on it."},
        {category:"Help & Resources",question:"Where can I get help, and are Policy Updates available?",answer:"Open Contact / Help for support guidance and use your organization's approved contact channels. Policy Updates are currently marked Coming Soon; check References for materials already listed in the portal."}
    ]
};

(() => {
    const databaseName = "govsiteTrainingContent";
    const storeNames = [
        "documents",
        "originalFiles",
        "sourceContent",
        "organizationMetadata",
        "reviews",
        "modules"
    ];

    const openDatabase = () => new Promise((resolve, reject) => {
        if (!window.indexedDB) {
            reject(new Error("This browser does not support local document storage."));
            return;
        }
        const request = window.indexedDB.open(databaseName, 1);
        request.onupgradeneeded = () => {
            const database = request.result;
            storeNames.forEach(name => {
                if (!database.objectStoreNames.contains(name)) {
                    database.createObjectStore(name, {keyPath: name === "organizationMetadata" || name === "reviews" ? "contentId" : "id"});
                }
            });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("Unable to open local document storage."));
        request.onblocked = () => reject(new Error("Local document storage is blocked by another open portal tab."));
    });

    const trainingContentStore = {
        async readAll(names = storeNames) {
            const database = await openDatabase();
            return new Promise((resolve, reject) => {
                const transaction = database.transaction(names, "readonly");
                const result = {};
                names.forEach(name => {
                    const request = transaction.objectStore(name).getAll();
                    request.onsuccess = () => {
                        result[name] = request.result;
                    };
                    request.onerror = () => reject(request.error || new Error(`Unable to read ${name} from local document storage.`));
                });
                transaction.oncomplete = () => {
                    database.close();
                    resolve(result);
                };
                transaction.onerror = () => {
                    database.close();
                    reject(transaction.error || new Error("Unable to read local document storage."));
                };
                transaction.onabort = () => {
                    database.close();
                    reject(transaction.error || new Error("The local document storage read was interrupted."));
                };
            });
        },

        async saveMany(recordsByStore, deletesByStore = {}) {
            const names = [...new Set([...Object.keys(recordsByStore), ...Object.keys(deletesByStore)])];
            if (!names.length) return;
            const database = await openDatabase();
            return new Promise((resolve, reject) => {
                const transaction = database.transaction(names, "readwrite");
                Object.entries(recordsByStore).forEach(([name, records]) => {
                    const objectStore = transaction.objectStore(name);
                    records.forEach(record => objectStore.put(record));
                });
                Object.entries(deletesByStore).forEach(([name, ids]) => {
                    const objectStore = transaction.objectStore(name);
                    ids.forEach(id => objectStore.delete(id));
                });
                transaction.oncomplete = () => {
                    database.close();
                    resolve();
                };
                transaction.onerror = () => {
                    database.close();
                    reject(transaction.error || new Error("Unable to save changes to local document storage."));
                };
                transaction.onabort = () => {
                    database.close();
                    reject(transaction.error || new Error("The local document storage update was interrupted."));
                };
            });
        },

        async getOriginal(id) {
            const database = await openDatabase();
            return new Promise((resolve, reject) => {
                const transaction = database.transaction("originalFiles", "readonly");
                const request = transaction.objectStore("originalFiles").get(id);
                request.onsuccess = () => resolve(request.result || null);
                request.onerror = () => reject(request.error || new Error("Unable to read the original handbook."));
                transaction.oncomplete = () => database.close();
                transaction.onerror = () => {
                    database.close();
                    reject(transaction.error || new Error("Unable to read the original handbook."));
                };
            });
        }
    };

    window.TrainingContentStore = Object.freeze(trainingContentStore);
    window.PortalData.publishedTrainingModules = [];
    window.PortalDataReady = trainingContentStore.readAll(["documents", "sourceContent", "reviews", "modules"])
        .then(({documents, sourceContent, reviews, modules}) => {
            const documentsById = new Map(documents.map(item => [item.id, item]));
            const sourceById = new Map(sourceContent.map(item => [item.id, item]));
            const reviewById = new Map(reviews.map(item => [item.contentId, item]));
            const publishableModules = modules.filter(module =>
                module.publicationStatus === "Published"
                && Array.isArray(module.sourceContentIds)
                && module.sourceContentIds.length > 0
                && module.sourceContentIds.every(id =>
                    sourceById.has(id)
                    && documentsById.has(sourceById.get(id).documentId)
                    && reviewById.get(id)?.status === "Approved"
                )
            );
            const moduleCourses = publishableModules.map(module => {
                const sourceItems = module.sourceContentIds.map(id => sourceById.get(id));
                const courseId = `HANDBOOK-${module.id}`;
                const assignment = module.assignment || {
                    division: module.division || "",
                    branch: module.branch || "",
                    role: module.role || (Array.isArray(module.roleIds) ? module.roleIds[0] : "")
                };
                const course = {
                    id: courseId,
                    title: module.title,
                    description: sourceItems.map(item => item.sourceText).join("\n\n"),
                    category: module.category || "Handbook-based",
                    requirement: "Optional",
                    duration: "Not specified in source",
                    frequency: "Not specified in source",
                    link: `required-training.html?course=${encodeURIComponent(courseId)}`,
                    roles: assignment.role ? [assignment.role] : (module.roleIds || []),
                    assignment,
                    division: assignment.division,
                    branch: assignment.branch,
                    role: assignment.role,
                    sourceContentIds: module.sourceContentIds,
                    tqsRequirementIds: module.tqsRequirementIds || [],
                    originalDocuments: [...new Set(sourceItems.map(item => item.documentId))],
                    sourceReferences: sourceItems.map(item => ({
                        id: item.id,
                        documentName: item.originalDocumentName,
                        pageNumber: item.pageNumber,
                        sectionNumber: item.sectionNumber
                    }))
                };
                return {module, course};
            });
            window.PortalData.publishedTrainingModules = moduleCourses.map(({module, course}) => ({
                id: module.id,
                title: module.title,
                courseId: course.id,
                roleIds: course.roles,
                assignment: course.assignment,
                tqsRequirementIds: course.tqsRequirementIds,
                sourceContentIds: module.sourceContentIds
            }));
            window.PortalData.courses.push(...moduleCourses.map(({course}) => course));
        })
        .catch(error => {
            console.error("Unable to load locally published training content.", error);
            window.PortalData.contentLoadError = error;
        });
})();
