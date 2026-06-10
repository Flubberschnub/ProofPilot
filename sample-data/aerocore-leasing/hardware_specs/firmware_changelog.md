# AeroCore Drone Firmware Changelog
## Version: v4.2.1-RELEASE

*   **Release Date:** 2026-04-10
*   **Targets:** Flight Controller FC-8821, ESC-400 Motors
*   **Changes:**
    *   Optimized battery cell warning levels. Warning trigger now accounts for battery temperature.
    *   Improved wind correction algorithm for payloads exceeding 20 kg.
    *   Fixed GPS signal drop-out drift. Compass backup takes over for up to 3 seconds.
