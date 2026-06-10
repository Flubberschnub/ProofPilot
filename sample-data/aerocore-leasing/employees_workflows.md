# AeroCore Employee Personas & Workflows

To understand how AeroCore operates, here are the step-by-step daily workflows of six different employees across the organization. These workflows illustrate the touchpoints where software APIs are used (or desperately needed).

---

## 👨‍✈️ 1. Marcus Vance — Deployed Field Pilot
*   **Department:** Dispatch & Operations
*   **Role:** Deployed Part 107 Drone Pilot
*   **Focus:** Safe flight execution, manual pre-flight checklists, data upload.
*   **Daily Workflow:**
    1.  **Check Schedule:** Marcus logs into the AeroCore dispatch portal to see his scheduled missions. He checks the coordinates, target structures, and client contact details.
    2.  **Safety Checklist:** Upon arrival at the client site, Marcus performs a pre-flight checklist (inspects drone propellers, monitors wind speeds, checks GPS lock, and validates airspace clearances).
    3.  **Flight Waiver Check:** Marcus checks the FAA LAANC (Low Altitude Authorization and Notification Capability) code to confirm he has clearance to take off in that specific grid zone.
    4.  **Execute Mission:** Marcus flies the drone according to the pre-programmed grid path to capture multi-spectral imagery.
    5.  **Log Flight Data:** After landing, Marcus logs flight telemetry (total battery discharge, flight duration, and peak altitude) and uploads the captured imagery data to the AeroCore storage server for the client.

---

## 👩‍💼 2. Sarah Jenkins — Billing & Finance Administrator
*   **Department:** Billing & Finance
*   **Role:** Financial Analyst & Accounts Manager
*   **Focus:** Subscription processing, usage overage invoices, hardware audit.
*   **Daily Workflow:**
    1.  **Reconcile Subscriptions:** Sarah audits the monthly base lease payments for active clients (e.g., $3,500/month flat fee for drone hardware packages).
    2.  **Calculate Overages:** AeroCore contracts allow up to 40 flight hours per month. Sarah downloads flight logs from the telemetry database to identify clients who exceeded their limits, charging an overage rate of $85/hour.
    3.  **Process Invoices:** Sarah generates usage-adjusted invoices and sends them to clients.
    4.  **Track Accounts Receivable:** She reviews unpaid bills. If an invoice is 15 days past due, she sends automatic reminders or schedules a call with the client's finance team.
    5.  **Reconcile Maintenance Billing:** If a client damages a drone outside of warranty, Sarah reviews the repair estimation from the engineering team and generates a custom invoice for spare parts and technician labor hours.

---

## 🗓️ 3. David Choi — Dispatch & Scheduling Coordinator
*   **Department:** Dispatch & Operations
*   **Role:** Dispatcher / Router
*   **Focus:** Matching pilots/technicians to client requests, managing calendar availability.
*   **Daily Workflow:**
    1.  **Review Client Requests:** David reviews intake forms submitted by construction or utility clients needing immediate site surveys.
    2.  **Check Availability:** He queries the internal calendar database to find certified pilots in the client's region who possess the specific equipment required (e.g., thermal mapping attachments).
    3.  **Verify Compliance:** David checks the FAA waiver registry to confirm the scheduled pilot is certified to execute night flights if the client requires thermal scanning after sunset.
    4.  **Book Appointments:** David schedules the booking, notifying the client via email and sending a calendar invite with coordinates to the pilot.
    5.  **Optimize Routes:** For field maintenance technicians, David builds route plans using mapping software to ensure a technician can visit multiple client sites on a single trip.

---

## 📦 4. Elena Rostova — Warehouse & Logistics Manager
*   **Department:** Warehouse & Logistics
*   **Role:** Inventory Coordinator
*   **Focus:** Shipping/receiving hardware, spare parts inventory tracking, restocking orders.
*   **Daily Workflow:**
    1.  **Receive Returns:** Elena receives damaged or end-of-lease drones returned by clients. She scans their barcodes, registers them as "returned", and routes them to the maintenance bay.
    2.  **Ship Out Leases:** She checks new lease orders, pulls the requested drone models and sensors from inventory, packages them in rugged cases, and ships them via courier, recording tracking numbers.
    3.  **Audit Stock Levels:** Elena does physical counts of critical spare parts (propellers, carbon-fiber arms, replacement motors, batteries) and flags items below safety thresholds.
    4.  **Create Purchase Orders:** When stock is low, Elena drafts purchase orders (POs) and submits them to the finance department to buy parts from hardware manufacturers.
    5.  **Battery Health Logs:** Elena tests and logs charge capacities for incoming lithium-polymer batteries, discarding degraded cells.

---

## ⚙️ 5. Carlos Mendez — Lead Field Maintenance Engineer
*   **Department:** Field Engineering & Maintenance
*   **Role:** Hardware Repair Technician
*   **Focus:** Inspecting damaged parts, repairing hardware, updating calibration records.
*   **Daily Workflow:**
    1.  **Review Repair Queue:** Carlos checks the internal repair tickets to see which returned drones have been assigned to him.
    2.  **Diagnostic Run:** He mounts the drone on a test bench, reviews the client's crash report, and connects it to diagnostic software to read error logs.
    3.  **Request Parts:** Carlos pulls required replacement parts from the warehouse (using barcode scanning) or requests Elena to order them if out of stock.
    4.  **Execute Repair:** Carlos replaces damaged carbon arms, solders new motors, and updates firmware.
    5.  **Calibration & Logging:** He runs a test flight in the indoor testing cage, logs the flight calibration data, and marks the ticket "repaired/ready for lease".

---

## 💬 6. Chloe Thompson — Technical Support Specialist
*   **Department:** Technical Support & Customer Care
*   **Role:** Customer Support Agent
*   **Focus:** Answering client help requests, telemetry monitoring, ticket escalation.
*   **Daily Workflow:**
    1.  **Review Help Tickets:** Chloe reviews tickets submitted via the customer portal (e.g., client reporting calibration drift during mapping runs).
    2.  **Remote Telemetry Auditing:** She accesses the drone's remote telemetry log via the cloud dashboard to check if there are motor voltage fluctuations or compass calibration warnings.
    3.  **Troubleshoot with Client:** She replies to the client with calibration commands or suggests swapping the sensor attachment.
    4.  **Escalate to Service:** If the hardware has a physical fault, she escalates the ticket, creating a return authorization (RMA) and booking a replacement drone shipment.
    5.  **Alert Monitoring:** Chloe monitors automatic IoT alerts. If a drone in the field triggers a critical error code (e.g., cell voltage drop), she immediately messages the active pilot.
