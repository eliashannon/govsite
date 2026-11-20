Update the existing website with a polished Midnight Navy dark theme. This should be a visual theme update only. Do not rebuild the website, change its architecture, or modify existing functionality.

1. Overall Theme

Create a modern, professional dark interface inspired by premium enterprise dashboards and applications.

Use a deep navy and blue-gray color palette rather than pure black. The background should feel rich, comfortable on the eyes, and visually layered.

2. Color Palette

Use these colors consistently throughout the website:

* Main Background: #101B2D
* Secondary Background: #152238
* Sidebar Background: #0B1526
* Card Background: #1B2B43
* Elevated Card Background: #223650
* Primary Accent: #668BCB
* Secondary Accent: #78A6B0
* Primary Text: #E8EEF7
* Secondary Text: #A7B5C9
* Muted Text: #7789A3
* Borders and Dividers: #2C3D56
* Success: #72B695
* Warning: #D6AC69
* Error: #D47D83

3. Background and Layout

* Apply the main Midnight Navy background to all page backgrounds.
* Use slightly lighter navy surfaces for cards, panels, tables, and content sections.
* Keep the sidebar darker than the main content area to create visual separation.
* Avoid large areas of pure black or bright white.
* Use subtle borders and restrained shadows to distinguish sections.
* Maintain consistent spacing, rounded corners, and alignment.

4. Components

Update all existing interface elements to match the new theme:

* Navigation sidebar and active navigation indicators
* Dashboard cards and statistics
* Tables, table headers, and table rows
* Search bars and filters
* Buttons and dropdown menus
* Modal windows and pop-up panels
* Progress bars and completion indicators
* Form fields, checkboxes, and selection controls
* Notifications and status badges
* Headers, section titles, and page descriptions

5. Interaction and Visual Effects

* Use subtle blue highlights for active navigation and selected items.
* Add smooth, restrained hover transitions to buttons, cards, and navigation links.
* Make primary buttons stand out with muted blue accents.
* Ensure disabled controls are visibly distinct.
* Use consistent focus indicators for keyboard accessibility.
* Avoid excessive gradients, glowing effects, and bright neon colors.

6. Readability

* Maintain strong contrast between text and backgrounds.
* Use bright off-white for primary text instead of pure white.
* Use muted blue-gray for secondary descriptions and metadata.
* Keep tables and smaller text easy to read.
* Make sure status colors remain distinguishable against dark surfaces.

7. Implementation Requirements

* Apply the theme consistently across the entire existing website, including Dashboard, Training Center, Role Overview, Training Courses, and TQS Requirements.
* Use centralized CSS variables or the existing theme system so colors can be adjusted globally.
* Reuse existing components and styles wherever possible.
* Preserve all current layouts, navigation, routes, functionality, and data.
* Do not remove existing features or introduce unnecessary dependencies.
* Do not change the application’s backend or data handling.

Final Goal: The website should feel like a premium government training and qualification management platform: sophisticated, clean, modern, and easy to use for extended periods. The Midnight Navy background should be noticeable throughout the application without making the interface feel too dark or difficult to read.

## Prototype sign-in

Sign-in is a browser-only prototype, not security or authorization. Do not use real credentials, personal information, or sensitive content. The **Use Demo Account!** button uses public synthetic test credentials and is for local testing only. Existing prototype admin access is unchanged.

Sessions are stored in session storage; newly created prototype accounts and salted password-derived values are stored locally in the same browser. Clearing browser data removes them. Signing out also signs out other open portal tabs in the same browser, while preserving saved roles and course progress. Client-side checks and password derivation do not protect accounts or page content from a user with browser access. Production requires server-side authentication and authorization, secure password hashing and cookies, CSRF protection, audit logging, and approved hosting.

## Training manager workflow

Structured course drafts accept DOCX, TXT, or Markdown documents in the [handbook format](HANDBOOKFORMAT.txt). The COURSE section must include a lowercase, hyphen-separated Course ID, Course Title, Short Description, Category, Difficulty, and a positive whole-number Duration Minutes, followed by a COURSE DESCRIPTION heading. Invalid or missing metadata must be corrected in the document before creating a draft.

Use View / edit in Course Builder to reopen a course in the structured draft editor, or select courses and source items to delete them. Deleting a course leaves its original handbook intact. Move courses from Course Builder to Exam Builder or Published Courses. A course appears in only one of these sections. Publish and unpublish from Published Courses; unpublishing leaves the course there until it is moved to a builder. Course locations and publication remain browser-local prototype data.

## TQS parser

In Training Content Manager, select a document and choose **Create TQS for Role**, or select a previously uploaded document from the document list. The extracted draft is saved in **TQS Builder** and opens for editing. Select an existing role, review extraction warnings, edit the TQS information and its modules and requirements, and save. You can reorder modules and requirements, mark requirements required or optional, and assign or remove unassigned requirements. Source information and parsing warnings are retained for review.

Select drafts in TQS Builder to delete them or move them to **Published TQS**. Moving does not publish them: select and publish them there to make them available in TQS Requirements and the Dashboard in this browser. Publication requires an ID, title, version, effective date, valid role, modules with uniquely numbered requirements, and no unassigned requirements. Only one TQS can be published per role. Unpublish before returning a TQS to the builder for editing; its stored checkoffs remain available if it is republished. Deleting a draft does not delete its source document or checkoffs. All listed requirements, including optional ones, count toward displayed progress.

The TQS parser handles line-separated numbered module headings and requirements, preserving source numbering and order. It reports unassigned requirements, duplicate numbers, and unrecognized lines for review. Check all extracted content against the original, especially PDF layout and DOCX text boxes or tables. Secure TQS administration, completion records, and audit trails require a trusted backend; the existing browser-only sign-in and progress tracker cannot enforce those controls.

The demo and master accounts can view the synthetic two-module TQS in TQS Requirements after selecting **Demo: D / Demo D / Demo D** in Role Overview, unless a locally published TQS is assigned to that role. Each account's checkoffs are saved separately in the current browser and are not official or audited. TQS Requirements and the Dashboard both count checked requirements; check dates are displayed in MM/DD/YYYY format. Previous browser-local course checklist progress is left unchanged.