# SelfOS Demo Data Guide

Use this checklist to prepare a portfolio-safe demo without real personal data.

## Recommended demo profile

- Create a dedicated Supabase user such as `demo@example.com`.
- Set a neutral display name from Settings, for example `Demo User`.
- Keep external integrations disconnected unless you are showing a real sandbox account.

## Suggested synthetic data

- Notes: 3-5 notes about generic project planning, learning notes, and meeting notes.
- Tasks: 5-8 tasks across two fake projects, with one overdue and one due today.
- Finance: use round synthetic amounts only, or disable the module with `NEXT_PUBLIC_SELFOS_DISABLED_MODULES=finance`.
- Fitness: add 3 manual workouts with generic notes, or leave Strava disconnected.
- Education: rename the path to a generic course and add 4-6 fake exams.
- Goals: add 2 active goals with measurable progress.
- Automations: add 1-2 readable rules that surface signals in Command Center.

## Screenshot audit

Before publishing screenshots or a GIF:

- no personal email is visible;
- no real account balance, salary, investment symbol list, address, token, or external profile is visible;
- browser URL does not expose private deployment details;
- integrations that are not configured show a neutral state instead of an error stack.
