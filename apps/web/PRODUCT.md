# MobiFlow AI — Product Truth

MobiFlow AI is a Vietnamese-language internal operations platform for receiving, coordinating, and resolving service requests in a local MobiFone demonstration environment. The product must feel calm, reliable, operational, and human-controlled—not like a public marketing site or a free-form AI chatbot.

## Users and authority

- `USER`: creates and follows only their own requests, provides requested information, confirms or reopens a resolution, and submits immutable feedback.
- `STAFF`: works only on currently assigned requests, follows the approved checklist, communicates with the requester, records resolution facts, and may invoke the six fixed Copilot actions.
- `MANAGER`: oversees requests, prepares or reviews plans, assigns eligible staff, manages knowledge documents, and reads operational analytics.
- AI and SYSTEM are internal provenance actors, never login roles. AI is advisory. Protected business decisions always require an authorized human.

## Core experience

The primary loop is: request creation → bounded AI intake where available → manager review and assignment → staff work and checklist → resolution → requester confirmation and feedback. Every visible action must preserve server authorization, request versioning, state-machine rules, and truthful degraded states.

## Product principles

1. Show what needs attention first.
2. Keep role scope explicit and never imply broader access.
3. Separate AI suggestions from human decisions.
4. Present SLA state plainly without invented percentages.
5. Keep the UI usable when AI is unavailable.
6. Use concise, consistent Vietnamese terminology.
7. Optimize for office desktop while remaining complete at 360 px.

## Visual character

Modern Vietnamese telecom enterprise software: cool white and slate surfaces, restrained blue drawn from the existing repository mark, semantic colors used only where meaningful, compact information density, subtle borders, and limited shadow. No decorative AI spectacle, giant authenticated hero, glassmorphism, neon, or external font dependency.

## Non-goals

This refresh adds no product capability, permission, route contract, database field, migration, AI prompt/schema, free-form Copilot input, dark mode, or cloud dependency.
