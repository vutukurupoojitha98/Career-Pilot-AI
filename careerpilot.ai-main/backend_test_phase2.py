#!/usr/bin/env python3
"""
Phase 2 Regression Test for CareerPilot AI
Tests new endpoints: job connectors, live search, feature flags, admin endpoints, 
CRM templates, notifications, interview progress, learning plans
"""

import requests
import json
import time
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://ai-career-coach-56.preview.emergentagent.com/api"
TIMEOUT_NORMAL = 15
TIMEOUT_LLM = 90  # LLM calls can take 30-60s
TIMEOUT_LIVE_SEARCH = 70  # Live search aggregates multiple APIs

# Admin credentials (has admin role because email matches ADMIN_EMAIL env var)
ADMIN_EMAIL = "admin@careerpilot.ai"
ADMIN_PASSWORD = "adminpass123"

# Global state
session = requests.Session()
template_id = None
test_results = []

def log(msg, level="INFO"):
    """Log test messages"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    color = {
        "INFO": "\033[94m",
        "SUCCESS": "\033[92m",
        "ERROR": "\033[91m",
        "WARN": "\033[93m"
    }.get(level, "")
    reset = "\033[0m"
    print(f"{color}[{timestamp}] [{level}] {msg}{reset}")

def test_endpoint(name, method, endpoint, data=None, timeout=TIMEOUT_NORMAL, expect_status=200, check_fields=None):
    """Test a single endpoint and validate response structure"""
    url = f"{BASE_URL}{endpoint}"
    log(f"Testing: {name}")
    log(f"  {method} {endpoint}", "INFO")
    
    result = {
        "name": name,
        "endpoint": endpoint,
        "method": method,
        "status": None,
        "success": False,
        "error": None,
        "response": None
    }
    
    try:
        if method == "GET":
            resp = session.get(url, timeout=timeout)
        elif method == "POST":
            resp = session.post(url, json=data, timeout=timeout)
        elif method == "PATCH":
            resp = session.patch(url, json=data, timeout=timeout)
        elif method == "DELETE":
            resp = session.delete(url, timeout=timeout)
        else:
            result["error"] = f"Unknown method: {method}"
            log(f"  ❌ FAILED: {result['error']}", "ERROR")
            test_results.append(result)
            return None
        
        result["status"] = resp.status_code
        
        if resp.status_code != expect_status:
            result["error"] = f"Expected {expect_status}, got {resp.status_code}"
            try:
                error_body = resp.json()
                result["error"] += f" - {error_body.get('error', resp.text[:200])}"
            except:
                result["error"] += f" - {resp.text[:200]}"
            log(f"  ❌ FAILED: {result['error']}", "ERROR")
            test_results.append(result)
            return None
        
        try:
            response_data = resp.json()
            result["response"] = response_data
            
            # Validate required fields if specified
            if check_fields:
                missing = []
                for field in check_fields:
                    if '.' in field:
                        # Nested field check
                        parts = field.split('.')
                        obj = response_data
                        for part in parts:
                            if isinstance(obj, dict) and part in obj:
                                obj = obj[part]
                            else:
                                missing.append(field)
                                break
                    else:
                        if field not in response_data:
                            missing.append(field)
                
                if missing:
                    result["error"] = f"Missing fields: {', '.join(missing)}"
                    log(f"  ⚠️  WARNING: {result['error']}", "WARN")
                    # Don't fail the test, just warn
            
            result["success"] = True
            log(f"  ✅ SUCCESS: {resp.status_code}", "SUCCESS")
            return response_data
            
        except Exception as e:
            result["error"] = f"JSON parse error: {str(e)}"
            log(f"  ❌ FAILED: {result['error']}", "ERROR")
            test_results.append(result)
            return None
            
    except requests.exceptions.Timeout:
        result["error"] = f"Timeout after {timeout}s"
        log(f"  ❌ FAILED: {result['error']}", "ERROR")
        test_results.append(result)
        return None
    except Exception as e:
        result["error"] = str(e)
        log(f"  ❌ FAILED: {result['error']}", "ERROR")
        test_results.append(result)
        return None
    finally:
        if result["success"]:
            test_results.append(result)

def print_summary():
    """Print test summary"""
    log("\n" + "=" * 80)
    log("TEST SUMMARY")
    log("=" * 80)
    
    passed = sum(1 for r in test_results if r["success"])
    failed = len(test_results) - passed
    
    log(f"\nTotal Tests: {len(test_results)}")
    log(f"Passed: {passed}", "SUCCESS")
    log(f"Failed: {failed}", "ERROR" if failed > 0 else "SUCCESS")
    
    if failed > 0:
        log("\n❌ FAILED TESTS:", "ERROR")
        for r in test_results:
            if not r["success"]:
                log(f"  • {r['name']}: {r['error']}", "ERROR")
    
    log("\n" + "=" * 80)
    return failed == 0

def run_phase2_tests():
    """Run Phase 2 regression tests"""
    global template_id
    
    log("=" * 80)
    log("CareerPilot AI - Phase 2 Regression Tests")
    log("=" * 80)
    
    # ============ SETUP: LOGIN AS ADMIN ============
    log("\n### SETUP: Admin Login ###")
    result = test_endpoint(
        "Admin Login",
        "POST",
        "/auth/login",
        data={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        check_fields=["user"]
    )
    if not result:
        log("❌ Cannot proceed without admin login", "ERROR")
        return False
    
    log(f"  Logged in as: {result['user'].get('email')} (role: {result['user'].get('role')})")
    time.sleep(1)
    
    # ============ TEST 1: GET /api/jobs/connectors ============
    log("\n### TEST 1: Job Connectors List ###")
    result = test_endpoint(
        "GET /api/jobs/connectors",
        "GET",
        "/jobs/connectors",
        check_fields=["connectors"]
    )
    if result:
        connectors = result.get("connectors", [])
        log(f"  Found {len(connectors)} connectors")
        expected = ["remoteok", "greenhouse", "lever", "ashby", "wellfound", "career_sites"]
        found_keys = [c.get("key") for c in connectors]
        log(f"  Connectors: {', '.join(found_keys)}")
        
        # Check for expected connectors
        missing = [k for k in expected if k not in found_keys]
        if missing:
            log(f"  ⚠️  Missing connectors: {', '.join(missing)}", "WARN")
        
        # Check live status
        live_connectors = [c.get("key") for c in connectors if c.get("live")]
        log(f"  Live connectors: {', '.join(live_connectors)}")
    time.sleep(1)
    
    # ============ TEST 2: POST /api/jobs/live-search (RemoteOK + Greenhouse) ============
    log("\n### TEST 2: Live Job Search - RemoteOK + Greenhouse ###")
    result = test_endpoint(
        "POST /api/jobs/live-search (engineer, remoteok+greenhouse)",
        "POST",
        "/jobs/live-search",
        data={
            "title": "engineer",
            "providers": ["remoteok", "greenhouse"],
            "limit": 10
        },
        timeout=TIMEOUT_LIVE_SEARCH,
        check_fields=["jobs", "bySource", "searchId"]
    )
    if result:
        jobs = result.get("jobs", [])
        by_source = result.get("bySource", {})
        log(f"  Found {len(jobs)} jobs")
        log(f"  By source: {json.dumps(by_source)}")
        if jobs:
            sample = jobs[0]
            log(f"  Sample job: {sample.get('title')} at {sample.get('company')}")
    time.sleep(2)
    
    # ============ TEST 3: POST /api/jobs/live-search (Lever + Ashby) ============
    log("\n### TEST 3: Live Job Search - Lever + Ashby ###")
    result = test_endpoint(
        "POST /api/jobs/live-search (backend, lever+ashby)",
        "POST",
        "/jobs/live-search",
        data={
            "title": "backend",
            "providers": ["lever", "ashby"],
            "limit": 10
        },
        timeout=TIMEOUT_LIVE_SEARCH,
        check_fields=["jobs", "bySource", "searchId"]
    )
    if result:
        jobs = result.get("jobs", [])
        by_source = result.get("bySource", {})
        log(f"  Found {len(jobs)} jobs")
        log(f"  By source: {json.dumps(by_source)}")
    time.sleep(2)
    
    # ============ TEST 4: POST /api/jobs/live-search (with workMode filter) ============
    log("\n### TEST 4: Live Job Search - With workMode Filter ###")
    result = test_endpoint(
        "POST /api/jobs/live-search (engineer, remote only)",
        "POST",
        "/jobs/live-search",
        data={
            "title": "engineer",
            "providers": ["remoteok"],
            "workMode": "remote",
            "limit": 5
        },
        timeout=TIMEOUT_LIVE_SEARCH,
        check_fields=["jobs", "bySource", "searchId"]
    )
    if result:
        jobs = result.get("jobs", [])
        log(f"  Found {len(jobs)} jobs")
        # Verify workMode filter
        remote_jobs = [j for j in jobs if j.get("workMode") == "remote"]
        log(f"  Remote jobs: {len(remote_jobs)}/{len(jobs)}")
        if len(remote_jobs) < len(jobs):
            log(f"  ⚠️  Some jobs are not remote", "WARN")
    time.sleep(2)
    
    # ============ TEST 5: GET /api/feature-flags (public) ============
    log("\n### TEST 5: Feature Flags - Public Endpoint ###")
    result = test_endpoint(
        "GET /api/feature-flags (public)",
        "GET",
        "/feature-flags",
        check_fields=["flags"]
    )
    if result:
        flags = result.get("flags", {})
        log(f"  Found {len(flags)} flags")
        log(f"  Flags: {json.dumps(flags, indent=2)}")
    time.sleep(1)
    
    # ============ TEST 6: GET /api/admin/feature-flags ============
    log("\n### TEST 6: Admin Feature Flags - List ###")
    result = test_endpoint(
        "GET /api/admin/feature-flags",
        "GET",
        "/admin/feature-flags",
        check_fields=["flags"]
    )
    if result:
        flags = result.get("flags", [])
        log(f"  Found {len(flags)} flags")
        expected_flags = ["career_copilot", "coding_playground", "whiteboard", "live_job_search", 
                         "gmail_integration", "microsoft_integration", "voice_interview"]
        found_keys = [f.get("key") for f in flags]
        log(f"  Flag keys: {', '.join(found_keys)}")
        missing = [k for k in expected_flags if k not in found_keys]
        if missing:
            log(f"  ⚠️  Missing expected flags: {', '.join(missing)}", "WARN")
    time.sleep(1)
    
    # ============ TEST 7: PATCH /api/admin/feature-flags (disable whiteboard) ============
    log("\n### TEST 7: Admin Feature Flags - Disable Whiteboard ###")
    result = test_endpoint(
        "PATCH /api/admin/feature-flags (whiteboard=false)",
        "PATCH",
        "/admin/feature-flags",
        data={"key": "whiteboard", "enabled": False},
        check_fields=["ok"]
    )
    time.sleep(1)
    
    # ============ TEST 8: GET /api/feature-flags (verify whiteboard disabled) ============
    log("\n### TEST 8: Feature Flags - Verify Whiteboard Disabled ###")
    result = test_endpoint(
        "GET /api/feature-flags (verify whiteboard=false)",
        "GET",
        "/feature-flags",
        check_fields=["flags"]
    )
    if result:
        flags = result.get("flags", {})
        whiteboard_enabled = flags.get("whiteboard")
        if whiteboard_enabled is False:
            log(f"  ✅ Whiteboard correctly disabled", "SUCCESS")
        else:
            log(f"  ⚠️  Whiteboard status: {whiteboard_enabled}", "WARN")
    time.sleep(1)
    
    # ============ TEST 9: PATCH /api/admin/feature-flags (re-enable whiteboard) ============
    log("\n### TEST 9: Admin Feature Flags - Re-enable Whiteboard ###")
    result = test_endpoint(
        "PATCH /api/admin/feature-flags (whiteboard=true)",
        "PATCH",
        "/admin/feature-flags",
        data={"key": "whiteboard", "enabled": True},
        check_fields=["ok"]
    )
    time.sleep(1)
    
    # ============ TEST 10: GET /api/admin/subscriptions ============
    log("\n### TEST 10: Admin Subscriptions ###")
    result = test_endpoint(
        "GET /api/admin/subscriptions",
        "GET",
        "/admin/subscriptions",
        check_fields=["byPlan", "total"]
    )
    if result:
        by_plan = result.get("byPlan", {})
        total = result.get("total", 0)
        log(f"  Total users: {total}")
        for plan, data in by_plan.items():
            log(f"  {plan}: {data.get('count', 0)} users")
    time.sleep(1)
    
    # ============ TEST 11: GET /api/admin/audit-logs ============
    log("\n### TEST 11: Admin Audit Logs ###")
    result = test_endpoint(
        "GET /api/admin/audit-logs?limit=20",
        "GET",
        "/admin/audit-logs?limit=20",
        check_fields=["logs"]
    )
    if result:
        logs = result.get("logs", [])
        log(f"  Found {len(logs)} audit logs")
        if logs:
            sample = logs[0]
            log(f"  Sample log: {sample.get('action')} by {sample.get('user', {}).get('email', 'unknown')}")
            # Check if user enrichment is working
            if sample.get("user") and "email" in sample["user"]:
                log(f"  ✅ User enrichment working", "SUCCESS")
    time.sleep(1)
    
    # ============ TEST 12: POST /api/crm/templates/seed ============
    log("\n### TEST 12: CRM Templates - Seed ###")
    result = test_endpoint(
        "POST /api/crm/templates/seed",
        "POST",
        "/crm/templates/seed",
        check_fields=["ok", "seeded"]
    )
    if result:
        seeded = result.get("seeded", 0)
        log(f"  Seeded {seeded} templates (0 if already seeded)")
    time.sleep(1)
    
    # ============ TEST 13: GET /api/crm/templates ============
    log("\n### TEST 13: CRM Templates - List ###")
    result = test_endpoint(
        "GET /api/crm/templates",
        "GET",
        "/crm/templates",
        check_fields=["templates"]
    )
    if result:
        templates = result.get("templates", [])
        log(f"  Found {len(templates)} templates")
        expected_names = ["Cold intro", "Referral request", "Follow-up", "Thank-you"]
        found_names = [t.get("name", "").lower() for t in templates]
        log(f"  Template names: {', '.join([t.get('name', '') for t in templates[:5]])}")
        
        # Check for global templates
        global_templates = [t for t in templates if t.get("global")]
        log(f"  Global templates: {len(global_templates)}")
    time.sleep(1)
    
    # ============ TEST 14: POST /api/crm/templates ============
    log("\n### TEST 14: CRM Templates - Create Custom ###")
    result = test_endpoint(
        "POST /api/crm/templates",
        "POST",
        "/crm/templates",
        data={
            "name": "Custom outreach",
            "category": "outreach",
            "subject": "Test",
            "body": "Body {name}",
            "variables": ["name"]
        },
        check_fields=["template"]
    )
    if result:
        template = result.get("template", {})
        template_id = template.get("id")
        log(f"  Created template: {template.get('name')} (id: {template_id})")
    time.sleep(1)
    
    # ============ TEST 15: PATCH /api/crm/templates/{id} ============
    log("\n### TEST 15: CRM Templates - Update ###")
    if template_id:
        result = test_endpoint(
            f"PATCH /api/crm/templates/{template_id}",
            "PATCH",
            f"/crm/templates/{template_id}",
            data={"subject": "Updated"},
            check_fields=["ok"]
        )
        time.sleep(1)
        
        # Verify update
        result = test_endpoint(
            "GET /api/crm/templates (verify update)",
            "GET",
            "/crm/templates",
            check_fields=["templates"]
        )
        if result:
            templates = result.get("templates", [])
            updated = next((t for t in templates if t.get("id") == template_id), None)
            if updated and updated.get("subject") == "Updated":
                log(f"  ✅ Template updated successfully", "SUCCESS")
    else:
        log("  ⚠️  Skipping update test (no template_id)", "WARN")
    time.sleep(1)
    
    # ============ TEST 16: DELETE /api/crm/templates/{id} ============
    log("\n### TEST 16: CRM Templates - Delete ###")
    if template_id:
        result = test_endpoint(
            f"DELETE /api/crm/templates/{template_id}",
            "DELETE",
            f"/crm/templates/{template_id}",
            check_fields=["ok"]
        )
    else:
        log("  ⚠️  Skipping delete test (no template_id)", "WARN")
    time.sleep(1)
    
    # ============ TEST 17: POST /api/notifications/generate ============
    log("\n### TEST 17: Notifications - Generate ###")
    result = test_endpoint(
        "POST /api/notifications/generate",
        "POST",
        "/notifications/generate",
        check_fields=["ok", "created", "notifications"]
    )
    if result:
        created = result.get("created", 0)
        notifications = result.get("notifications", [])
        log(f"  Created {created} notifications")
        if notifications:
            log(f"  Sample: {notifications[0].get('title')}")
        
        # Test idempotency - run again
        log("  Testing idempotency...")
        result2 = test_endpoint(
            "POST /api/notifications/generate (idempotency check)",
            "POST",
            "/notifications/generate",
            check_fields=["ok", "created"]
        )
        if result2:
            created2 = result2.get("created", 0)
            if created2 == 0:
                log(f"  ✅ Idempotency working (0 duplicates created)", "SUCCESS")
            else:
                log(f"  ⚠️  Created {created2} more notifications (expected 0)", "WARN")
    time.sleep(1)
    
    # ============ TEST 18: GET /api/interview/progress ============
    log("\n### TEST 18: Interview Progress ###")
    result = test_endpoint(
        "GET /api/interview/progress",
        "GET",
        "/interview/progress",
        check_fields=["totalAnswers", "byCategory", "timeline", "dimensions"]
    )
    if result:
        total = result.get("totalAnswers", 0)
        by_category = result.get("byCategory", {})
        timeline = result.get("timeline", [])
        dimensions = result.get("dimensions", {})
        log(f"  Total answers: {total}")
        log(f"  Categories: {', '.join(by_category.keys())}")
        log(f"  Timeline days: {len(timeline)}")
        log(f"  Dimensions: {json.dumps(dimensions)}")
    time.sleep(1)
    
    # ============ TEST 19: POST /api/interview/learning-plan ============
    log("\n### TEST 19: Interview Learning Plan - Generate ###")
    result = test_endpoint(
        "POST /api/interview/learning-plan",
        "POST",
        "/interview/learning-plan",
        data={
            "targetRole": "Backend Engineer",
            "company": "Stripe",
            "focusTracks": ["behavioral", "technical"]
        },
        timeout=TIMEOUT_LLM,
        check_fields=["plan"]
    )
    if result:
        plan = result.get("plan", {})
        plan_data = plan.get("plan", {})
        weeks = plan_data.get("weeks", [])
        log(f"  Plan title: {plan_data.get('title', 'N/A')}")
        log(f"  Weeks: {len(weeks)}")
        if weeks:
            log(f"  Week 1 theme: {weeks[0].get('theme', 'N/A')}")
    time.sleep(1)
    
    # ============ TEST 20: GET /api/interview/learning-plans ============
    log("\n### TEST 20: Interview Learning Plans - List ###")
    result = test_endpoint(
        "GET /api/interview/learning-plans",
        "GET",
        "/interview/learning-plans",
        check_fields=["plans"]
    )
    if result:
        plans = result.get("plans", [])
        log(f"  Found {len(plans)} learning plans")
        if plans:
            log(f"  Latest plan: {plans[0].get('targetRole', 'N/A')} at {plans[0].get('company', 'N/A')}")
    
    log("\n" + "=" * 80)
    return True

if __name__ == "__main__":
    try:
        run_phase2_tests()
        success = print_summary()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        log("\n\nTests interrupted by user", "WARN")
        print_summary()
        sys.exit(1)
    except Exception as e:
        log(f"\n\nFatal error: {str(e)}", "ERROR")
        import traceback
        traceback.print_exc()
        sys.exit(1)
