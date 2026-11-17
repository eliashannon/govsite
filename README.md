Modernize Existing Training Courses Page

I want to completely modernize the visual design and user experience of my EXISTING Training Courses page.

IMPORTANT: My website is already built. This is a redesign of one existing page, NOT a request to build a new application.

Only modify the existing Training Courses page and its directly associated styling/components when necessary.

Do not modify the Dashboard, Training Center, Role Overview, navigation, authentication, or any other existing pages.

1. Overall Design Direction

Create a modern enterprise training management interface inspired by professional Microsoft-style applications and corporate learning management systems.

Design characteristics:

* Professional enterprise appearance.
* Clean white and light-gray backgrounds.
* Dark navy and blue accent colors.
* Modern typography (Inter).
* Subtle shadows and borders.
* Rounded corners without excessive rounding.
* Consistent spacing and alignment.
* Smooth hover effects and transitions.
* Responsive desktop, tablet, and mobile layouts.

The page should feel like a professional government employee training portal.

2. Page Header

At the top of the existing page, create a clean header containing:

Title: “Training Courses”

Subtitle: “Explore available training programs, manage your learning, and track your professional development.”

Include:

* Total number of available courses.
* A prominent search bar.
* A clean, minimal layout.

Search placeholder:
“Search courses by title, category, or keyword…”

The search should filter the existing course data dynamically.

3. Training Summary Cards

Below the header, introduce four compact statistics cards:

* Total Courses
* Not Started
* In Progress
* Completed

Each card should include:

* Relevant Lucide icon.
* Large numerical statistic.
* Short descriptive label.
* Subtle blue, green, amber, or gray accent.

These statistics must reflect actual available course data when possible.

4. Course Catalog Table

This should be the primary component of the page.

Create a modern, professional data table displaying existing training courses.

Table columns:

1. Course Name
2. Category
3. Duration
4. Difficulty
5. Status
6. Actions

Course rows should feature:

* Course title in bold.
* Optional short description beneath the title.
* Small category icon.
* Estimated course duration.
* Difficulty badge (Beginner, Intermediate, Advanced).
* Status badge (Not Started, In Progress, Completed).
* A “View Details” action.

Table functionality

Implement:

* Search filtering.
* Category filtering.
* Status filtering.
* Difficulty filtering.
* Sort by course name.
* Sort by duration.
* Sort by newest.
* Pagination if the existing catalog contains enough courses.
* Clear filters option.

Use subtle row hover effects and clear column alignment.

Keep the table clean and readable. Avoid unnecessary visual clutter.

5. Course Details Interaction

When an employee clicks “View Details”, open a modern course details modal or side panel.

The details view should contain:

* Course title.
* Course description.
* Course category.
* Estimated duration.
* Difficulty level.
* Learning objectives.
* Course requirements, if available.
* Course content or module breakdown, if available.
* Current completion status.

At the bottom, include an appropriate primary action:

* “Start Course” for courses not started.
* “Continue Course” for courses in progress.
* “Review Course” for completed courses.

The modal should have:

* Clean spacing.
* Clear typography.
* Professional layout.
* Subtle animations.
* Close button.
* Responsive behavior.

Do not create a separate course page unless the existing application already uses that structure.

6. Visual Status Indicators

Use consistent status colors:

* Not Started: Neutral gray.
* In Progress: Blue.
* Completed: Green.

Difficulty indicators:

* Beginner: Green.
* Intermediate: Amber.
* Advanced: Red or dark neutral.

Keep badges small and professional.

7. Additional User Experience Improvements

Include:

* Empty state when no courses match search criteria.
* Helpful message when filters return no results.
* Clear visual feedback when a course is selected.
* Keyboard-accessible interactions.
* Responsive table behavior on mobile.
* Consistent button styling.

8. Technical Requirements

CRITICAL:

1. Inspect the existing Training Courses page before making changes.
2. Identify the current component, styling, data structure, and routing.
3. Reuse existing course data rather than creating duplicate course records.
4. Preserve all existing course functionality.
5. Preserve existing navigation and authentication.
6. Do not modify other pages.
7. Do not introduce a backend.
8. Do not add unnecessary dependencies.
9. Use the existing framework and component structure.
10. Use Lucide icons if already available.
11. Keep the implementation modular and maintainable.
12. Do not replace real course information with arbitrary placeholder data.

If some requested information does not exist in the current data, gracefully omit it rather than inventing course details.

Final Objective

Transform the existing Training Courses page into a polished enterprise training catalog.

The final result should prioritize usability, organization, accessibility, and professional presentation.

The course table should be the central focus, with summary statistics, search, filtering, and an interactive course details modal supporting it.

Again, ONLY modernize the existing Training Courses page. Leave every other page and existing website functionality untouched.