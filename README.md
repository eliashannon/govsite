Modernize Existing TQS Support Left Page

I want to transform my existing “TQS Support Left” page into a modern, professional Training Qualification Standards tracking system.

IMPORTANT: The website already exists. Only modify the existing TQS Support Left page and its directly associated components or styling. Do not rebuild the website or modify other pages.

The purpose of this page is to allow employees to view the Training Qualification Standards (TQS) associated with their selected role and track their progress by marking individual requirements as complete.

1. Overall Design

Create a modern enterprise interface inspired by professional government qualification management systems.

Use the existing website design system:

* Soft blue-gray background (#EEF2F7).
* White or slightly tinted content cards (#FAFBFD).
* Deep navy text (#263449).
* Muted blue primary actions (#5276B9).
* Muted green for completed requirements (#6EAA88).
* Soft amber for in-progress requirements (#D5A75D).
* Subtle borders (#DCE3EC).
* Inter typography.
* Clean spacing and consistent alignment.

The interface should be visually appealing, easy to navigate, and comfortable to use for extended periods.

Avoid excessive white space, oversized headings, harsh colors, and unnecessary decorative elements.

2. Selected Role Display

At the top of the page, prominently display the role the employee previously selected in Role Overview.

For example:

“Training Qualification Standards”

Selected Role: [Previously Selected Role]

Include:

* Role title.
* Short description if available.
* Role identification or classification if available.
* A clear indication that the displayed requirements belong to the selected role.

CRITICAL:
Retrieve the role from the existing role selection functionality. Do not create a separate role selector or hardcode a sample role.

If no role has been selected, display a professional empty state explaining that the employee needs to select a role in Role Overview first, with a button linking to the existing Role Overview page.

3. Overall Qualification Progress

Below the selected role, create a prominent progress overview.

Display:

* Total TQS Requirements.
* Completed Requirements.
* In Progress Requirements.
* Not Started Requirements.
* Overall Completion Percentage.

Include a large horizontal progress bar showing the employee’s overall completion.

Example:

Overall Qualification Progress: 65%

13 of 20 requirements completed.

The numbers and progress bar must automatically update when individual requirements are marked complete.

Use subtle status colors:

* Completed: Muted green.
* In Progress: Muted blue.
* Not Started: Neutral gray.

Do not use hardcoded statistics. Calculate them from the actual TQS data.

4. Training Qualification Standards Checklist

This is the MOST IMPORTANT part of the page.

Display all Training Qualification Standards associated with the selected role in an organized, interactive checklist.

Each TQS requirement should have:

* Checkbox or completion control.
* TQS number or identifier, if available.
* Requirement title.
* Requirement description.
* Category or section, if available.
* Completion status.
* Optional completion date.

When an employee clicks a requirement’s checkbox or “Mark Complete” action:

1. Update the requirement’s status to Completed.
2. Display a green completed indicator.
3. Update the overall qualification progress.
4. Update the completed requirements count.
5. Save the completion state locally.
6. Preserve the completed status when the page is refreshed.

When a completed requirement is unchecked, return it to Not Started and recalculate progress.

Do not allow one requirement’s completion to accidentally affect another requirement.

5. Organize Requirements into Sections

If the existing TQS data contains categories, sections, or phases, organize requirements accordingly.

For example:

* Section 1: General Requirements
* Section 2: Technical Knowledge
* Section 3: Equipment Familiarization
* Section 4: Practical Training
* Section 5: Final Qualification

Each section should be collapsible.

Show a small completion summary next to each section.

Example:

Technical Knowledge
4 of 6 Completed

Use an accordion-style layout with clean section headers and subtle expand/collapse animations.

IMPORTANT: Use the actual section names and TQS structure from the existing project. The examples above are illustrative only.

6. Filtering and Viewing Requirements

Add simple filter controls above the checklist:

* All Requirements
* Not Started
* In Progress
* Completed

Allow employees to quickly find outstanding requirements.

Include:

* Search by requirement name or identifier.
* Sort options where appropriate.
* Clear filters option.

The filters should update the displayed requirements without changing their completion status.

7. Requirement Details

When an employee clicks a requirement title or details action, open a modern modal or expandable detail panel.

Display available information such as:

* Full requirement description.
* TQS identifier.
* Learning objectives.
* Required training activities.
* Supporting documentation.
* Related training courses.
* Completion instructions.

Include a clear “Mark Complete” or “Mark Incomplete” action.

If related training courses already exist in the website, link to the appropriate existing course.

Do not invent requirements, instructions, or qualification information.

8. Completion Experience

When an employee completes a requirement:

* Show a subtle success animation or confirmation.
* Change the checkbox to a green completed state.
* Update the progress bar smoothly.
* Update the section completion count.
* Display the completion date if appropriate.

When all requirements are completed, display a professional qualification completion state.

For example:

“All Training Qualification Standards Completed”

Include the completed role and final completion date.

Do not automatically issue official certifications or claim formal qualification approval unless that functionality already exists.

9. User Interface Details

Pay attention to the following:

* Modern checkbox designs.
* Clear completed, in-progress, and not-started indicators.
* Subtle hover effects.
* Consistent card styling.
* Easy-to-read requirement descriptions.
* Collapsible requirement sections.
* Responsive mobile layout.
* Accessible buttons and keyboard interactions.
* Smooth but restrained transitions.

The page should make it immediately obvious what the employee has completed and what remains outstanding.

10. Technical Requirements

Before modifying anything:

1. Inspect the existing TQS Support Left page.
2. Identify how roles are selected and stored.
3. Identify where Training Qualification Standards are stored.
4. Identify the relationship between selected roles and their associated TQS requirements.
5. Reuse the existing data structures and functionality.

Implementation restrictions:

* Only modify TQS Support Left and necessary shared components if absolutely required.
* Preserve the existing Role Overview functionality.
* Preserve the existing Dashboard.
* Preserve Training Center.
* Preserve Training Courses.
* Do not create duplicate role records or TQS requirements.
* Do not introduce a backend.
* Do not introduce unnecessary dependencies.
* Use the existing application framework.
* Use localStorage or the existing local persistence approach for completion states.
* Ensure completion states are associated with the correct employee and selected role.
* Do not overwrite existing role-selection data.
* Do not replace real TQS data with invented examples.

If information is unavailable, handle it gracefully instead of generating fictional qualification standards.

FINAL OBJECTIVE

Create a polished, modern, user-friendly TQS tracking interface.

An employee should be able to:

1. See their previously selected role.
2. View all qualification standards associated with that role.
3. Understand their overall qualification progress.
4. Expand sections to review individual requirements.
5. Mark requirements complete or incomplete.
6. See progress update immediately.
7. Return later and see their saved completion status.

The experience should feel like a professional digital qualification management system, not a basic HTML checklist.

Only modernize the existing TQS Support Left page while preserving all existing website functionality.