# Project Architecture Rules

- Keep home-screen install metadata and OneSignal push, but do not use an app-shell service worker; stale offline shells caused recurring blank screens after releases.