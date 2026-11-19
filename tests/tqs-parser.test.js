const {test} = require("node:test");
const assert = require("node:assert/strict");
const {parse} = require("../assets/pages/tqs-support/tqs-parser.js");

test("groups requirements in source order without changing their numbering or text", () => {
    const result = parse([
        "03.0 INFORMATION SECURITY",
        "03.1.2 Review local procedures.",
        "03.1.1 Complete awareness training.",
        "4.0 ADMINISTRATIVE PROCEDURES",
        "4.2.3 Maintain approved records."
    ].join("\r\n"));

    assert.deepEqual(result.modules.map(({moduleNumber, moduleTitle, displayOrder}) =>
        [moduleNumber, moduleTitle, displayOrder]), [
        ["03.0", "INFORMATION SECURITY", 0],
        ["4.0", "ADMINISTRATIVE PROCEDURES", 1]
    ]);
    assert.deepEqual(result.modules[0].requirements.map(({requirementNumber, requirementText, displayOrder, required}) =>
        [requirementNumber, requirementText, displayOrder, required]), [
        ["03.1.2", "Review local procedures.", 0, true],
        ["03.1.1", "Complete awareness training.", 1, true]
    ]);
    assert.equal(result.modules[1].requirements[0].requirementNumber, "4.2.3");
    assert.equal(result.warnings.length, 0);
    assert.equal(new Set(result.modules.flatMap(module => [module.id, ...module.requirements.map(item => item.id)])).size, 5);
});

test("retains and warns about requirements before or outside the current module", () => {
    const result = parse("3.1.1 Before heading\n3.0 First\n4.1.1 Wrong module\n4.0 Second\n4.1.2 Valid");
    assert.deepEqual(result.unassignedRequirements.map(item => item.requirementNumber), ["3.1.1", "4.1.1"]);
    assert.deepEqual(result.warnings.map(warning => warning.line), [1, 3]);
    assert.deepEqual(result.modules.map(module => module.requirements.length), [0, 1]);
});

test("warns about ambiguous duplicate numbers and unrecognized lines without dropping their text", () => {
    const result = parse("3.0 First\n3.1.1 First item\ncontinuation text\n3.0 Again\n3.1.1 Duplicate");
    assert.equal(result.warnings.length, 3);
    assert.equal(result.warnings[0].sourceText, "continuation text");
    assert.match(result.warnings[1].message, /Duplicate module/);
    assert.match(result.warnings[2].message, /Duplicate requirement/);
    assert.throws(() => parse(null), TypeError);
});

test("does not attach requirements to a previous module after a malformed heading", () => {
    const result = parse("3.0 Valid\n4.0\n3.1.1 Needs review");
    assert.equal(result.modules[0].requirements.length, 0);
    assert.equal(result.unassignedRequirements[0].requirementNumber, "3.1.1");
    assert.deepEqual(result.warnings.map(warning => warning.line), [2, 3]);
});
