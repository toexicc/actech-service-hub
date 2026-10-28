# Project Architecture Rules

- Keep home-screen install metadata and OneSignal push, but do not use an app-shell service worker; stale offline shells caused recurring blank screens after releases.
- Store daily staff-duty acknowledgements in activity logs keyed by account and Manila date so dismissal follows the staff account across devices without a second state table.- Public /track reads tickets only through PIN-verified database functions (last 4 phone digits); the unverified snapshot is staff-only, so the check cannot be bypassed in the browser.
- Intake auto-assignment uses a daily round-robin (fewest tickets today, then longest since last assignment, then day-rotated roster); attendance time-in does not affect eligibility, only approved leave.
