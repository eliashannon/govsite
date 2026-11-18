(() => {
    const sectionNumberPattern = /^\s*((?:chapter|section)\s+)?((?:\d+|[A-Z])(?:\.\d+)*(?:[.)])?)(?=\s|$)/i;
    const requirementPattern = /\b(shall|must|required|is to|are to)\b/i;
    const checklistPattern = /^\s*(?:☐|□|\[\s?\]|\(\s?\))\s*/;
    const numberedStepPattern = /^\s*(?:step\s+)?\d+[.)]\s+/i;

    const inferHeadingLevel = text => {
        const value = String(text).trim();
        if (/^chapter\s+\S+/i.test(value)) return 1;
        if (/^section\s+\S+/i.test(value) || /^\d+(?:\.\d+)*\s+\S+/.test(value)) return 2;
        return 2;
    };

    const getSectionNumber = text => {
        const match = String(text).match(sectionNumberPattern);
        return match ? match[2].replace(/[.)]$/, "") : "";
    };

    const isHeading = text => {
        const value = String(text).trim();
        return /^(chapter|section)\s+\S+/i.test(value)
            || /^\d+(?:\.\d+)*\s+\S+/.test(value)
            || (value.length >= 5 && value.length <= 100 && value === value.toLocaleUpperCase() && /[A-Z]/.test(value));
    };

    const classifyBlock = (text, blockKind, headingLevel) => {
        const value = String(text).trim();
        if (headingLevel) {
            return {
                category: "Structure",
                contentType: headingLevel === 1 ? "Chapter" : headingLevel === 2 ? "Section" : "Subsection",
                confidence: "High"
            };
        }
        if (blockKind === "table") {
            return {category: "Reference material", contentType: "Table", confidence: "High"};
        }
        if (checklistPattern.test(value)) {
            return {category: "Checklist", contentType: "Checklist item", confidence: "High"};
        }
        if (requirementPattern.test(value)) {
            return {category: "Requirement", contentType: "Requirement", confidence: "Needs review"};
        }
        if (numberedStepPattern.test(value)) {
            return {category: "Procedure", contentType: "Procedure step", confidence: "Needs review"};
        }
        if (blockKind === "list") {
            return {category: "Reference material", contentType: "List item", confidence: "Needs review"};
        }
        return {category: "Reference material", contentType: "Text", confidence: "Needs review"};
    };

    const createBlock = (text, details = {}) => {
        if (!String(text).trim()) return null;
        const headingLevel = details.headingLevel || (details.blockKind === "pdf-text" && isHeading(text) ? inferHeadingLevel(text) : 0);
        const classification = classifyBlock(text, details.blockKind, headingLevel);
        return {
            sourceText: text,
            tableCells: details.tableCells || null,
            pageNumber: details.pageNumber || null,
            sectionNumber: details.sectionNumber || (headingLevel || /^(chapter|section)\s+/i.test(text.trim())
                ? getSectionNumber(text)
                : ""),
            headingPath: details.headingPath || [],
            category: classification.category,
            contentType: classification.contentType,
            confidence: details.forceReview ? "Needs review" : classification.confidence,
            warnings: details.warnings || []
        };
    };

    const extractPdf = async file => {
        if (!window.pdfjsLib) throw new Error("The local PDF text parser is unavailable.");
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
            "assets/pages/ai-training-content-manager/vendor/pdf.worker.min.js";
        const pdf = await window.pdfjsLib.getDocument({data: await file.arrayBuffer()}).promise;
        const blocks = [];
        const warnings = [];
        const headingPath = [];
        try {
            for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
                const page = await pdf.getPage(pageNumber);
                const textContent = await page.getTextContent();
                let line = "";
                let pageText = "";
                const flushLine = () => {
                    if (!line.trim()) {
                        line = "";
                        return;
                    }
                    pageText += `${line}\n`;
                    const block = createBlock(line, {pageNumber, blockKind: "pdf-text", forceReview: true});
                    if (block) {
                        if (block.category === "Structure") {
                            const headingLevel = inferHeadingLevel(line);
                            headingPath.length = headingLevel - 1;
                            headingPath[headingLevel - 1] = line.trim();
                        }
                        block.headingPath = [...headingPath];
                        blocks.push(block);
                    }
                    line = "";
                };
                textContent.items.forEach(item => {
                    if (typeof item.str !== "string") return;
                    if (line && item.str && !/\s$/.test(line) && !/^\s/.test(item.str)) line += " ";
                    line += item.str;
                    if (item.hasEOL) flushLine();
                });
                flushLine();
                if (!pageText.trim()) warnings.push(`Page ${pageNumber} contains no selectable text; it may be scanned or unreadable.`);
            }
        } finally {
            await pdf.destroy();
        }
        if (!blocks.length) {
            throw new Error("No selectable text was found. Scanned pages need an approved OCR service; no OCR or generated text was used.");
        }
        warnings.unshift("PDF layout and table structure may not be preserved by text extraction. Verify every item against the original.");
        return {blocks, warnings, pageCount: pdf.numPages};
    };

    const extractDocx = async file => {
        if (!window.mammoth) throw new Error("The local DOCX text parser is unavailable.");
        const result = await window.mammoth.convertToHtml({arrayBuffer: await file.arrayBuffer()});
        const parsed = new DOMParser().parseFromString(result.value, "text/html");
        const blocks = [];
        const warnings = (result.messages || []).map(message => message.message);
        if (parsed.querySelector("img")) {
            warnings.push("Embedded images and diagrams were not converted to text; inspect them in the original document.");
        }
        warnings.push("Verify headers, footers, text boxes, and document-specific layout in the original; this text extractor may not include them.");
        const headingPath = [];

        const addHeading = (element, level) => {
            const text = element.textContent;
            if (!text.trim()) return;
            headingPath.length = level - 1;
            headingPath[level - 1] = text.trim();
            const block = createBlock(text, {
                blockKind: "heading",
                headingLevel: level,
                sectionNumber: getSectionNumber(text),
                headingPath: [...headingPath]
            });
            if (block) blocks.push(block);
        };

        const visit = node => {
            if (node.nodeType !== Node.ELEMENT_NODE) return;
            const tag = node.tagName.toLowerCase();
            const headingMatch = tag.match(/^h([1-6])$/);
            if (headingMatch) {
                addHeading(node, Number(headingMatch[1]));
                return;
            }
            if (tag === "table") {
                node.querySelectorAll("tr").forEach(row => {
                    const tableCells = [...row.querySelectorAll("th,td")].map(cell => cell.textContent);
                    const block = createBlock(tableCells.join("\t"), {
                        blockKind: "table",
                        tableCells,
                        headingPath: [...headingPath]
                    });
                    if (block) blocks.push(block);
                });
                return;
            }
            if (tag === "ul" || tag === "ol") {
                Array.from(node.children).filter(child => child.tagName.toLowerCase() === "li").forEach(item => {
                    const itemCopy = item.cloneNode(true);
                    itemCopy.querySelectorAll("ul,ol").forEach(nestedList => nestedList.remove());
                    const block = createBlock(itemCopy.textContent, {
                        blockKind: "list",
                        headingPath: [...headingPath]
                    });
                    if (block) blocks.push(block);
                    Array.from(item.children)
                        .filter(child => ["ul", "ol"].includes(child.tagName.toLowerCase()))
                        .forEach(visit);
                });
                return;
            }
            if (tag === "p") {
                const block = createBlock(node.textContent, {headingPath: [...headingPath]});
                if (block) blocks.push(block);
                return;
            }
            Array.from(node.children).forEach(visit);
        };

        Array.from(parsed.body.children).forEach(visit);
        if (!blocks.length) throw new Error("No readable text was found in the DOCX document.");
        warnings.push("DOCX pagination is not stored reliably in the file; page references are unavailable. Use the section references and verify the original.");
        return {blocks, warnings, pageCount: null};
    };

    const parseCourseText = (text, fileName) => {
        const lines = String(text).replace(/\r\n?/g, "\n").split("\n");
        const course = {
            id: "", title: "", shortDescription: "", description: "", category: "", difficulty: "",
            durationMinutes: 0, version: "1.0", learningObjectives: [], roleAssignments: [],
            status: "draft", source: {fileName}, modules: [], warnings: []
        };
        const moduleHeadingPattern = /^\s*(?:(?:MODULE)\s*)?((?:\d+\.)+\d+|\d+\.\d+)\s*(?:[:\-]\s*|\s+)(.+?)\s*$/i;
        const moduleHeadingWithColon = /^\s*MODULE\s+((?:\d+\.)*\d+(?:\.\d+)*)\s*[:\-]?\s*(.*?)\s*$/i;
        const modulePattern = value => {
            const match = value.match(moduleHeadingWithColon) || value.match(moduleHeadingPattern);
            if (!match) return null;
            const number = match[1].replace(/[.:]$/, "");
            return {number, title: (match[2] || "").trim()};
        };
        let section = "";
        let currentModule = null;
        let pendingTable = false;
        let textTable = null;
        let callout = null;

        const addCourseLink = line => {
            const linkMatch = line.match(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|[A-Za-z0-9_./-]+)\)/i);
            if (linkMatch) return {type:"link", text:linkMatch[1], url:linkMatch[2]};
            const bareMatch = line.match(/^(?:(.*?)\s*:\s*)?(https?:\/\/\S+?)(?:\s+\[\d+\])?$/i);
            if (bareMatch) return {type:"link", text:bareMatch[1] || "Open reference", url:bareMatch[2]};
            return null;
        };
        const safeLine = line => line.trim();

        lines.forEach(rawLine => {
            const line = safeLine(rawLine);
            if (!line) return;
            if (textTable) {
                textTable.cells.push(line);
                if (textTable.cells.length === textTable.rows * textTable.cols) {
                    const rows = [];
                    for (let i = 0; i < textTable.cells.length; i += textTable.cols) rows.push(textTable.cells.slice(i, i + textTable.cols));
                    currentModule.content.push({type:"table", headers:[], rows});
                    textTable = null;
                    section = "CONTENT";
                }
                return;
            }
            if (currentModule && section === "TABLE" && /^\d+\s+rows?\s*x\s*\d+\s+cols?$/i.test(line)) {
                const dimensions = line.match(/^(\d+)\s+rows?\s*x\s*(\d+)\s+cols?$/i);
                textTable = {rows:Number(dimensions[1]), cols:Number(dimensions[2]), cells:[]};
                if (!textTable.rows || !textTable.cols || textTable.rows * textTable.cols > 10000) {
                    throw new Error("The course table has invalid dimensions.");
                }
                return;
            }
            if (line === "[TABLE]" && currentModule) {
                pendingTable = true;
                return;
            }
            if (pendingTable && currentModule) {
                try {
                    const table = JSON.parse(line);
                    if (Array.isArray(table.headers) && Array.isArray(table.rows)) {
                        currentModule.content.push({
                            type: "table",
                            headers: table.headers.filter(item => typeof item === "string"),
                            rows: table.rows.filter(Array.isArray).map(row => row.filter(item => typeof item === "string"))
                        });
                    }
                } catch (error) {
                    throw new Error(`Unable to parse the course table: ${error.message}`);
                }
                pendingTable = false;
                section = "CONTENT";
                return;
            }
            const heading = modulePattern(line);
            if (heading) {
                callout = null;
                currentModule = {
                    id: "", sourceModuleNumber: heading.number, title: heading.title, order: course.modules.length + 1,
                    estimatedMinutes: 10, learningObjectives: [], content: [],
                    source: {fileName, section: heading.number}
                };
                course.modules.push(currentModule);
                section = "MODULE";
                return;
            }
            const upper = line.replace(/:$/, "").toUpperCase();
            if (["COURSE","COURSE DESCRIPTION","LEARNING OBJECTIVES","MODULE OBJECTIVES","CONTENT","REFERENCES","SOURCE INFORMATION"].includes(upper)) {
                section = upper;
                callout = null;
                return;
            }
            if (currentModule && /^(?:KEY POINT|FINAL KEY POINT|WARNING|CALLOUT)$/.test(upper)) {
                section = "CALLOUT";
                callout = {type:"callout", variant:upper === "WARNING" ? "warning" : "info", title:upper === "CALLOUT" ? "" : line, text:""};
                currentModule.content.push(callout);
                return;
            }
            if (currentModule && /^TABLE\s*:/i.test(line)) {
                section = "TABLE";
                callout = null;
                currentModule.content.push({type:"heading", level:3, text:line.replace(/^TABLE\s*:\s*/i, "")});
                return;
            }
            if (currentModule && line.length <= 100 && /^[A-Z][A-Z0-9\s&/-]+$/.test(line)) {
                section = /(?:LIST|CHECKLIST|PRINCIPLES|HABITS|WORKFLOW|SUMMARY|INFORMATION)$/.test(upper) ? "LIST" : "CONTENT";
                callout = null;
                currentModule.content.push({type:"heading", level:3, text:line});
                return;
            }
            if (section === "CALLOUT" && callout) {
                if (/^Title\s*:/i.test(line)) callout.title = line.replace(/^Title\s*:\s*/i, "");
                else if (/^Variant\s*:/i.test(line)) callout.variant = /^warning$/i.test(line.replace(/^Variant\s*:\s*/i, "")) ? "warning" : "info";
                else callout.text = [callout.text, line].filter(Boolean).join(" ");
                return;
            }
            if (/^COURSE\s+ID\s*:/i.test(line)) { course.id = line.replace(/^COURSE\s+ID\s*:\s*/i,"").trim(); return; }
            if (/^COURSE\s+TITLE\s*:/i.test(line)) { course.title = line.replace(/^COURSE\s+TITLE\s*:\s*/i,"").trim(); return; }
            if (/^SHORT\s+DESCRIPTION\s*:/i.test(line) && !currentModule) { course.shortDescription = line.replace(/^SHORT\s+DESCRIPTION\s*:\s*/i,"").trim(); return; }
            if (section === "SOURCE INFORMATION" && !currentModule) {
                const field = line.match(/^([^:]+):\s*(.*)$/);
                if (field) course.source[field[1].trim()] = field[2].trim();
                return;
            }
            if (/^CATEGORY\s*:/i.test(line)) { course.category = line.replace(/^CATEGORY\s*:\s*/i,"").trim(); return; }
            if (/^DIFFICULTY\s*:/i.test(line)) { course.difficulty = line.replace(/^DIFFICULTY\s*:\s*/i,"").trim(); return; }
            if (/^DURATION\s+MINUTES\s*:/i.test(line)) { course.durationMinutes = Number(line.replace(/^DURATION\s+MINUTES\s*:\s*/i,"").trim()) || 0; return; }
            if (/^VERSION\s*:/i.test(line)) { course.version = line.replace(/^VERSION\s*:\s*/i,"").trim(); return; }
            if (/^(DIVISION|BRANCH|ROLE)\s*:/i.test(line)) {
                const match = line.match(/^([A-Z]+)\s*:\s*(.+)$/i);
                if (match) {
                    if (match[1].toLowerCase() === "division") course._division = match[2].trim();
                    if (match[1].toLowerCase() === "branch") course._branch = match[2].trim();
                    if (match[1].toLowerCase() === "role") course._role = match[2].trim();
                }
                return;
            }
            if (section === "COURSE DESCRIPTION") {
                course.description = [course.description, line].filter(Boolean).join(" ");
            } else if (section === "LEARNING OBJECTIVES") {
                const item = line.replace(/^[-*•]\s*/, "").replace(/^\d+[.)]\s*/, "").trim();
                if (item) course.learningObjectives.push(item);
            } else if (currentModule && section === "MODULE OBJECTIVES") {
                const item = line.replace(/^[-*•]\s*/, "").replace(/^\d+[.)]\s*/, "").trim();
                if (item) currentModule.learningObjectives.push(item);
            } else if (currentModule && ["CONTENT","MODULE","REFERENCES","LIST","TABLE"].includes(section)) {
                if (section === "REFERENCES") {
                    const link = addCourseLink(line);
                    if (link) currentModule.content.push(link);
                    else currentModule.content.push({type:"paragraph",text:line.replace(/^[-*•]\s*/, "")});
                } else {
                    const bullet = line.match(/^[-*•]\s+(.+)$/);
                    const numbered = line.match(/^\d+[.)]\s+(.+)$/);
                    if (bullet || numbered || (section === "LIST" && !line.endsWith(":"))) {
                        const item = bullet || numbered ? (bullet || numbered)[1] : line;
                        const previous = currentModule.content[currentModule.content.length - 1];
                        if (previous?.type === "list" && previous.style === (numbered ? "ordered" : "unordered")) previous.items.push(item);
                        else currentModule.content.push({type:"list", style:numbered ? "ordered":"unordered", items:[item]});
                    } else if (/^KEY POINT/i.test(line)) {
                        currentModule.content.push({type:"callout",variant:"info",title:"Key Point",text:""});
                    } else if (line.toUpperCase() === "WARNING") {
                        currentModule.content.push({type:"callout",variant:"warning",title:"Warning",text:""});
                    } else {
                        const link = addCourseLink(line);
                        if (link) currentModule.content.push(link);
                        else {
                            const callout = currentModule.content[currentModule.content.length - 1];
                            if (callout?.type === "callout" && !callout.text) callout.text = line;
                            else currentModule.content.push({type:"paragraph",text:line});
                        }
                    }
                }
            }
        });

        if (textTable || pendingTable || section === "TABLE") course.warnings.push("A table could not be fully extracted; check the original document.");
        if (course._division || course._branch || course._role) {
            course.roleAssignments = course._division && course._branch && course._role ? [{
                divisionId: course._division.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""),
                branchId: course._branch.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""),
                roleId: course._role.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""),
                required:true
            }] : [];
        }
        delete course._division; delete course._branch; delete course._role;
        const validIdBase = course.title.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
        if (!/^[a-z0-9][a-z0-9_-]*$/.test(course.id) && validIdBase) course.id = validIdBase;
        course.modules.forEach((module, index) => {
            if (!module.id) module.id = `${course.id || "course"}-module-${module.sourceModuleNumber.replace(/\./g,"-")}`;
            module.order = index + 1;
        });
        return course;
    };

    const extractCourseFromDocx = async file => {
        if (!window.mammoth) throw new Error("The local DOCX text parser is unavailable.");
        const result = await window.mammoth.convertToHtml({arrayBuffer: await file.arrayBuffer()});
        const parsed = new DOMParser().parseFromString(result.value, "text/html");
        const pseudoLines = [];
        const visit = node => {
            if (node.nodeType !== Node.ELEMENT_NODE) return;
            const tag = node.tagName.toLowerCase();
            if (/^h[1-6]$/.test(tag)) { pseudoLines.push(node.textContent.trim()); return; }
            if (tag === "table") {
                const rows = [...node.querySelectorAll("tr")].map(row => [...row.querySelectorAll("th,td")].map(cell => cell.textContent.trim()));
                if (rows.length) pseudoLines.push("[TABLE]", JSON.stringify({headers:rows[0],rows:rows.slice(1)}));
                return;
            }
            if (tag === "ul" || tag === "ol") {
                [...node.children].forEach(item => {
                    if (item.tagName.toLowerCase() === "li") pseudoLines.push(`- ${item.textContent.trim()}`);
                });
                return;
            }
            if (tag === "p") {
                const links = [...node.querySelectorAll("a")];
                if (links.length === 1 && node.textContent.trim() === links[0].textContent.trim()) {
                    const href = links[0].getAttribute("href") || "";
                    pseudoLines.push(`[${links[0].textContent.trim()}](${href})`);
                } else pseudoLines.push(node.textContent.trim());
                return;
            }
            [...node.children].forEach(visit);
        };
        [...parsed.body.children].forEach(visit);
        return parseCourseText(pseudoLines.join("\n"), file.name);
    };

    window.HandbookProcessor = Object.freeze({
        async extract(file) {
            const extension = file.name.toLowerCase().split(".").pop();
            if (extension === "pdf") return extractPdf(file);
            if (extension === "docx") return extractDocx(file);
            if (extension === "txt" || extension === "md") {
                const text = await file.text();
                const blocks = text.split(/\n{2,}/).filter(Boolean).map(sourceText => createBlock(sourceText.trim(), {blockKind:extension==="md"?"markdown":"text"}));
                if (!blocks.length) throw new Error("The text document is empty.");
                return {blocks:blocks.filter(Boolean), warnings:[], pageCount:null};
            }
            throw new Error("Only PDF, DOCX, TXT, and Markdown files can be processed.");
        },
        async extractCourse(file) {
            const extension = file.name.toLowerCase().split(".").pop();
            if (extension === "docx") return extractCourseFromDocx(file);
            if (extension === "txt" || extension === "md") return parseCourseText(await file.text(), file.name);
            throw new Error("Only DOCX, TXT, and Markdown course documents are supported.");
        }
    });
})();
