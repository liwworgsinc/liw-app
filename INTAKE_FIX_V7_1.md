# LIW Intake Fix V7.1

Fixes the tailored intake page error caused by a mismatch between `intake.html` and `js/intake.js`.

Changes:
- Added service-specific heading and introduction targets.
- Added the service preparation/document checklist panel.
- Added defensive JavaScript checks so older cached HTML cannot crash service loading.
- Updated cache-busting query strings to `v=7.1`.
