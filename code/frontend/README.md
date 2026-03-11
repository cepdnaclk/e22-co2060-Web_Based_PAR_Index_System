# Web-Based Software System for Automated Peer Assessment Rating (PAR) Index Calculation

> **Team:** TIMESWARE | **Course:** CO2060 Software Systems Design
> **Collaboration:** Faculty of Dental Sciences, University of Peradeniya

## 1. Introduction
Welcome to the repository for the **Automated PAR Index System**. This project is a collaborative effort between the Department of Computer Engineering and the Faculty of Dental Sciences. We aim to transition an existing machine-learning research prototype into a robust, extensible, and clinically usable web-based software system.

## 2. Problem Statement
**Orthodontics** relies on the Peer Assessment Rating (PAR) Index to objectively measure the severity of malocclusion (misalignment of teeth) and the success of treatments. Currently, calculating this index is:
* **Manual & Subjective:** Performed by clinicians, leading to human error and variability.
* **Time-Consuming:** Significant clinical time is lost in manual scoring.
* **Labor-Intensive:** Limits the ability to perform large-scale audits or research.

## 3. Our Solution
We are developing a **web-based software platform** that automates the PAR calculation using 3D dental models. Building upon previous machine-learning research, our system provides a production-ready environment for clinicians.

### Key Objectives
1.  **Automated Calculation:** Instantly detect orthodontic landmarks on 3D models and compute PAR scores.
2.  **ML Operations (MLOps):** Implement retraining pipelines to allow the model to learn from new annotated data continuously.
3.  **Clinical Interface:** A secure, user-friendly web dashboard for clinicians to upload models and view reports.
4.  **Scalability:** An architecture capable of supporting multi-institution use (including interest from Japan & South Korea).

## 4. Project Scope
* **Frontend:** Clinician-friendly UI for 3D model visualization and reporting.
* **Backend:** Secure API for data handling and model inference.
* **ML Pipeline:** Versioning, validation, and automated retraining workflows.
* **Deployment:** Cloud-ready architecture suitable for clinical environments.

---

### Project Details (index.json)
*For integration with projects.ce.pdn.ac.lk*

```json
{
  "title": "Web-Based Software System for Automated PAR Index Calculation in Orthodontics",
  "team": [
    {
      "name": "M.K.H. Ahamed",
      "email": "e22014@eng.pdn.ac.lk",
      "eNumber": "E/22/014"
    },
    {
      "name": "M.F.M. Ayyash",
      "email": "e22035@eng.pdn.ac.lk",
      "eNumber": "E/22/035"
    },
    {
      "name": "M.A.M. Assadh",
      "email": "e22034@eng.pdn.ac.lk",
      "eNumber": "E/22/034"
    },
    {
      "name": "M.N. Aamir",
      "email": "e22036@eng.pdn.ac.lk",
      "eNumber": "E/22/036"
    }
  ],
  "supervisors": [
    {
      "name": "Dr. H.S.K. Ratnatilake",
      "email": "kumari@dental.pdn.ac.lk"
    },
    {
      "name": "Dr. Asitha Bandaranayake",
      "email": "asithab@eng.pdn.ac.lk"
    }
  ],
  "tags": [
    "BioInformatics",
    "Machine Learning",
    "Web Systems",
    "CO2060"
  ]
}
