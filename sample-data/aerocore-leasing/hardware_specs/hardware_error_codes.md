# AeroCore Telemetry Warning & Error Codes

| Error Code | Severity | Description | Action Required |
| :--- | :--- | :--- | :--- |
| `ERR-VOLT-CELL-LOW` | CRITICAL | Average cell voltage falls below 3.2V | Land drone immediately |
| `ERR-TEMP-BATT-HIGH` | WARNING | Battery temperature exceeds 55°C | Hover drone and monitor |
| `ERR-VIBE-STRUCT-HIGH`| WARNING | Chassis structural vibration exceeds 2.5G | Schedule engineering inspection |
| `ERR-COMPASS-DRIFT` | WARNING | Magnetic compass angle mismatch > 5° | Rerun sensor calibration |
