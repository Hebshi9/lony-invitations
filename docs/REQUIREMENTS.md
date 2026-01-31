# Software Requirements Specification (SRS)
## Lony Invitations System
**Version:** 1.1  
**Date:** 2025-12-18

---

## 1. Introduction

### 1.1 Purpose
This document defines the comprehensive software requirements for the **Lony Invitations System**. This platform digitizes the event invitation process, offering advanced design tools, real-time analytics, and secure access control.

### 1.2 Scope
The system encompasses:
- **Admin Portal:** Event creation, guest management, and design studio.
- **Client Dashboard:** Real-time event monitoring for hosts.
- **Mobile Scanner (PWA):** Offline-capable entry management app.
- **Database:** Secure, isolated storage for multi-tenant data.

---

## 2. Overall Description

### 2.1 Product Perspective
A cloud-native web application leveraging **Supabase** for backend services (Auth, DB, Realtime) and **React** for a responsive frontend. It is designed to replace traditional paper/static invites with interactive, trackable digital passes.

### 2.2 User Classes
1.  **System Administrator:** Full control over all events and system settings.
2.  **Event Host (Client):** View-only access to their specific event's dashboard.
3.  **Gate Inspector:** Access to the scanning interface to verify guest entry.

---

## 3. Specific Requirements

### 3.1 Functional Requirements

#### 3.1.1 Event & Data Management
- **FR-01:** System shall allow creation of events with strict start/end timestamps.
- **FR-02:** System must generate a unique `client_access_code` for each event for dashboard access.
- **FR-03:** System shall isolate data so that queries for one event never return data for another (Tenant Isolation).

#### 3.1.2 Guest List Operations
- **FR-04:** System shall support Excel (.xlsx) upload with flexible column mapping.
- **FR-05:** System must suggest column mappings (Name, Phone, Table) using AI or heuristics.
- **FR-06:** System must detect and flag duplicate phone numbers or names within an event.
- **FR-07:** Each guest record must store:
    - Name
    - Phone
    - Table Number
    - **Companions Count** (Max allowed guests)
    - **Companions Attended** (Tracked real-time)
    - **Max Scans** (Allowed limit of entry attempts)

#### 3.1.3 Invitation Design Studio (Enhanced)
- **FR-08:** Users shall use a "Canvas Editor" to design invitations.
- **FR-09:** Editor requirements:
    - Upload custom background.
    - Drag-and-drop text and QR elements.
    - **Resize** elements (width/height).
    - **Snap-to-grid** for alignment.
    - Customize font, color, and size.
    - Support Arabic fonts (Amiri, Cairo).
- **FR-10:** System shall generate invitations in batch processing.
- **FR-11:** Export limit: 500+ invitations per batch as ZIP file (JPEG images).

#### 3.1.4 Mobile Scanning (PWA)
- **FR-12:** The Scanner must be installable as a PWA (Progressive Web App).
- **FR-13:** It must function **Offline** (cached strategy) after initial load.
- **FR-14:** Upon scanning a QR Code:
    - **Success:** If valid and quota remains. Play success sound.
    - **Warning (Duplicate):** If already attended max times. Show history.
    - **Error (Invalid):** If QR doesn't exist.
    - **Error (Expired):** If current time > Event End Date.
    - **Error (Limit Exceeded):** If scan_count > max_scans.
- **FR-15:** Inspector must be able to specify "Number of Companions Entering" for the current scan.

#### 3.1.5 Client Dashboard
- **FR-16:** Dashboard must auto-refresh (Realtime) every 10-30 seconds.
- **FR-17:** Required Metrics:
    - Total Guests vs. Attended Count.
    - Attendance Percentage.
    - Companion Statistics (Total Allocated vs. Entered).
    - Live feed of last 10 scans securely.

### 3.2 Non-Functional Requirements

#### 3.2.1 Performance
- **NFR-01:** QR Code recognition latency < 500ms.
- **NFR-02:** Database query for guest verification < 200ms using indexed searches.

#### 3.2.2 Security
- **NFR-03:** All database access must be governed by Row Level Security (RLS) policies.
- **NFR-04:** Client Dashboard links must be accessible via public URL but protected by Access Code logic if required.
- **NFR-05:** Prevent SQL Injection via parameterized queries (Supabase RPC/Client).

#### 3.2.3 Reliability (Offline First)
- **NFR-06:** Service Worker must cache the Scanner UI and critical assets.
- **NFR-07:** Scans performed while offline must queue and sync when online (Future Phase). *Currently: Offline UI works, but validation requires network or cached DB snapshot.*

#### 3.2.4 Usability
- **NFR-08:** UI must use "Lony" branding colors (Navy Blue, Gold).
- **NFR-09:** Interfaces must be fully RTL (Right-to-Left) compliant.

---

## 4. Phase 2 Features (Future Scope)
*Based on recent discussions and roadmap.*

1.  **PDF Export:** Generate printable PDF sheets with multiple invites per page.
2.  **WhatsApp Integration:** Send invites directly via WhatsApp API.
3.  **Advanced Offline Mode:** Download encrypted guest list to device for fully offline verification.
4.  **Seating Chart:** Visual map for table assignments.

