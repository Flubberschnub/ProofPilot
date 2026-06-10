# AeroCore Relational Database Schemas

This document defines the relational database structures used by AeroCore to manage its clients, subscription leases, hardware inventory, dispatch calendar, and sensor logs. Developers can use these definitions to design database models or mock seed queries.

---

## 👥 1. Clients Table (`clients`)
Contains master records for corporate clients leasing hardware or services.

| Field Name | Data Type | Key / Constraints | Description |
| :--- | :--- | :--- | :--- |
| `client_id` | `VARCHAR(16)` | `PRIMARY KEY` | Unique identifier (e.g., `CL-001928`) |
| `company_name` | `VARCHAR(100)` | `NOT NULL` | Registered business name |
| `industry_segment` | `VARCHAR(50)` | `CHECK` | Segment: `Agriculture`, `Infrastructure`, `Energy` |
| `primary_contact` | `VARCHAR(100)` | `NOT NULL` | Full name of client contact |
| `contact_email` | `VARCHAR(100)` | `UNIQUE` | Email address |
| `billing_address` | `TEXT` | `NOT NULL` | Corporate billing address |
| `duns_number` | `VARCHAR(9)` | `UNIQUE` | 9-digit corporate credit identifier |
| `sla_tier` | `VARCHAR(20)` | `DEFAULT 'standard'` | Service tier: `standard`, `silver`, `gold` |

---

## 📦 2. Hardware Inventory Table (`hardware_inventory`)
Tracks high-value drone models, cameras, and sensor units.

| Field Name | Data Type | Key / Constraints | Description |
| :--- | :--- | :--- | :--- |
| `hardware_id` | `VARCHAR(16)` | `PRIMARY KEY` | Unique ID (e.g., `HW-DRN-10029`) |
| `serial_number` | `VARCHAR(50)` | `UNIQUE, NOT NULL` | Manufacturer serial number |
| `model_name` | `VARCHAR(50)` | `NOT NULL` | E.g., `DJI Matrice 300`, `AeroScan L4` |
| `category` | `VARCHAR(30)` | `CHECK` | Category: `drone`, `camera_sensor`, `battery` |
| `status` | `VARCHAR(20)` | `DEFAULT 'available'` | Status: `available`, `leased`, `maintenance`, `retired` |
| `last_calibration_date` | `DATE` | `NULLABLE` | Date of last flight certification check |
| `total_flight_hours` | `DECIMAL(8,2)` | `DEFAULT 0.0` | Lifetime accumulated flight hours |

---

## 📜 3. Lease Subscriptions Table (`lease_subscriptions`)
Manages subscription details, base monthly pricing, and usage thresholds.

| Field Name | Data Type | Key / Constraints | Description |
| :--- | :--- | :--- | :--- |
| `lease_id` | `VARCHAR(16)` | `PRIMARY KEY` | Unique contract ID (e.g., `LS-88392`) |
| `client_id` | `VARCHAR(16)` | `FOREIGN KEY -> clients` | Reference to the leasing company |
| `hardware_id` | `VARCHAR(16)` | `FOREIGN KEY -> inventory`| Reference to specific drone/sensor |
| `start_date` | `DATE` | `NOT NULL` | Contract start date |
| `end_date` | `DATE` | `NOT NULL` | Contract expiration date |
| `base_monthly_rate` | `DECIMAL(10,2)`| `NOT NULL` | Fixed monthly subscription fee |
| `flight_hour_limit` | `INT` | `DEFAULT 40` | Monthly usage allowance hours |
| `overage_hourly_rate` | `DECIMAL(6,2)` | `DEFAULT 85.00` | Price per hour exceeded |

---

## 🗓️ 4. Dispatch Bookings Table (`dispatch_bookings`)
Coordinates certified pilots, travel locations, and job statuses.

| Field Name | Data Type | Key / Constraints | Description |
| :--- | :--- | :--- | :--- |
| `booking_id` | `VARCHAR(16)` | `PRIMARY KEY` | Unique booking ID (e.g., `BK-99102`) |
| `lease_id` | `VARCHAR(16)` | `FOREIGN KEY -> leases` | Reference to active contract |
| `pilot_id` | `VARCHAR(16)` | `NOT NULL` | Reference to deployed FAA pilot |
| `scheduled_start` | `TIMESTAMP` | `NOT NULL` | Date/time of takeoff |
| `scheduled_end` | `TIMESTAMP` | `NOT NULL` | Date/time of mission completion |
| `site_latitude` | `DECIMAL(9,6)` | `NOT NULL` | Target site coordinate latitude |
| `site_longitude`| `DECIMAL(9,6)` | `NOT NULL` | Target site coordinate longitude |
| `faa_laanc_code` | `VARCHAR(50)` | `NULLABLE` | FAA airspace authorization code |
| `booking_status` | `VARCHAR(20)` | `DEFAULT 'scheduled'`| Status: `scheduled`, `active`, `completed`, `cancelled` |

---

## 🚨 5. In-flight Telemetry Logs Table (`in_flight_telemetry`)
Stores raw streaming sensor data used for usage calculations and real-time alerts.

| Field Name | Data Type | Key / Constraints | Description |
| :--- | :--- | :--- | :--- |
| `log_id` | `BIGINT` | `PRIMARY KEY` | Auto-incrementing identifier |
| `booking_id` | `VARCHAR(16)` | `FOREIGN KEY -> bookings`| Reference to current flight mission |
| `timestamp` | `TIMESTAMP` | `NOT NULL` | Epoch millisecond timestamp |
| `battery_temp_c` | `DECIMAL(5,2)` | `NOT NULL` | Temperature of battery in Celsius |
| `voltage_cell_average`| `DECIMAL(4,2)`| `NOT NULL` | Cell voltage (trigger warning if < 3.2V) |
| `motor_vibration_g`| `DECIMAL(4,2)` | `NOT NULL` | Structural vibration (trigger if > 2.5G) |
| `altitude_m` | `DECIMAL(6,2)` | `NOT NULL` | Real altitude in meters |
| `gps_satellite_count`| `INT` | `NOT NULL` | Number of connected satellites |
