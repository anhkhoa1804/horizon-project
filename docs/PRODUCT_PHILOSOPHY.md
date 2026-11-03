# PRODUCT_PHILOSOPHY.md

> Eco-Sense Cồn Hô Design Philosophy
>
> Version: 1.0
>
> Status: Living Document

---

# 1. Purpose

This document defines the philosophy behind Eco-Sense Cồn Hô.

It is **not** a technical specification.

It exists so that every contributor—human or AI—understands **why** the product exists before deciding **how** it should be implemented.

Whenever there is a conflict between aesthetics, engineering convenience, or feature requests, this document has priority.

---

# 2. Vision

Eco-Sense Cồn Hô exists to make environmental monitoring understandable by everyone.

Not only engineers.

Not only scientists.

Not only government officials.

Everyone.

Especially farmers.

A farmer should be able to scan a QR code and understand whether the water is safe within five seconds.

That is success.

---

# 3. Mission

Provide trustworthy environmental information through an interface that is:

* calm
* simple
* beautiful
* transparent
* accessible

The system must never overwhelm users with technical details.

Instead, it should progressively reveal complexity only when users ask for it.

---

# 4. Product Principles

Every feature must satisfy these principles.

## Principle 1

Clarity over cleverness.

Avoid fancy UI that sacrifices understanding.

Users should never wonder:

> "What does this mean?"

Instead they should immediately understand:

> "The water is safe."

or

> "Something needs attention."

---

## Principle 2

Information before decoration.

Animations.

Gradients.

Illustrations.

Glassmorphism.

None of these matter if users cannot immediately find:

* salinity
* water level
* alerts
* station status

Every visual decision must improve comprehension.

---

## Principle 3

Trust is everything.

Environmental data affects livelihoods.

The interface should never exaggerate.

Never use alarming colors unless necessary.

Never hide uncertainty.

Never fake precision.

Always communicate confidence honestly.

---

## Principle 4

The system should feel calm.

Most dashboards try to impress.

Eco-Sense should reassure.

The interface should feel similar to:

* Apple Weather
* Linear
* Supabase Dashboard

Minimal.

Quiet.

Focused.

---

## Principle 5

The interface must disappear.

Users should think about their crops.

Not the software.

If users notice the UI, the UI is probably too loud.

---

# 5. Target Users

Eco-Sense has three primary audiences.

Every screen should clearly identify which audience it serves.

---

## Farmers

Goals

* Know whether water is usable.
* Report problems.
* Scan QR codes.
* Understand alerts.

Needs

* Large text.
* Simple language.
* Mobile-first design.
* Fast loading.
* Minimal interaction.

Avoid

* Technical terminology.
* Dense tables.
* Configuration screens.

---

## Administrators

Goals

* Monitor stations.
* Investigate failures.
* Configure thresholds.
* Manage deployments.

Needs

* High information density.
* Keyboard navigation.
* Powerful filtering.
* Data history.

Avoid

* Oversized cards.
* Excessive whitespace.
* Decorative graphics.

---

## Visitors

Goals

* Learn about the project.
* Explore environmental data.
* Understand impact.

Needs

* Beautiful storytelling.
* Maps.
* Visualizations.
* Photos.

Avoid

* Engineering jargon.
* Admin terminology.

---

# 6. Emotional Goals

Every page should evoke one emotion.

Home

Curiosity

Dashboard

Confidence

Station Detail

Understanding

Report Form

Safety

Admin

Control

About

Trust

---

# 7. Design Language

The visual language should feel like:

Nature + Technology.

Not:

Nature vs Technology.

Nature should be represented through:

* soft colors
* organic spacing
* subtle gradients
* photography
* maps

Technology should appear through:

* typography
* charts
* clean layouts
* structured cards

The two should coexist.

---

# 8. Visual Personality

If Eco-Sense were a person:

Age

35

Occupation

Environmental engineer.

Personality

Patient.

Reliable.

Quiet.

Professional.

Helpful.

Never flashy.

Never dramatic.

---

# 9. Design Inspiration

The project intentionally draws inspiration from:

Supabase Dashboard

* clean spacing
* subtle borders
* restrained color usage

Linear

* interaction quality (not its dark-first aesthetic — HORIZON is a light,
  field-readable surface; see `VISUAL_REFERENCES.md`)
* typography

Apple Weather

* calm presentation
* readable cards
* atmospheric feeling

Our World in Data

* educational charts
* narrative visualization

Windy

* environmental visualization
* map interaction

These are inspirations.

Never copies.

---

# 10. Accessibility Philosophy

Accessibility is not a feature.

It is a requirement.

The application should remain fully usable for users with:

* poor eyesight
* limited dexterity
* slow internet
* older phones
* outdoor glare

Every feature must work under these conditions.

---

# 11. Mobile Philosophy

Most users are expected to arrive via QR codes.

Therefore:

Desktop is secondary.

Mobile is primary.

Every new page should be designed for a 390px viewport before being expanded for desktop.

---

# 12. Performance Philosophy

Fast feels trustworthy.

Target experience:

Initial page

< 2 seconds

Route transitions

Instant

Interactions

<100ms

Animations

60fps

Never add libraries that significantly increase bundle size unless they create meaningful user value.

---

# 13. Information Hierarchy

Every page should answer questions in this order.

1.

Am I looking at the correct station?

2.

Is everything okay?

3.

If not, what happened?

4.

What should I do?

5.

Can I inspect details?

Never reverse this order.

---

# 14. Progressive Disclosure

Users should see:

Simple

↓

Useful

↓

Detailed

↓

Technical

↓

Raw Data

Never expose raw telemetry first.

---

# 15. Color Philosophy

Green

Safe.

Blue

Information.

Orange

Warning.

Red

Critical.

Gray

Inactive.

Colors communicate meaning.

Never use colors purely for decoration.

---

# 16. Typography Philosophy

Typography is the primary design tool.

Hierarchy should be created through:

* weight
* spacing
* rhythm

Not giant font sizes.

---

# 17. Animation Philosophy

Animations should explain.

Not entertain.

Good animation:

* confirms actions
* guides attention
* reduces uncertainty

Bad animation:

* spins forever
* bounces unnecessarily
* delays interactions

---

# 18. AI Design Instructions

When AI tools (Gemini CLI, ChatGPT, Copilot, Claude) modify the UI, they must follow these rules.

Always:

* preserve simplicity
* preserve readability
* preserve spacing
* improve accessibility
* improve consistency

Never:

* redesign the application from scratch
* replace the design language
* introduce random component libraries
* add excessive gradients
* increase visual noise

AI should refine.

Not reinvent.

---

# 19. Definition of Done

A feature is considered complete only if:

✓ technically correct

✓ visually consistent

✓ accessible

✓ responsive

✓ understandable by a first-time farmer

✓ understandable without documentation

✓ keyboard accessible

✓ screen-reader friendly

✓ mobile friendly

✓ performant

If any item fails, the feature is not done.

---

# 20. Final Statement

Eco-Sense is not merely a monitoring dashboard.

It is public infrastructure.

The software should communicate the same values as the project itself:

* transparency
* reliability
* scientific integrity
* environmental responsibility
* respect for users

Every line of code and every pixel should reinforce these values.
