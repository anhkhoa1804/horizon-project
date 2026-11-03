# Visual References and Design Direction

## Purpose

Eco-Sense should learn from excellent products without copying their branding, layouts, or audience assumptions. This document translates external references into Eco-Sense-specific design rules.

The goal is not “make Eco-Sense look like Linear” or “copy Windy”. The goal is to understand why those products work, then apply the relevant principle to a rural environmental monitoring platform.

## Reference rules

For every reference:

- Learn the principle, not the skin.
- Adapt to farmers, field workers, administrators, tourists, and judges.
- Reject patterns that increase cognitive load.
- Reject patterns that depend on developer knowledge.
- Preserve Eco-Sense’s calm environmental identity.

## Admin dashboard references

### Linear

Why study it:

- Excellent spacing discipline.
- Clear hierarchy in dense views.
- Restrained borders.
- Fast, subtle motion.
- Strong keyboard-first workflows.

Eco-Sense should learn:

- Use rhythm and alignment to make dense admin pages feel calm.
- Keep hover and selection feedback subtle.
- Make status and ownership scannable.
- Use predictable keyboard behavior in tables, dialogs, and filters.

Eco-Sense should not copy:

- Dark-first aesthetic.
- Icon-only navigation.
- Startup/developer terminology.
- Overly compact controls for older operators.

Applied rules:

- Admin sidebar uses text labels, not icon-only collapsed navigation by default.
- Tables can be dense, but row height must remain readable.
- Motion stays below 250ms and never becomes decorative.

### Supabase Dashboard

Why study it:

- Good developer dashboard structure.
- Clear cards, settings pages, filters, and empty states.
- Useful table density.
- Strong separation of project areas.

Eco-Sense should learn:

- Settings and configuration should be grouped by task.
- Database-like information can be presented calmly.
- Badges and filters should help scanning.
- Empty states should explain next steps.

Eco-Sense should not copy:

- SQL-centric language in public UI.
- Developer-only mental models.
- Dense technical navigation for farmer-facing pages.

Applied rules:

- Threshold settings use guided labels, not raw database fields.
- Admin filters remain visible and labeled.
- Public pages never expose database concepts.

### Stripe Dashboard

Why study it:

- Excellent forms.
- Clear progressive disclosure.
- Calm handling of complex financial data.
- High trust through consistent detail.

Eco-Sense should learn:

- Forms should be precise and forgiving.
- Important configuration changes need review and confirmation.
- Empty and error states should explain impact.
- Data tables can be professional without being noisy.

Eco-Sense should not copy:

- Payment-specific terminology.
- Overly business-oriented dashboard framing.
- Excessive configuration depth for simple field operations.

Applied rules:

- Threshold editing should explain the impact before saving.
- Admin forms should preserve values after errors.
- Audit trails should be visible for sensitive changes.

### Vercel Dashboard

Why study it:

- Strong dashboard rhythm.
- Excellent deployment/status indicators.
- Fast perceived performance.
- Clean loading states.

Eco-Sense should learn:

- System status can be shown calmly and clearly.
- Loading states should preserve layout.
- Recent activity can build trust.

Eco-Sense should not copy:

- Deployment-centric language.
- Minimalism that hides operational detail from non-technical admins.

Applied rules:

- Station health indicators should be compact but explicit.
- Admin overview should show recent ingestion and alert activity.

### GitHub

Why study it:

- Excellent issue lists, activity timelines, audit patterns, and table interactions.
- Strong use of badges and metadata.
- Predictable navigation.

Eco-Sense should learn:

- Audit history should be chronological and readable.
- Tables should support filtering, sorting, and row-level actions.
- Status labels should be compact and consistent.

Eco-Sense should not copy:

- Developer vocabulary in public pages.
- Dense repository navigation.

Applied rules:

- Admin report review can learn from issue triage patterns.
- Device and threshold changes should appear in an audit timeline.

## Public environmental references

### Windy

Why study it:

- Environmental visualization is immediate.
- Map and timeline interactions are powerful.
- Color encodes weather intensity effectively.

Eco-Sense should learn:

- Put the environmental condition first, not the menu.
- Time-based environmental change should be easy to explore.
- Color can carry meaning when paired with labels and legends.

Eco-Sense should not copy:

- Expert-level controls.
- Dense overlays.
- Highly saturated visual maps for simple station pages.

Applied rules:

- Station page leads with water condition.
- Trend chart supports decision-making instead of becoming a data playground.
- Any future map view must default to simple, readable layers.

### Our World in Data

Why study it:

- Strong chart labeling.
- Contextual explanations around data.
- Trustworthy statistical storytelling.
- Accessible legends and sources.

Eco-Sense should learn:

- Every chart needs a clear title, unit, and explanation.
- Data should be contextualized, not just plotted.
- Chart copy can explain why a threshold matters.

Eco-Sense should not copy:

- Research-paper density for farmer-facing pages.
- Long explanatory blocks above critical status.

Applied rules:

- Public charts include one-sentence summaries.
- Educational sections explain salinity and water level after current status.
- Admin exports or research views may be denser than public station pages.

### Apple Weather

Why study it:

- Large readable values.
- Calm visual hierarchy.
- Strong mobile-first environmental presentation.
- Good balance of current state and forecast/trend.

Eco-Sense should learn:

- The main environmental answer should be visually dominant.
- Secondary details can be modular cards.
- Mobile environmental UI should feel glanceable.

Eco-Sense should not copy:

- Decorative gradients as primary identity.
- Consumer-weather tone when operational precision is needed.

Applied rules:

- Station detail uses large salinity and water-level values.
- Sensor trust appears as a clear module, not hidden metadata.

### Google Weather

Why study it:

- Simple public interpretation.
- Fast access to current condition.
- Familiar mobile scanning patterns.

Eco-Sense should learn:

- Use familiar label/value grouping.
- Put the current condition before explanation.

Eco-Sense should not copy:

- Generic weather-card style that weakens product distinctiveness.

Applied rules:

- Public dashboard should feel familiar enough for non-technical users.

## Mobile UX references

### Mobbin

Why study it:

- Large library of real mobile flows.
- Strong examples of thumb-zone actions.
- Practical mobile form patterns.
- Confirmation and onboarding flow patterns.

Eco-Sense should learn:

- Primary actions should be reachable near the lower half of the screen.
- Forms should be short and forgiving.
- Bottom actions can improve one-handed use.

Eco-Sense should not copy:

- Consumer app playfulness.
- Complex onboarding before public data access.

Applied rules:

- Report button should not live only in the top-right header.
- Public mobile navigation can use labeled bottom navigation.
- Report form should preserve drafts and minimize fields.

### Screenlane

Why study it:

- Useful mobile screen sequencing references.
- Good examples of progressive disclosure.

Eco-Sense should learn:

- Break complex flows into small steps only when it reduces cognitive load.
- Confirmation screens should tell users what happens next.

Eco-Sense should not copy:

- App-store-style marketing patterns that slow urgent field checks.

Applied rules:

- Report flow can be step-based if attachments or station selection become complex.

### Apple Human Interface Guidelines

Why study it:

- Strong accessibility, touch target, motion, and platform behavior guidance.
- Emphasis on clarity and deference to content.

Eco-Sense should learn:

- Respect platform conventions.
- Keep touch targets large.
- Use motion to clarify changes.
- Support dynamic text where practical.

Eco-Sense should not copy:

- iOS-only assumptions for an Android-heavy farmer audience.

Applied rules:

- Minimum touch target remains 44px.
- Motion must support reduced-motion preferences.

### Material Design

Why study it:

- Strong Android accessibility and responsive guidance.
- Familiar interaction patterns for Android users.

Eco-Sense should learn:

- Touch target and form-field behavior.
- Responsive layout principles.
- Accessible components.

Eco-Sense should not copy:

- A generic Material demo aesthetic.
- Floating action button overuse.
- Excessive elevation stacks.

Applied rules:

- Android form fields should behave predictably.
- Avoid making Eco-Sense look like an unmodified Material admin template.

## Landing page references

### Godly and Land-book

Why study them:

- Strong landing page curation.
- Clear examples of modern composition, rhythm, and storytelling.

Eco-Sense should learn:

- Landing pages need narrative sequence: problem, solution, evidence, trust, CTA.
- Visual rhythm matters.
- Screenshots and live data previews build credibility.

Eco-Sense should not copy:

- Decorative motion that slows understanding.
- Abstract SaaS hero sections.
- Trendy visuals unrelated to environmental monitoring.

Applied rules:

- Homepage should show live environmental value early.
- The project story should connect community, data, and sustainability.

### Notion

Why study it:

- Friendly clarity.
- Strong information grouping.
- Low-friction explanation.

Eco-Sense should learn:

- Write simply.
- Group complex ideas into approachable sections.

Eco-Sense should not copy:

- Casual playfulness where environmental risk requires precision.

Applied rules:

- Public educational content should be warm but not cute.

### Raycast

Why study it:

- Sharp product storytelling.
- Strong command/action clarity.
- Polished but restrained motion.

Eco-Sense should learn:

- Every action should have a clear label.
- Motion can make a product feel premium without being loud.

Eco-Sense should not copy:

- Power-user assumptions.
- Command-palette-first interactions for public users.

Applied rules:

- Admin may eventually support command search; public pages should not depend on it.

## Eco-Sense design direction by surface

### Public station page

Learn from:

- Apple Weather for large current values.
- Windy for environmental-first hierarchy.
- Our World in Data for chart explanation.
- Mobbin for one-handed action placement.

Do:

- Show current condition first.
- Use large salinity and water-level values.
- Explain thresholds plainly.
- Put report action within reach.

Do not:

- Lead with project marketing.
- Show dense controls.
- Hide sensor health.

### Public dashboard

Learn from:

- Windy for environmental overview.
- Our World in Data for trend clarity.
- Apple Weather for modular cards.

Do:

- Sort stations by urgency.
- Show overall status and freshness.
- Make risk/watch/offline understandable.

Do not:

- Create a wall of equal cards with no priority.
- Use color without labels.

### Admin dashboard

Learn from:

- Linear for density and rhythm.
- Supabase for filters and settings.
- GitHub for activity and audit timelines.
- Stripe for precise forms.

Do:

- Use tables where they improve operations.
- Keep filters visible.
- Show audit history for sensitive actions.
- Keep terminology operational, not developer-only.

Do not:

- Use icon-only navigation.
- Hide row actions on hover only.
- Make admin pages look like public storytelling pages.

### Report flow

Learn from:

- Mobbin for mobile forms.
- Stripe for validation clarity.
- Screenlane for confirmation flows.

Do:

- Keep the form short.
- Preserve drafts.
- Show what happens after submission.

Do not:

- Require login.
- Ask for unnecessary fields.
- Lose input on network failure.

## Final reference rule

When unsure, choose the pattern that makes a farmer understand faster and an administrator act more confidently. Visual polish matters only when it increases clarity, trust, or speed.