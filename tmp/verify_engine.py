import urllib.request
import json
import time

BASE_URL = "http://127.0.0.1:8000/api/v1"
USER_ID = "test_user_ai_verification"

def api_post(path, data):
    url = f"{BASE_URL}{path}"
    req = urllib.request.Request(url, data=json.dumps(data).encode(), headers={'Content-Type': 'application/json'}, method='POST')
    with urllib.request.urlopen(req) as response:
        return json.loads(response.read().decode())

def api_get(path):
    url = f"{BASE_URL}{path}"
    with urllib.request.urlopen(url) as response:
        return json.loads(response.read().decode())

def test_ambiguous_meal():
    print("\n--- Test 1: Ambiguous Meal ('1 tabak pilav') ---")
    data = api_post("/nutrition/parse", {"text": "1 tabak pilav", "user_id": USER_ID})
    
    needs_clarify = data.get('needs_clarification')
    print(f"needs_clarification: {needs_clarify}")
    
    questions = data.get("clarification_questions", [])
    if needs_clarify and len(questions) > 0:
        print("SUCCESS: Backend triggered clarification.")
        q = questions[0]
        print(f"Question: {q.get('question')[:50]}...")
        choices = q.get("choices", [])
        labels = [c.get("label") for c in choices]
        print(f"Choices: {labels}")
    else:
        print("FAILED: Clarification not triggered.")

def test_resolved_meal():
    print("\n--- Test 2: Resolved Meal ('1 tabak pilav (büyük)') ---")
    data = api_post("/nutrition/parse", {"text": "1 tabak pilav (büyük)", "user_id": USER_ID})
    print(f"needs_clarification: {data.get('needs_clarification')}")
    
    items = data.get("parsed_items", [])
    if items:
        weight = items[0].get("estimated_weight_g")
        print(f"Estimated Weight: {weight}g")
        if weight >= 250:
            print("SUCCESS: Large portion resulted in higher gram estimate.")
    else:
        print("FAILED: No items parsed.")

def test_goal_engine():
    print("\n--- Test 3: Goal Engine Recalculation ---")
    profile = {
        "user_id": USER_ID, "weight_kg": 80.0, "height_cm": 180.0, "age": 30,
        "gender": "male", "activity_level": "moderate", "training_frequency_per_week": 3,
        "goal": "maintenance"
    }
    api_post("/user/profile", profile)
    
    maint_goals = api_get(f"/user/goals?user_id={USER_ID}")["goals"]
    maint_cal = maint_goals["calorie_target_kcal"]
    print(f"Maintenance: {maint_cal} kcal")
    
    profile["goal"] = "fat_loss"
    api_post("/user/profile", profile)
    
    lost_goals = api_get(f"/user/goals?user_id={USER_ID}")["goals"]
    lost_cal = lost_goals["calorie_target_kcal"]
    print(f"Fat Loss: {lost_cal} kcal")
    
    if lost_cal < maint_cal:
        print("SUCCESS: Goals recalculated correctly.")

if __name__ == "__main__":
    try:
        test_ambiguous_meal()
        test_resolved_meal()
        test_goal_engine()
    except Exception as e:
        print(f"ERROR: {e}")
