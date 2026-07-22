#!/usr/bin/env python3
"""
Comprehensive backend test for CareerPilot AI
Tests all API endpoints with proper authentication and timeouts
"""

import requests
import json
import time
import sys
from datetime import datetime, timedelta

# Configuration
BASE_URL = "https://ai-career-coach-56.preview.emergentagent.com/api"
TIMEOUT_NORMAL = 10
TIMEOUT_LLM = 90  # LLM calls take 15-45 seconds
COOKIE_FILE = "/tmp/cookies.txt"

# Test data
TEST_USER = {
    "email": f"test_{int(time.time())}@careerpilot.test",
    "password": "TestPass123!",
    "name": "Test User"
}

# Global state
session = requests.Session()
user_id = None
resume_id = None
job_search_results = []
contact_id = None
application_id = None

def log(msg, level="INFO"):
    """Log test messages"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] [{level}] {msg}")

def test_endpoint(name, method, endpoint, data=None, files=None, timeout=TIMEOUT_NORMAL, expect_status=200):
    """Test a single endpoint"""
    url = f"{BASE_URL}{endpoint}"
    log(f"Testing {name}: {method} {endpoint}")
    
    try:
        if method == "GET":
            resp = session.get(url, timeout=timeout)
        elif method == "POST":
            if files:
                resp = session.post(url, files=files, data=data, timeout=timeout)
            else:
                resp = session.post(url, json=data, timeout=timeout)
        elif method == "PATCH":
            resp = session.patch(url, json=data, timeout=timeout)
        elif method == "DELETE":
            resp = session.delete(url, timeout=timeout)
        else:
            log(f"Unknown method: {method}", "ERROR")
            return None
        
        log(f"Response: {resp.status_code}", "DEBUG")
        
        if resp.status_code != expect_status:
            log(f"FAILED: Expected {expect_status}, got {resp.status_code}", "ERROR")
            log(f"Response body: {resp.text[:500]}", "ERROR")
            return None
        
        try:
            result = resp.json()
            log(f"SUCCESS: {name}", "SUCCESS")
            return result
        except:
            log(f"SUCCESS: {name} (no JSON response)", "SUCCESS")
            return {"ok": True}
            
    except requests.exceptions.Timeout:
        log(f"FAILED: Timeout after {timeout}s", "ERROR")
        return None
    except Exception as e:
        log(f"FAILED: {str(e)}", "ERROR")
        return None

def run_tests():
    """Run all backend tests"""
    global user_id, resume_id, job_search_results, contact_id, application_id
    
    log("=" * 80)
    log("Starting CareerPilot AI Backend Tests")
    log("=" * 80)
    
    # ============ 1. AUTH FLOW ============
    log("\n### PHASE 1: AUTH FLOW ###")
    
    # Signup
    result = test_endpoint(
        "Auth Signup",
        "POST",
        "/auth/signup",
        data=TEST_USER
    )
    if not result or "user" not in result:
        log("CRITICAL: Signup failed, cannot continue", "ERROR")
        return False
    
    user_id = result["user"]["id"]
    log(f"User created: {user_id}")
    
    # Logout
    test_endpoint("Auth Logout", "POST", "/auth/logout")
    
    # Login
    result = test_endpoint(
        "Auth Login",
        "POST",
        "/auth/login",
        data={"email": TEST_USER["email"], "password": TEST_USER["password"]}
    )
    if not result or "user" not in result:
        log("CRITICAL: Login failed, cannot continue", "ERROR")
        return False
    
    # Get current user
    result = test_endpoint("Auth /me (authenticated)", "GET", "/auth/me")
    if not result or not result.get("user"):
        log("CRITICAL: /me failed, cannot continue", "ERROR")
        return False
    
    # Test logout and /me returns null
    test_endpoint("Auth Logout", "POST", "/auth/logout")
    result = test_endpoint("Auth /me (after logout)", "GET", "/auth/me")
    if result and result.get("user") is None:
        log("SUCCESS: /me returns null after logout", "SUCCESS")
    
    # Login again for subsequent tests
    result = test_endpoint(
        "Auth Login (re-login)",
        "POST",
        "/auth/login",
        data={"email": TEST_USER["email"], "password": TEST_USER["password"]}
    )
    if not result:
        log("CRITICAL: Re-login failed", "ERROR")
        return False
    
    # ============ 2. SETTINGS ============
    log("\n### PHASE 2: SETTINGS ###")
    
    result = test_endpoint("Settings GET", "GET", "/settings")
    if result and "settings" in result:
        log(f"Current AI provider: {result['settings'].get('aiProvider', 'openai')}")
    
    # Switch to anthropic
    result = test_endpoint(
        "Settings PATCH (switch to anthropic)",
        "PATCH",
        "/settings",
        data={"settings": {"aiProvider": "anthropic"}}
    )
    
    # Switch back to openai
    result = test_endpoint(
        "Settings PATCH (switch back to openai)",
        "PATCH",
        "/settings",
        data={"settings": {"aiProvider": "openai"}}
    )
    
    # ============ 3. RESUMES (PHASE 1) ============
    log("\n### PHASE 3: RESUMES (CORE FEATURE) ###")
    
    # Upload resume
    log("Uploading resume (this will take ~15-30s for AI parsing)...")
    with open("/tmp/sample.docx", "rb") as f:
        result = test_endpoint(
            "Resume Upload + AI Parse",
            "POST",
            "/resumes/upload",
            files={"file": ("resume.docx", f, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
            timeout=TIMEOUT_LLM
        )
    
    if not result or "resume" not in result:
        log("CRITICAL: Resume upload failed", "ERROR")
        return False
    
    resume_id = result["resume"]["id"]
    log(f"Resume uploaded: {resume_id}")
    
    # Verify parsed data
    if "parsed" in result["resume"]:
        parsed = result["resume"]["parsed"]
        log(f"Parsed resume - Name: {parsed.get('name', 'N/A')}, Skills: {len(parsed.get('skills', []))}")
    
    # Get resumes list
    result = test_endpoint("Resumes GET list", "GET", "/resumes")
    if result and "resumes" in result and len(result["resumes"]) > 0:
        log(f"Found {len(result['resumes'])} resume(s)")
    
    # Analyze resume
    log("Analyzing resume (this will take ~20-30s)...")
    result = test_endpoint(
        "Resume Analyze (ATS scoring)",
        "POST",
        f"/resumes/{resume_id}/analyze",
        data={"targetRole": "Backend Engineer"},
        timeout=TIMEOUT_LLM
    )
    
    if result and "analysis" in result:
        analysis = result["analysis"]
        ats_score = analysis.get("atsScore", "N/A")
        log(f"ATS Score: {ats_score}/100")
        if isinstance(ats_score, (int, float)) and 0 <= ats_score <= 100:
            log("SUCCESS: ATS score is valid", "SUCCESS")
        else:
            log("WARNING: ATS score is not a valid number", "WARNING")
        
        log(f"Strengths: {len(analysis.get('strengths', []))}, Weaknesses: {len(analysis.get('weaknesses', []))}")
    
    # Optimize resume
    log("Optimizing resume (this will take ~30s)...")
    result = test_endpoint(
        "Resume Optimize",
        "POST",
        f"/resumes/{resume_id}/optimize",
        data={"targetRole": "Backend Engineer"},
        timeout=TIMEOUT_LLM
    )
    
    if result and "optimized" in result and "versionId" in result:
        log(f"Resume optimized, version: {result['versionId']}")
    
    # Tailor resume
    log("Tailoring resume (this will take ~30s)...")
    result = test_endpoint(
        "Resume Tailor",
        "POST",
        f"/resumes/{resume_id}/tailor",
        data={
            "jobTitle": "SRE",
            "company": "Google",
            "jobDescription": "SRE role focused on Kubernetes and observability. Must have experience with distributed systems."
        },
        timeout=TIMEOUT_LLM
    )
    
    if result and "tailored" in result and "versionId" in result:
        log(f"Resume tailored, version: {result['versionId']}")
    
    # Get versions
    result = test_endpoint("Resume Versions GET", "GET", f"/resumes/{resume_id}/versions")
    if result and "versions" in result:
        log(f"Found {len(result['versions'])} version(s) (expected >= 3)")
        if len(result["versions"]) >= 3:
            log("SUCCESS: All resume versions created", "SUCCESS")
    
    # Update resume
    result = test_endpoint(
        "Resume PATCH",
        "PATCH",
        f"/resumes/{resume_id}",
        data={"title": "Updated Resume Title"}
    )
    
    # ============ 4. JOBS (PHASE 2) ============
    log("\n### PHASE 4: JOBS ###")
    
    # Job search
    log("Searching jobs (this will take ~30s)...")
    result = test_endpoint(
        "Job Search",
        "POST",
        "/jobs/search",
        data={
            "title": "Backend Engineer",
            "country": "United States",
            "city": "San Francisco",
            "workMode": "any"
        },
        timeout=TIMEOUT_LLM
    )
    
    if result and "jobs" in result:
        job_search_results = result["jobs"]
        log(f"Found {len(job_search_results)} jobs")
        if len(job_search_results) >= 10:
            log("SUCCESS: Job search returned sufficient results", "SUCCESS")
    
    # Job match
    if job_search_results:
        log("Matching resume to job (this will take ~20s)...")
        result = test_endpoint(
            "Job Match",
            "POST",
            "/jobs/match",
            data={
                "resumeId": resume_id,
                "job": job_search_results[0]
            },
            timeout=TIMEOUT_LLM
        )
        
        if result and "match" in result:
            match_score = result["match"].get("matchScore", "N/A")
            log(f"Match score: {match_score}/100")
            if isinstance(match_score, (int, float)) and 0 <= match_score <= 100:
                log("SUCCESS: Match score is valid", "SUCCESS")
        
        # Save job
        result = test_endpoint(
            "Job Save",
            "POST",
            "/jobs/save",
            data={"job": job_search_results[0]}
        )
        
        # Get saved jobs
        result = test_endpoint("Jobs Saved GET", "GET", "/jobs/saved")
        if result and "jobs" in result:
            log(f"Found {len(result['jobs'])} saved job(s)")
    
    # ============ 5. COVER LETTER ============
    log("\n### PHASE 5: COVER LETTER ###")
    
    log("Generating cover letter (this will take ~15s)...")
    result = test_endpoint(
        "Cover Letter Generate",
        "POST",
        "/cover-letter/generate",
        data={
            "resumeId": resume_id,
            "jobTitle": "Backend Engineer",
            "company": "Stripe",
            "jobDescription": "We're looking for a Backend Engineer to build scalable payment systems. Must have experience with distributed systems, databases, and API design.",
            "style": "professional",
            "tone": "confident"
        },
        timeout=TIMEOUT_LLM
    )
    
    if result and "coverLetter" in result:
        content = result["coverLetter"].get("content", "")
        log(f"Cover letter generated: {len(content)} characters")
        if len(content) > 100:
            log("SUCCESS: Cover letter has meaningful content", "SUCCESS")
    
    # List cover letters
    result = test_endpoint("Cover Letter List", "GET", "/cover-letter/list")
    if result and "coverLetters" in result:
        log(f"Found {len(result['coverLetters'])} cover letter(s)")
    
    # ============ 6. APPLICATIONS ============
    log("\n### PHASE 6: APPLICATION TRACKER ###")
    
    # Create application
    result = test_endpoint(
        "Application Create",
        "POST",
        "/applications",
        data={
            "jobTitle": "Backend Engineer",
            "company": "Stripe",
            "location": "San Francisco, CA",
            "status": "applied"
        }
    )
    
    if result and "application" in result:
        application_id = result["application"]["id"]
        log(f"Application created: {application_id}")
    
    # Get applications
    result = test_endpoint("Applications GET", "GET", "/applications")
    if result and "applications" in result:
        log(f"Found {len(result['applications'])} application(s)")
    
    # Update application status
    if application_id:
        result = test_endpoint(
            "Application PATCH (status change)",
            "PATCH",
            f"/applications/{application_id}",
            data={"status": "interview"}
        )
        
        if result and "application" in result:
            events = result["application"].get("events", [])
            log(f"Application updated, events: {len(events)}")
    
    # ============ 7. INTERVIEW COACH (PHASE 3) ============
    log("\n### PHASE 7: INTERVIEW COACH ###")
    
    # Generate questions
    log("Generating interview questions (this will take ~20s)...")
    result = test_endpoint(
        "Interview Questions Generate",
        "POST",
        "/interview/questions",
        data={
            "category": "behavioral",
            "jobTitle": "Backend Engineer",
            "count": 3,
            "difficulty": "medium"
        },
        timeout=TIMEOUT_LLM
    )
    
    question_text = None
    if result and "questions" in result:
        questions = result["questions"]
        log(f"Generated {len(questions)} question(s)")
        if len(questions) >= 3:
            log("SUCCESS: Generated expected number of questions", "SUCCESS")
            question_text = questions[0].get("question", "Tell me about a time you faced a challenge.")
    
    # Evaluate answer
    log("Evaluating interview answer (this will take ~15s)...")
    result = test_endpoint(
        "Interview Answer Evaluate",
        "POST",
        "/interview/evaluate",
        data={
            "question": question_text or "Tell me about a time you faced a challenge.",
            "answer": "I led a project to migrate our monolithic application to microservices. We faced challenges with data consistency and service communication. I implemented event sourcing and CQRS patterns, which improved system reliability by 40%.",
            "category": "behavioral"
        },
        timeout=TIMEOUT_LLM
    )
    
    if result and "evaluation" in result:
        overall_score = result["evaluation"].get("overallScore", "N/A")
        log(f"Evaluation score: {overall_score}/100")
        if isinstance(overall_score, (int, float)) and 0 <= overall_score <= 100:
            log("SUCCESS: Evaluation score is valid", "SUCCESS")
    
    # Generate coding problem
    log("Generating coding problem (this will take ~20s)...")
    result = test_endpoint(
        "Interview Coding Problem Generate",
        "POST",
        "/interview/coding",
        data={
            "difficulty": "easy"
        },
        timeout=TIMEOUT_LLM
    )
    
    coding_problem = None
    if result and "problem" in result:
        coding_problem = result["problem"]
        log(f"Coding problem: {coding_problem.get('title', 'N/A')}")
    
    # Evaluate coding solution
    log("Evaluating coding solution (this will take ~20s)...")
    result = test_endpoint(
        "Interview Coding Evaluate",
        "POST",
        "/interview/coding/evaluate",
        data={
            "problem": coding_problem or {"title": "Two Sum", "statement": "Find two numbers that add up to target"},
            "code": "function twoSum(nums, target) { const map = new Map(); for (let i = 0; i < nums.length; i++) { const complement = target - nums[i]; if (map.has(complement)) return [map.get(complement), i]; map.set(nums[i], i); } return []; }"
        },
        timeout=TIMEOUT_LLM
    )
    
    if result and "evaluation" in result:
        overall_score = result["evaluation"].get("overallScore", "N/A")
        log(f"Coding evaluation score: {overall_score}/100")
    
    # Generate system design problem
    log("Generating system design problem (this will take ~20s)...")
    result = test_endpoint(
        "Interview System Design Problem Generate",
        "POST",
        "/interview/system-design",
        data={
            "difficulty": "senior"
        },
        timeout=TIMEOUT_LLM
    )
    
    if result and "problem" in result:
        log(f"System design problem: {result['problem'].get('title', 'N/A')}")
    
    # Evaluate system design answer
    log("Evaluating system design answer (this will take ~20s)...")
    result = test_endpoint(
        "Interview System Design Evaluate",
        "POST",
        "/interview/system-design",
        data={
            "question": "Design a URL shortener",
            "answer": "I would use a KV store like Redis for fast lookups, with a hash function to generate short codes. For persistence, use PostgreSQL. Add a CDN for global distribution. Use consistent hashing for sharding. Implement rate limiting to prevent abuse."
        },
        timeout=TIMEOUT_LLM
    )
    
    if result and "evaluation" in result:
        overall_score = result["evaluation"].get("overallScore", "N/A")
        log(f"System design evaluation score: {overall_score}/100")
    
    # Save interview session
    result = test_endpoint(
        "Interview Session Save",
        "POST",
        "/interview/session",
        data={
            "category": "behavioral",
            "summary": {"avgScore": 80, "questionsAnswered": 5}
        }
    )
    
    # Get interview sessions
    result = test_endpoint("Interview Sessions GET", "GET", "/interview/sessions")
    if result and "sessions" in result:
        log(f"Found {len(result['sessions'])} session(s)")
    
    # ============ 8. CRM (PHASE 4) ============
    log("\n### PHASE 8: RECRUITER CRM ###")
    
    # Create contact
    result = test_endpoint(
        "CRM Contact Create",
        "POST",
        "/crm/contacts",
        data={
            "name": "Alice Johnson",
            "title": "Senior Recruiter",
            "company": "Stripe",
            "email": "alice@stripe.com"
        }
    )
    
    if result and "contact" in result:
        contact_id = result["contact"]["id"]
        log(f"Contact created: {contact_id}")
    
    # Get contacts
    result = test_endpoint("CRM Contacts GET", "GET", "/crm/contacts")
    if result and "contacts" in result:
        log(f"Found {len(result['contacts'])} contact(s)")
    
    # Update contact
    if contact_id:
        result = test_endpoint(
            "CRM Contact PATCH",
            "PATCH",
            f"/crm/contacts/{contact_id}",
            data={"notes": "Met at tech conference"}
        )
    
    # Generate outreach message
    if contact_id:
        log("Generating outreach message (this will take ~15s)...")
        result = test_endpoint(
            "CRM Outreach Generate",
            "POST",
            "/crm/outreach",
            data={
                "contactId": contact_id,
                "purpose": "introduction",
                "jobTitle": "Backend Engineer",
                "resumeId": resume_id
            },
            timeout=TIMEOUT_LLM
        )
        
        if result and "message" in result:
            subject = result["message"].get("subject", "")
            body = result["message"].get("body", "")
            log(f"Outreach message generated: {len(body)} characters")
            if len(body) > 50:
                log("SUCCESS: Outreach message has meaningful content", "SUCCESS")
    
    # Create follow-up
    if contact_id:
        future_date = (datetime.now() + timedelta(days=7)).isoformat()
        result = test_endpoint(
            "CRM Follow-up Create",
            "POST",
            "/crm/followup",
            data={
                "contactId": contact_id,
                "dueDate": future_date,
                "note": "Follow up on application"
            }
        )
    
    # Get follow-ups
    result = test_endpoint("CRM Follow-ups GET", "GET", "/crm/followups")
    if result and "followups" in result:
        log(f"Found {len(result['followups'])} follow-up(s)")
    
    # ============ 9. ANALYTICS ============
    log("\n### PHASE 9: ANALYTICS ###")
    
    result = test_endpoint("Analytics GET", "GET", "/analytics")
    if result and "totals" in result:
        totals = result["totals"]
        log(f"Analytics - Applications: {totals.get('applications', 0)}, Resumes: {totals.get('resumes', 0)}, Interviews: {totals.get('interviews', 0)}")
        log(f"Status counts: {result.get('statusCount', {})}")
        log(f"Avg interview score: {result.get('avgInterviewScore', 0)}")
    
    # ============ 10. MODELS & PROVIDER ============
    log("\n### PHASE 10: MODELS & PROVIDER ###")
    
    result = test_endpoint("Models GET", "GET", "/models")
    if result and "models" in result:
        models = result["models"]
        log(f"Available providers: {', '.join(models.keys())}")
        if "openai" in models and "anthropic" in models and "google" in models:
            log("SUCCESS: All AI providers available", "SUCCESS")
    
    # ============ CLEANUP ============
    log("\n### CLEANUP ###")
    
    # Delete application
    if application_id:
        test_endpoint("Application DELETE", "DELETE", f"/applications/{application_id}")
    
    # Delete contact
    if contact_id:
        test_endpoint("CRM Contact DELETE", "DELETE", f"/crm/contacts/{contact_id}")
    
    # Delete resume (do this last)
    if resume_id:
        test_endpoint("Resume DELETE", "DELETE", f"/resumes/{resume_id}")
    
    log("\n" + "=" * 80)
    log("Backend tests completed!")
    log("=" * 80)
    
    return True

if __name__ == "__main__":
    try:
        success = run_tests()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        log("\nTests interrupted by user", "WARNING")
        sys.exit(1)
    except Exception as e:
        log(f"Unexpected error: {str(e)}", "ERROR")
        import traceback
        traceback.print_exc()
        sys.exit(1)
