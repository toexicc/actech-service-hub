# Project Architecture Rules

- Keep home-screen install metadata and OneSignal push, but do not use an app-shell service worker; stale offline shells caused recurring blank screens after releases.
- Store daily staff-duty acknowledgements in activity logs keyed by account and Manila date so dismissal follows the staff account across devices without a second state table.