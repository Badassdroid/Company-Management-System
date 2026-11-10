import os
from functools import wraps
from datetime import date
from flask import Flask, jsonify, request, g, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
from supabase import create_client, Client

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY")
SUPABASE_PUBLIC_KEY = os.getenv("SUPABASE_ANON_KEY") or os.getenv("SUPABASE_PUBLISHABLE_KEY")
FRONTEND_URL = os.getenv("FRONTEND_URL", "").rstrip("/")

if not SUPABASE_URL:
    raise RuntimeError("SUPABASE_URL is missing from .env")
if not SUPABASE_SECRET_KEY:
    raise RuntimeError("SUPABASE_SECRET_KEY is missing from .env")
if not SUPABASE_PUBLIC_KEY:
    raise RuntimeError("Set SUPABASE_ANON_KEY or SUPABASE_PUBLISHABLE_KEY in .env")

# Privileged client is used only on the server. Never expose its key to React.
db: Client = create_client(SUPABASE_URL, SUPABASE_SECRET_KEY)
auth_client: Client = create_client(SUPABASE_URL, SUPABASE_PUBLIC_KEY)

app = Flask(__name__)
app.config["JSON_SORT_KEYS"] = False
FRONTEND_DIST = os.path.join(BASE_DIR, "frontend", "dist")
allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://0.0.0.0:5173,https://*.app.github.dev",
    ).split(",")
    if origin.strip()
]
CORS(
    app,
    resources={r"/api/*": {"origins": allowed_origins}},
    supports_credentials=True,
)


def ok(data=None, message=None, status=200):
    body = {"success": True}
    if message:
        body["message"] = message
    if data is not None:
        body["data"] = data
    return jsonify(body), status


def fail(message, status=400):
    return jsonify({"success": False, "message": message}), status


def get_json():
    return request.get_json(silent=True) or {}


def require_auth(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        header = request.headers.get("Authorization", "")
        if not header.startswith("Bearer "):
            return fail("Authentication token is required.", 401)
        token = header.split(" ", 1)[1].strip()
        if not token:
            return fail("Authentication token is required.", 401)
        try:
            # Validate the user's Supabase access token with Supabase Auth.
            auth_result = auth_client.auth.get_user(token)
            user = getattr(auth_result, "user", None)
            if not user:
                return fail("Invalid or expired token.", 401)

            profile_result = (
                db.table("user_profiles")
                .select("user_id, employee_id, role, is_active")
                .eq("user_id", user.id)
                .maybe_single()
                .execute()
            )
            profile = getattr(profile_result, "data", None)
            if not profile or not profile.get("is_active"):
                return fail("Your account is inactive or has no employee profile.", 403)

            g.user = user
            g.profile = profile
            g.employee_id = profile.get("employee_id")
            g.role = profile.get("role")
        except Exception:
            app.logger.exception("Authentication failed")
            return fail("Could not authenticate this request.", 401)
        return fn(*args, **kwargs)
    return wrapper


def management_only(fn):
    @wraps(fn)
    @require_auth
    def wrapper(*args, **kwargs):
        if g.role != "management":
            return fail("Management access is required.", 403)
        return fn(*args, **kwargs)
    return wrapper


def employee_or_management_access(employee_id):
    return g.role == "management" or str(g.employee_id) == str(employee_id)


def supabase_error(message="Database operation failed.", status=500):
    app.logger.exception(message)
    return fail(message, status)


def auth_user_by_email(email):
    page = 1
    while True:
        response = db.auth.admin.list_users(page=page, per_page=1000)
        users = getattr(response, "users", response)
        for user in users:
            if (getattr(user, "email", "") or "").strip().lower() == email:
                return user
        if len(users) < 1000:
            return None
        page += 1


def provision_employee_account(employee):
    email = (employee.get("email") or "").strip().lower()
    if not email:
        raise ValueError("Add an email address to the employee record before creating a login.")
    if employee.get("employment_status") != "active":
        raise ValueError("Only active employees can be invited to sign in.")

    existing_link = (
        db.table("user_profiles")
        .select("user_id, role")
        .eq("employee_id", employee["id"])
        .maybe_single()
        .execute()
    )
    if existing_link.data:
        if existing_link.data.get("role") != "employee":
            raise ValueError("This employee is linked to a non-employee Supabase account.")
        db.table("user_profiles").update({
            "is_active": True,
        }).eq("user_id", existing_link.data["user_id"]).execute()
        return {"linked": True, "invited": False}

    user = auth_user_by_email(email)
    invited = False
    if not user:
        if not FRONTEND_URL:
            raise RuntimeError("Set FRONTEND_URL on the API service before sending account invitations.")
        response = db.auth.admin.invite_user_by_email(
            email,
            options={
                "data": {
                    "first_name": employee.get("first_name"),
                    "last_name": employee.get("last_name"),
                },
                "redirect_to": f"{FRONTEND_URL}/set-password",
            },
        )
        user = getattr(response, "user", None)
        invited = True

    user_id = getattr(user, "id", None)
    if not user_id:
        raise RuntimeError("Supabase did not return a user ID for this account.")

    existing_profile = (
        db.table("user_profiles")
        .select("user_id, employee_id, role")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    profile = existing_profile.data
    if profile:
        if profile.get("role") != "employee":
            raise ValueError("This Supabase account already has a non-employee role.")
        if profile.get("employee_id") not in (None, employee["id"]):
            raise ValueError("This Supabase account is already linked to another employee.")
        db.table("user_profiles").update({
            "employee_id": employee["id"],
            "is_active": True,
        }).eq("user_id", user_id).execute()
    else:
        db.table("user_profiles").insert({
            "user_id": user_id,
            "employee_id": employee["id"],
            "role": "employee",
            "is_active": True,
        }).execute()

    return {"linked": True, "invited": invited}


def set_employee_account_active(employee_id, is_active):
    db.table("user_profiles").update({
        "is_active": is_active,
    }).eq("employee_id", employee_id).execute()


@app.errorhandler(404)
def not_found(_error):
    return fail("API endpoint not found.", 404)


@app.errorhandler(405)
def method_not_allowed(_error):
    return fail("HTTP method not allowed.", 405)


@app.get("/")
def index():
    frontend_index = os.path.join(FRONTEND_DIST, "index.html")
    if os.path.isfile(frontend_index):
        return send_from_directory(FRONTEND_DIST, "index.html")
    return jsonify({
        "message": "Company Management System API",
        "status": "running",
        "version": "1.0.0"
    })


@app.get("/api/config")
def frontend_config():
    return ok({
        "supabase_url": SUPABASE_URL,
        "supabase_public_key": SUPABASE_PUBLIC_KEY,
    })


@app.get("/api/health")
def health():
    return jsonify({"success": True, "status": "ok"})


@app.get("/<path:frontend_path>")
def frontend_route(frontend_path):
    if frontend_path.startswith("api/"):
        return fail("API endpoint not found.", 404)

    file_path = os.path.join(FRONTEND_DIST, frontend_path)
    if os.path.isfile(file_path):
        return send_from_directory(FRONTEND_DIST, frontend_path)

    frontend_index = os.path.join(FRONTEND_DIST, "index.html")
    if os.path.isfile(frontend_index):
        return send_from_directory(FRONTEND_DIST, "index.html")
    return fail("Page not found.", 404)


# ---------------------------------------------------------------------------
# DASHBOARD
# ---------------------------------------------------------------------------

@app.get("/api/me")
@require_auth
def current_profile():
    try:
        employee = None
        if g.employee_id:
            result = db.table("employees").select(
                "id, employee_number, first_name, last_name, email, department, job_title, employment_status"
            ).eq("id", g.employee_id).maybe_single().execute()
            employee = getattr(result, "data", None)

        return ok({
            "user_id": g.user.id,
            "role": g.role,
            "employee_id": g.employee_id,
            "employee": employee,
        })
    except Exception:
        return supabase_error("Could not retrieve your account profile.")


@app.get("/api/dashboard")
@management_only
def dashboard():
    try:
        employees = db.table("employees").select("id", count="exact").eq(
            "employment_status", "active"
        ).execute()
        assets = db.table("assets").select("id", count="exact").execute()
        vehicles = db.table("vehicles").select("id", count="exact").eq(
            "status", "assigned"
        ).execute()
        requests_pending = db.table("requests").select(
            "id", count="exact"
        ).eq("status", "pending").execute()

        recent_requests = db.table("requests").select(
            "id, employee_id, request_type, description, submitted_at, employee:employees!requests_employee_id_fkey(first_name,last_name)"
        ).order("submitted_at", desc=True).limit(8).execute()
        recent_asset_assignments = db.table("asset_assignments").select(
            "id, employee_id, asset_id, assigned_at, returned_at, status, asset:assets(asset_code,name), employee:employees(first_name,last_name)"
        ).order("assigned_at", desc=True).limit(8).execute()
        recent_vehicle_assignments = db.table("vehicle_assignments").select(
            "id, employee_id, vehicle_id, checked_out_at, checked_in_at, status, vehicle:vehicles(registration_number,make,model), employee:employees(first_name,last_name)"
        ).order("checked_out_at", desc=True).limit(8).execute()
        recent_inventory_transactions = db.table("inventory_transactions").select(
            "id, employee_id, item_id, movement_type, quantity, occurred_at, item:inventory_items(name,unit), employee:employees(first_name,last_name)"
        ).order("occurred_at", desc=True).limit(8).execute()

        recent_activity = []

        def employee_name(row):
            employee = row.get("employee") or {}
            name = " ".join(filter(None, [employee.get("first_name"), employee.get("last_name")]))
            return name or "Employee"

        for row in recent_requests.data or []:
            recent_activity.append({
                "id": f"request-{row['id']}",
                "type": "Request submitted",
                "detail": row.get("description") or row.get("request_type", "Request"),
                "employee": employee_name(row),
                "occurred_at": row.get("submitted_at"),
            })

        for row in recent_asset_assignments.data or []:
            asset = row.get("asset") or {}
            returned = row.get("status") == "returned"
            recent_activity.append({
                "id": f"asset-{row['id']}",
                "type": "Asset returned" if returned else "Asset assigned",
                "detail": " · ".join(filter(None, [asset.get("asset_code"), asset.get("name")])) or row.get("asset_id"),
                "employee": employee_name(row),
                "occurred_at": row.get("returned_at") if returned else row.get("assigned_at"),
            })

        for row in recent_vehicle_assignments.data or []:
            vehicle = row.get("vehicle") or {}
            returned = row.get("status") == "returned"
            recent_activity.append({
                "id": f"vehicle-{row['id']}",
                "type": "Vehicle returned" if returned else "Vehicle checked out",
                "detail": " · ".join(filter(None, [vehicle.get("registration_number"), vehicle.get("make"), vehicle.get("model")])) or row.get("vehicle_id"),
                "employee": employee_name(row),
                "occurred_at": row.get("checked_in_at") if returned else row.get("checked_out_at"),
            })

        for row in recent_inventory_transactions.data or []:
            item = row.get("item") or {}
            recent_activity.append({
                "id": f"inventory-{row['id']}",
                "type": "Stock movement",
                "detail": f"{row.get('movement_type', 'updated').replace('_', ' ').title()} · {row.get('quantity')} {item.get('unit') or ''} {item.get('name') or ''}".strip(),
                "employee": employee_name(row) if row.get("employee_id") else "Management",
                "occurred_at": row.get("occurred_at"),
            })

        recent_activity.sort(key=lambda event: event.get("occurred_at") or "", reverse=True)

        low_stock = db.table("inventory_stock").select("*").execute()
        low_stock_items = [
            item for item in (low_stock.data or [])
            if float(item.get("quantity_on_hand") or 0) <= float(item.get("reorder_level") or 0)
        ]

        return ok({
            "total_assets": assets.count or 0,
            "active_employees": employees.count or 0,
            "vehicles_in_use": vehicles.count or 0,
            "open_requests": requests_pending.count or 0,
            "recent_activity": recent_activity[:8],
            "low_stock_items": low_stock_items
        })
    except Exception:
        return supabase_error("Could not load dashboard data.")


# ---------------------------------------------------------------------------
# EMPLOYEES
# ---------------------------------------------------------------------------

@app.get("/api/employees")
@management_only
def list_employees():
    try:
        result = db.table("employees").select("*").order("created_at", desc=True).execute()
        profiles = db.table("user_profiles").select("employee_id").execute()
        linked_employee_ids = {
            profile["employee_id"]
            for profile in (profiles.data or [])
            if profile.get("employee_id")
        }
        employees = [
            {**employee, "has_account": employee["id"] in linked_employee_ids}
            for employee in (result.data or [])
        ]
        return ok(employees)
    except Exception:
        return supabase_error("Could not retrieve employees.")


@app.get("/api/employees/<employee_id>")
@require_auth
def get_employee(employee_id):
    if not employee_or_management_access(employee_id):
        return fail("You can only view your own employee record.", 403)
    try:
        result = db.table("employees").select("*").eq("id", employee_id).maybe_single().execute()
        if not result.data:
            return fail("Employee not found.", 404)
        return ok(result.data)
    except Exception:
        return supabase_error("Could not retrieve employee.")


@app.post("/api/employees")
@management_only
def create_employee():
    data = get_json()
    required = ["employee_number", "first_name", "last_name"]
    missing = [field for field in required if not data.get(field)]
    if missing:
        return fail("Required fields: " + ", ".join(missing))
    allowed = [
        "employee_number", "first_name", "last_name", "email", "phone",
        "department", "job_title", "employment_status", "start_date", "end_date"
    ]
    payload = {key: data[key] for key in allowed if key in data}
    if "email" in payload and payload["email"] is not None:
        if not isinstance(payload["email"], str):
            return fail("Email address must be text.")
        payload["email"] = payload["email"].strip().lower() or None
    try:
        result = db.table("employees").insert(payload).execute()
        return ok(result.data[0] if result.data else None, "Employee created.", 201)
    except Exception:
        return supabase_error("Could not create employee. Check unique employee number/email.")


@app.post("/api/employees/<employee_id>/account")
@management_only
def create_employee_account(employee_id):
    try:
        result = db.table("employees").select("*").eq("id", employee_id).maybe_single().execute()
        if not result.data:
            return fail("Employee not found.", 404)
        account = provision_employee_account(result.data)
        return ok(account, "Employee account is linked.")
    except ValueError as error:
        return fail(str(error), 400)
    except Exception:
        app.logger.exception("Could not provision employee account.")
        return fail(
            "Could not create or link the employee account. Check Supabase Auth email settings and the invitation redirect URL.",
            502,
        )


@app.patch("/api/employees/<employee_id>")
@management_only
def update_employee(employee_id):
    allowed = [
        "employee_number", "first_name", "last_name", "email", "phone",
        "department", "job_title", "employment_status", "start_date", "end_date"
    ]
    payload = {key: value for key, value in get_json().items() if key in allowed}
    if not payload:
        return fail("No editable employee fields were supplied.")
    try:
        result = db.table("employees").update(payload).eq("id", employee_id).execute()
        if not result.data:
            return fail("Employee not found.", 404)
        if "employment_status" in payload:
            set_employee_account_active(
                employee_id,
                payload["employment_status"] == "active",
            )
        return ok(result.data[0], "Employee updated.")
    except Exception:
        return supabase_error("Could not update employee.")


@app.delete("/api/employees/<employee_id>")
@management_only
def deactivate_employee(employee_id):
    # Keep historical assignments and transactions; deactivate instead of deleting.
    try:
        result = db.table("employees").update({
            "employment_status": "inactive",
            "end_date": date.today().isoformat()
        }).eq("id", employee_id).execute()
        if not result.data:
            return fail("Employee not found.", 404)
        set_employee_account_active(employee_id, False)
        return ok(result.data[0], "Employee deactivated.")
    except Exception:
        return supabase_error("Could not deactivate employee.")


# ---------------------------------------------------------------------------
# ASSETS AND ASSIGNMENTS
# ---------------------------------------------------------------------------

@app.get("/api/assets")
@require_auth
def list_assets():
    try:
        query = db.table("assets").select("*")
        if g.role != "management":
            assigned = db.table("asset_assignments").select("asset_id").eq(
                "employee_id", g.employee_id
            ).eq("status", "active").execute()
            ids = [row["asset_id"] for row in (assigned.data or [])]
            if not ids:
                return ok([])
            query = query.in_("id", ids)
        result = query.order("created_at", desc=True).execute()
        return ok(result.data or [])
    except Exception:
        return supabase_error("Could not retrieve assets.")


@app.post("/api/assets")
@management_only
def create_asset():
    allowed = [
        "asset_code", "name", "category", "serial_number", "description",
        "brand", "model", "purchase_date", "purchase_cost", "condition", "status"
    ]
    payload = {k: v for k, v in get_json().items() if k in allowed}
    if not all(payload.get(k) for k in ["asset_code", "name", "category"]):
        return fail("asset_code, name and category are required.")
    try:
        result = db.table("assets").insert(payload).execute()
        return ok(result.data[0] if result.data else None, "Asset created.", 201)
    except Exception:
        return supabase_error("Could not create asset.")


@app.patch("/api/assets/<asset_id>")
@management_only
def update_asset(asset_id):
    allowed = [
        "asset_code", "name", "category", "serial_number", "description",
        "brand", "model", "purchase_date", "purchase_cost", "condition", "status"
    ]
    payload = {k: v for k, v in get_json().items() if k in allowed}
    if not payload:
        return fail("No editable asset fields were supplied.")
    try:
        result = db.table("assets").update(payload).eq("id", asset_id).execute()
        if not result.data:
            return fail("Asset not found.", 404)
        return ok(result.data[0], "Asset updated.")
    except Exception:
        return supabase_error("Could not update asset.")


@app.get("/api/asset-assignments")
@require_auth
def list_asset_assignments():
    try:
        query = db.table("asset_assignments").select("*")
        employee_id = request.args.get("employee_id")
        if g.role == "management" and employee_id:
            query = query.eq("employee_id", employee_id)
        elif g.role != "management":
            query = query.eq("employee_id", g.employee_id)
        result = query.order("assigned_at", desc=True).execute()
        return ok(result.data or [])
    except Exception:
        return supabase_error("Could not retrieve asset assignments.")


@app.post("/api/asset-assignments")
@management_only
def assign_asset():
    data = get_json()
    if not data.get("asset_id") or not data.get("employee_id"):
        return fail("asset_id and employee_id are required.")
    payload = {
        "asset_id": data["asset_id"],
        "employee_id": data["employee_id"],
        "assigned_by": g.user.id,
        "condition_out": data.get("condition_out"),
        "notes": data.get("notes"),
        "status": "active"
    }
    try:
        db.table("assets").update({"status": "assigned"}).eq("id", data["asset_id"]).execute()
        result = db.table("asset_assignments").insert(payload).execute()
        return ok(result.data[0] if result.data else None, "Asset assigned.", 201)
    except Exception:
        return supabase_error("Could not assign asset. Check that it is available.")


@app.post("/api/asset-assignments/<assignment_id>/return")
@management_only
def return_asset(assignment_id):
    data = get_json()
    try:
        assignment = db.table("asset_assignments").select(
            "asset_id"
        ).eq("id", assignment_id).eq("status", "active").maybe_single().execute()
        if not assignment.data:
            return fail("Active assignment not found.", 404)
        db.table("asset_assignments").update({
            "status": "returned",
            "returned_at": date.today().isoformat(),
            "returned_to": g.user.id,
            "condition_in": data.get("condition_in"),
            "notes": data.get("notes")
        }).eq("id", assignment_id).execute()
        db.table("assets").update({"status": "available"}).eq(
            "id", assignment.data["asset_id"]
        ).execute()
        return ok(message="Asset returned.")
    except Exception:
        return supabase_error("Could not return asset.")


# ---------------------------------------------------------------------------
# VEHICLES AND ASSIGNMENTS
# ---------------------------------------------------------------------------

@app.get("/api/vehicles")
@require_auth
def list_vehicles():
    try:
        query = db.table("vehicles").select("*")
        if g.role != "management":
            assigned = db.table("vehicle_assignments").select("vehicle_id").eq(
                "employee_id", g.employee_id
            ).eq("status", "active").execute()
            ids = [row["vehicle_id"] for row in (assigned.data or [])]
            if not ids:
                return ok([])
            query = query.in_("id", ids)
        result = query.order("created_at", desc=True).execute()
        return ok(result.data or [])
    except Exception:
        return supabase_error("Could not retrieve vehicles.")


@app.post("/api/vehicles")
@management_only
def create_vehicle():
    allowed = [
        "registration_number", "make", "model", "year", "vin", "fuel_type",
        "tank_capacity_litres", "status", "current_odometer_km"
    ]
    payload = {k: v for k, v in get_json().items() if k in allowed}
    if not all(payload.get(k) for k in ["registration_number", "make", "model", "fuel_type"]):
        return fail("registration_number, make, model and fuel_type are required.")
    try:
        result = db.table("vehicles").insert(payload).execute()
        return ok(result.data[0] if result.data else None, "Vehicle created.", 201)
    except Exception:
        return supabase_error("Could not create vehicle.")


@app.patch("/api/vehicles/<vehicle_id>")
@management_only
def update_vehicle(vehicle_id):
    allowed = [
        "registration_number", "make", "model", "year", "vin", "fuel_type",
        "tank_capacity_litres", "status", "current_odometer_km"
    ]
    payload = {k: v for k, v in get_json().items() if k in allowed}
    if not payload:
        return fail("No editable vehicle fields were supplied.")
    try:
        result = db.table("vehicles").update(payload).eq("id", vehicle_id).execute()
        if not result.data:
            return fail("Vehicle not found.", 404)
        return ok(result.data[0], "Vehicle updated.")
    except Exception:
        return supabase_error("Could not update vehicle.")


@app.get("/api/vehicle-assignments")
@require_auth
def list_vehicle_assignments():
    try:
        query = db.table("vehicle_assignments").select("*")
        employee_id = request.args.get("employee_id")
        if g.role == "management" and employee_id:
            query = query.eq("employee_id", employee_id)
        elif g.role != "management":
            query = query.eq("employee_id", g.employee_id)
        result = query.order("checked_out_at", desc=True).execute()
        return ok(result.data or [])
    except Exception:
        return supabase_error("Could not retrieve vehicle assignments.")


@app.post("/api/vehicle-assignments")
@management_only
def assign_vehicle():
    data = get_json()
    required = ["vehicle_id", "employee_id", "assignment_type", "odometer_out_km"]
    if any(data.get(k) is None for k in required):
        return fail("vehicle_id, employee_id, assignment_type and odometer_out_km are required.")
    payload = {
        **{k: data[k] for k in required},
        "purpose": data.get("purpose"),
        "assigned_by": g.user.id,
        "expected_return_at": data.get("expected_return_at"),
        "fuel_gauge_out_percent": data.get("fuel_gauge_out_percent"),
        "condition_out": data.get("condition_out"),
        "notes": data.get("notes"),
        "status": "active"
    }
    try:
        db.table("vehicles").update({"status": "assigned"}).eq("id", data["vehicle_id"]).execute()
        result = db.table("vehicle_assignments").insert(payload).execute()
        return ok(result.data[0] if result.data else None, "Vehicle assigned.", 201)
    except Exception:
        return supabase_error("Could not assign vehicle.")


@app.post("/api/vehicle-assignments/<assignment_id>/return")
@require_auth
def return_vehicle(assignment_id):
    data = get_json()
    try:
        assignment = db.table("vehicle_assignments").select(
            "vehicle_id, employee_id, odometer_out_km"
        ).eq("id", assignment_id).eq("status", "active").maybe_single().execute()
        if not assignment.data:
            return fail("Active vehicle assignment not found.", 404)
        if g.role != "management" and assignment.data["employee_id"] != g.employee_id:
            return fail("You can only return a vehicle assigned to you.", 403)

        try:
            odometer_in = float(data.get("odometer_in_km"))
        except (TypeError, ValueError):
            return fail("A valid odometer_in_km is required.")
        if odometer_in < float(assignment.data["odometer_out_km"]):
            return fail("A valid odometer_in_km is required.")

        fuel_gauge_in = data.get("fuel_gauge_in_percent")
        if fuel_gauge_in is not None:
            try:
                fuel_gauge_in = int(fuel_gauge_in)
            except (TypeError, ValueError):
                return fail("fuel_gauge_in_percent must be a whole number from 0 to 100.")
            if fuel_gauge_in < 0 or fuel_gauge_in > 100:
                return fail("fuel_gauge_in_percent must be a whole number from 0 to 100.")

        db.table("vehicle_assignments").update({
            "status": "returned",
            "checked_in_at": date.today().isoformat(),
            "odometer_in_km": odometer_in,
            "fuel_gauge_in_percent": fuel_gauge_in,
            "condition_in": data.get("condition_in"),
            "notes": data.get("notes")
        }).eq("id", assignment_id).execute()
        db.table("vehicles").update({
            "status": "available",
            "current_odometer_km": odometer_in
        }).eq("id", assignment.data["vehicle_id"]).execute()
        return ok(message="Vehicle returned.")
    except Exception:
        return supabase_error("Could not return vehicle.")


# ---------------------------------------------------------------------------
# INVENTORY
# ---------------------------------------------------------------------------

@app.get("/api/inventory")
@require_auth
def list_inventory():
    try:
        result = db.table("inventory_stock").select("*").execute()
        return ok(result.data or [])
    except Exception:
        return supabase_error("Could not retrieve inventory stock.")


@app.post("/api/inventory/items")
@management_only
def create_inventory_item():
    allowed = ["item_code", "name", "category", "unit", "reorder_level", "is_active"]
    payload = {k: v for k, v in get_json().items() if k in allowed}
    if not all(payload.get(k) for k in ["item_code", "name", "category"]):
        return fail("item_code, name and category are required.")
    try:
        result = db.table("inventory_items").insert(payload).execute()
        return ok(result.data[0] if result.data else None, "Inventory item created.", 201)
    except Exception:
        return supabase_error("Could not create inventory item.")


@app.post("/api/inventory/transactions")
@management_only
def create_inventory_transaction():
    data = get_json()
    required = ["item_id", "movement_type", "quantity"]
    if any(data.get(k) is None for k in required):
        return fail("item_id, movement_type and quantity are required.")
    try:
        payload = {
            "item_id": data["item_id"],
            "movement_type": data["movement_type"],
            "quantity": data["quantity"],
            "unit_cost": data.get("unit_cost"),
            "employee_id": data.get("employee_id"),
            "reference": data.get("reference"),
            "reason": data.get("reason"),
            "recorded_by": g.user.id
        }
        result = db.table("inventory_transactions").insert(payload).execute()
        return ok(result.data[0] if result.data else None, "Stock movement recorded.", 201)
    except Exception:
        return supabase_error("Could not record stock movement.")


@app.get("/api/inventory/transactions")
@require_auth
def list_inventory_transactions():
    try:
        query = db.table("inventory_transactions").select("*")
        if g.role != "management":
            query = query.eq("employee_id", g.employee_id)
        result = query.order("occurred_at", desc=True).execute()
        return ok(result.data or [])
    except Exception:
        return supabase_error("Could not retrieve stock transactions.")


# ---------------------------------------------------------------------------
# REQUESTS: HOLIDAY, ASSET, INVENTORY AND VEHICLE
# ---------------------------------------------------------------------------

ALLOWED_REQUEST_TYPES = {"holiday", "asset", "inventory", "vehicle"}


@app.get("/api/requests")
@require_auth
def list_requests():
    try:
        query = db.table("requests").select("*")
        employee_id = request.args.get("employee_id")
        if g.role == "management" and employee_id:
            query = query.eq("employee_id", employee_id)
        elif g.role != "management":
            query = query.eq("employee_id", g.employee_id)
        status = request.args.get("status")
        request_type = request.args.get("type")
        if status:
            query = query.eq("status", status)
        if request_type:
            if request_type not in ALLOWED_REQUEST_TYPES:
                return fail("Invalid request type.")
            query = query.eq("request_type", request_type)
        result = query.order("submitted_at", desc=True).execute()
        return ok(result.data or [])
    except Exception:
        return supabase_error("Could not retrieve requests.")


@app.get("/api/fuel-allocations")
@require_auth
def list_fuel_allocations():
    try:
        query = db.table("fuel_allocations").select("*")
        employee_id = request.args.get("employee_id")
        if g.role == "management" and employee_id:
            query = query.eq("employee_id", employee_id)
        elif g.role != "management":
            query = query.eq("employee_id", g.employee_id)
        result = query.order("allocation_period_start", desc=True).execute()
        return ok(result.data or [])
    except Exception:
        return supabase_error("Could not retrieve fuel allocations.")


@app.post("/api/requests")
@require_auth
def submit_request():
    data = get_json()
    request_type = data.get("request_type")
    description = data.get("description", "").strip()
    if request_type not in ALLOWED_REQUEST_TYPES:
        return fail("request_type must be holiday, asset, inventory or vehicle.")
    if not description:
        return fail("A request description is required.")

    # Employees cannot submit requests on behalf of another employee.
    employee_id = g.employee_id
    if g.role == "management" and data.get("employee_id"):
        employee_id = data["employee_id"]
    if not employee_id:
        return fail("Your account is not linked to an employee record.", 403)

    payload = {
        "employee_id": employee_id,
        "request_type": request_type,
        "description": description,
        "status": "pending"
    }

    if request_type == "holiday":
        start_date = data.get("start_date")
        end_date = data.get("end_date")
        if not start_date or not end_date:
            return fail("Holiday requests require start_date and end_date.")
        try:
            if date.fromisoformat(start_date) > date.fromisoformat(end_date):
                return fail("end_date cannot be before start_date.")
        except ValueError:
            return fail("Dates must use YYYY-MM-DD format.")
        payload.update({"start_date": start_date, "end_date": end_date})
    elif data.get("quantity") is not None:
        try:
            quantity = float(data["quantity"])
            if quantity <= 0:
                return fail("quantity must be greater than zero.")
        except (TypeError, ValueError):
            return fail("quantity must be a valid positive number.")
        payload["quantity"] = quantity

    try:
        result = db.table("requests").insert(payload).execute()
        return ok(result.data[0] if result.data else None, "Request submitted.", 201)
    except Exception:
        return supabase_error("Could not submit request.")


@app.patch("/api/requests/<request_id>/review")
@management_only
def review_request(request_id):
    data = get_json()
    status = data.get("status")
    if status not in {"approved", "rejected"}:
        return fail("status must be approved or rejected.")
    try:
        result = db.rpc("review_request", {
            "p_request_id": request_id,
            "p_status": status,
            "p_reviewed_by": g.employee_id,
            "p_review_notes": data.get("review_notes", "")
        }).execute()
        return ok(result.data, f"Request {status}.")
    except Exception:
        return supabase_error("Could not review request. Check its status and leave balance.", 400)


# ---------------------------------------------------------------------------
# HOLIDAY BALANCES
# ---------------------------------------------------------------------------

@app.get("/api/leave-balance")
@require_auth
def my_leave_balance():
    employee_id = request.args.get("employee_id") if g.role == "management" else g.employee_id
    if not employee_id:
        return fail("Employee account is not linked to an employee record.", 403)
    try:
        result = db.table("leave_balances").select("*").eq(
            "employee_id", employee_id
        ).maybe_single().execute()
        if not result.data:
            return fail("No leave balance has been configured for this employee.", 404)
        row = result.data
        return ok({
            **row,
            "days_remaining": float(row["annual_entitlement"]) - float(row["days_taken"])
        })
    except Exception:
        return supabase_error("Could not retrieve leave balance.")


@app.post("/api/leave-balances")
@management_only
def create_or_set_leave_balance():
    data = get_json()
    employee_id = data.get("employee_id")
    entitlement = data.get("annual_entitlement")
    if not employee_id or entitlement is None:
        return fail("employee_id and annual_entitlement are required.")
    try:
        entitlement = float(entitlement)
        if entitlement < 0:
            return fail("annual_entitlement cannot be negative.")
        existing = db.table("leave_balances").select("id").eq(
            "employee_id", employee_id
        ).maybe_single().execute()
        payload = {"annual_entitlement": entitlement}
        if existing.data:
            result = db.table("leave_balances").update(payload).eq(
                "employee_id", employee_id
            ).execute()
        else:
            result = db.table("leave_balances").insert({
                "employee_id": employee_id,
                "annual_entitlement": entitlement,
                "days_taken": 0
            }).execute()
        return ok(result.data[0] if result.data else None, "Leave balance saved.")
    except Exception:
        return supabase_error("Could not save leave balance.")


# ---------------------------------------------------------------------------
# RUN
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.getenv("PORT", "5001")),
        debug=os.getenv("FLASK_DEBUG", "0") == "1"
    )
