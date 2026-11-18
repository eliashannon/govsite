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

    window.HandbookProcessor = Object.freeze({
        async extract(file) {
            const extension = file.name.toLowerCase().split(".").pop();
            if (extension === "pdf") return extractPdf(file);
            if (extension === "docx") return extractDocx(file);
            throw new Error("Only PDF and DOCX handbooks can be processed.");
        }
    });
})();
