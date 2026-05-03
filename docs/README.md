---
layout: home
permalink: index.html
repository-name: e22-co2060-Web_Based_PAR_Index_System
title: Automated PAR Index Calculation System
---

# Automated PAR Index Calculation System

<br>

# Team

| eNumber  | Name               | Email |
|----------|--------------------|-------|
| E/22/014 | M.K.H. Ahamed      | e22014@eng.pdn.ac.lk |
| E/22/034 | M.A.M. Assadh      | e22034@eng.pdn.ac.lk |
| E/22/035 | M.F.M. Ayyash      | e22035@eng.pdn.ac.lk |
| E/22/036 | M.N. Aamir         | e22036@eng.pdn.ac.lk |

---

# Supervisors

- Dr. Asitha Bandaranayake – asithab@eng.pdn.ac.lk  
- T.M.I.I.C. Thennakoon – e21407@eng.pdn.ac.lk  

---

#### Table of Contents
1. Introduction
2. System Overview
3. Software Design
4. System Usage & Setup
5. PAR Model Details
6. Links

---

# 1. Introduction

## 1.1 Project Overview

The **Automated PAR Index Calculation System** is a web-based clinical tool designed to assist orthodontists in evaluating malocclusion severity using the Peer Assessment Rating (PAR) Index.

The system processes **3D dental models (STL/PLY/OBJ files)** and automatically computes PAR scores using orthodontic landmark detection and geometric measurements.

---

## 1.2 Key Features

- Automated PAR score calculation  
- 3D dental model visualization  
- Landmark-based measurement system  
- Role-based user access  
- Secure authentication using JWT  
- Patient record management  
- Training dataset submission support  

---

## 1.3 Real-World Problem

Traditional PAR Index calculation:

- Manual and time-consuming  
- Requires trained clinicians  
- Prone to inconsistency  
- Difficult to scale  

---

## 1.4 Proposed Solution

This system provides a **fully automated and scalable solution** that:

- Eliminates manual measurements  
- Ensures consistent scoring  
- Processes 3D scans efficiently  
- Supports both clinical and research workflows  

---

## 1.5 Impact

### For Clinicians
- Faster diagnosis  
- Reduced workload  
- Improved consistency  

### For Research
- Enables large-scale data analysis  

### For Healthcare
- Improves efficiency and reliability  

---

# 2. System Overview

### Frontend
- React + Vite  
- File upload interface  
- 3D visualization  
- Results dashboard  

---

### Backend
- Spring Boot  
- REST APIs  
- PAR computation  
- JWT authentication  

---

### Database
- MySQL 8  
- Stores users, patients, and results  

---

# 3. Software Design

## 3.1 Design Goals

- Accuracy  
- Scalability  
- Security  
- Usability  

---

## 3.2 Technology Stack

| Layer | Technology |
|------|-----------|
| Frontend | React 18, Vite, Three.js |
| Backend | Spring Boot 3, Spring Security |
| Database | MySQL 8, Flyway |
| Auth | JWT |
| Container | Docker Compose |

---

## 3.3 Functional Modules

### Authentication
- Login / Registration  
- JWT session handling  

### File Upload
- STL/PLY/OBJ support  
- Validation  

### PAR Calculation
- Landmark detection  
- Score computation  

### Visualization
- 3D model rendering  

### Data Management
- Save & retrieve patient data  

---

# 4. System Usage & Setup

## 4.1 User Roles

| Role | Description |
|------|------------|
| ADMIN | Full system control, audit logs, dataset review (pre-seeded only) |
| ORTHODONTIST | Upload models, calculate PAR, manage patients |
| UNDERGRADUATE | Submit anonymised training data |

---

## 4.2 Quick Start

### Prerequisites

- Docker & Docker Compose  
- Java 17+  
- Node.js 20+  
- MySQL 8  

---

### Run with Docker

docker compose up --build

Frontend: http://localhost:5173  
Backend: http://localhost:8081  
MySQL: localhost:3306  

---

## 4.3 Local Development

### Backend

cd backend  
./mvnw spring-boot:run  

### Frontend

cd frontend  
npm install  
npm run dev  

---

## 4.4 Database Setup

Automatic setup via Flyway + Docker scripts.

Manual:

mysql -u root -p par_system < database/schema.sql  
mysql -u root -p par_system < database/data.sql  

---

# 5. PAR Model Details

## 5.1 Components

| Component | Weight |
|----------|--------|
| Upper anterior | ×1 |
| Lower anterior | ×1 |
| Buccal left | ×1 |
| Buccal right | ×1 |
| Overjet | ×6 |
| Overbite | ×2 |
| Centreline | ×4 |

---

## 5.2 Algorithm

- Rule-based geometric computation  
- Landmark-driven scoring  
- British Standard PAR weighting system  
- Consistent and reproducible results  

---

# 6. Links

- [Project Repository](https://github.com/cepdnaclk/e22-co2060-Web_Based_PAR_Index_System)
- [Project Page](https://cepdnaclk.github.io/e22-co2060-Web_Based_PAR_Index_System)
- [Department of Computer Engineering](http://www.ce.pdn.ac.lk/)
- [University of Peradeniya](https://eng.pdn.ac.lk/)
