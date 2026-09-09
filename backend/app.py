"""
LibraryOS API -- Library Management and Usage Analytics
Pure JSON backend. The static frontend (deployed separately, e.g. on
Vercel) talks to this over HTTP. Database connection is entirely
environment-driven so the same code runs locally and in production.
"""
import os
import jwt
import bcrypt
import psycopg2
import psycopg2.extras
from datetime import date, datetime, timedelta
from decimal import Decimal
from functools import wraps
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
allowed_origins = os.environ.get("CORS_ALLOWED_ORIGINS", "*")
CORS(app, origins=allowed_origins.split(",") if allowed_origins != "*" else "*")

JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret-change-me")
JWT_EXPIRY_HOURS = int(os.environ.get("JWT_EXPIRY_HOURS", "24"))

DB_URL = os.environ.get("DB_URL")
DB_CONFIG = dict(
    host=os.environ.get("DB_HOST", "localhost"),
    port=os.environ.get("DB_PORT", "5432"),
    dbname=os.environ.get("DB_NAME", "mindcare"),
    user=os.environ.get("DB_USER", "mindcare"),
    password=os.environ.get("DB_PASSWORD", "mindcare_dev_password"),
    sslmode=os.environ.get("DB_SSLMODE", "prefer"),
)
DB_SCHEMA = os.environ.get("DB_SCHEMA", "library")


def get_conn():
    conn = psycopg2.connect(DB_URL) if DB_URL else psycopg2.connect(**DB_CONFIG)
    conn.cursor().execute(f"SET search_path TO {DB_SCHEMA};")
    return conn


def rows_to_json(cur):
    cols = [d[0] for d in cur.description]
    out = []
    for row in cur.fetchall():
        d = {}
        for c, v in zip(cols, row):
            if isinstance(v, (date, datetime)):
                v = v.isoformat()
            elif isinstance(v, Decimal):
                v = float(v)
            d[c] = v
        out.append(d)
    return cols, out


# ============================================================ auth helpers
def issue_token(payload):
    payload = dict(payload)
    payload["exp"] = datetime.utcnow() + timedelta(hours=JWT_EXPIRY_HOURS)
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def decode_token(token):
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None


def auth_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        auth = request.headers.get("Authorization", "")
        token = auth[7:] if auth.startswith("Bearer ") else None
        payload = decode_token(token) if token else None
        if not payload:
            return jsonify({"error": "Authentication required"}), 401
        request.user = payload
        return f(*args, **kwargs)
    return wrapper


def management_required(f):
    @wraps(f)
    @auth_required
    def wrapper(*args, **kwargs):
        if request.user.get("account_type") != "staff":
            return jsonify({"error": "Management access required"}), 403
        return f(*args, **kwargs)
    return wrapper


# ============================================================ AUTH
@app.route("/api/auth/register", methods=["POST"])
def register():
    data = request.get_json(force=True)
    full_name = (data.get("fullName") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    membership_type = data.get("membershipType") or "Student"
    home_branch_id = data.get("homeBranchId")

    if not full_name or not email or len(password) < 8:
        return jsonify({"error": "Full name, a valid email, and a password of at least 8 characters are required."}), 400
    if membership_type not in ("Student", "Staff", "Public", "Senior"):
        membership_type = "Student"

    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT 1 FROM members WHERE email = %s", (email,))
    if cur.fetchone():
        conn.close()
        return jsonify({"error": "An account with that email already exists."}), 409

    if not home_branch_id:
        cur.execute("SELECT branch_id FROM branches ORDER BY branch_id LIMIT 1")
        home_branch_id = cur.fetchone()[0]

    pw_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    cur.execute("""
        INSERT INTO members (full_name, email, home_branch_id, membership_type, join_date, is_active, password_hash)
        VALUES (%s, %s, %s, %s, CURRENT_DATE, TRUE, %s)
        RETURNING member_id
    """, (full_name, email, home_branch_id, membership_type, pw_hash))
    member_id = cur.fetchone()[0]
    membership_number = f"LIB-{member_id:06d}"
    cur.execute("UPDATE members SET membership_number = %s WHERE member_id = %s", (membership_number, member_id))
    conn.commit()

    cur.execute("""
        SELECT m.member_id, m.full_name, m.email, m.membership_type, m.membership_number,
               m.join_date, br.branch_name
        FROM members m JOIN branches br ON br.branch_id = m.home_branch_id
        WHERE m.member_id = %s
    """, (member_id,))
    cols, rows = rows_to_json(cur)
    conn.close()

    token = issue_token({"account_type": "member", "member_id": member_id, "email": email})
    return jsonify({"token": token, "membership": rows[0]}), 201


@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json(force=True)
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    conn = get_conn()
    cur = conn.cursor()

    cur.execute("SELECT member_id, full_name, password_hash, is_active FROM members WHERE email = %s", (email,))
    row = cur.fetchone()
    if row and row[2] and bcrypt.checkpw(password.encode(), row[2].encode()):
        if not row[3]:
            conn.close()
            return jsonify({"error": "This account has been deactivated."}), 403
        member_id, full_name = row[0], row[1]
        conn.close()
        token = issue_token({"account_type": "member", "member_id": member_id, "email": email})
        return jsonify({"token": token, "accountType": "member", "fullName": full_name, "memberId": member_id})

    cur.execute("SELECT staff_id, full_name, role, password_hash, is_active FROM staff WHERE email = %s OR username = %s", (email, email))
    row = cur.fetchone()
    if row and row[3] and bcrypt.checkpw(password.encode(), row[3].encode()):
        if not row[4]:
            conn.close()
            return jsonify({"error": "This account has been deactivated."}), 403
        staff_id, full_name, role = row[0], row[1], row[2]
        conn.close()
        token = issue_token({"account_type": "staff", "staff_id": staff_id, "email": email, "role": role})
        return jsonify({"token": token, "accountType": "staff", "fullName": full_name, "role": role, "staffId": staff_id})

    conn.close()
    return jsonify({"error": "Incorrect email or password."}), 401


@app.route("/api/auth/me")
@auth_required
def me():
    u = request.user
    conn = get_conn()
    cur = conn.cursor()
    if u["account_type"] == "member":
        cur.execute("""
            SELECT m.member_id, m.full_name, m.email, m.membership_type, m.membership_number,
                   m.join_date, br.branch_name,
                   (SELECT COUNT(*) FROM loans l WHERE l.member_id = m.member_id AND l.status IN ('Borrowed','Overdue')) AS active_loans
            FROM members m JOIN branches br ON br.branch_id = m.home_branch_id
            WHERE m.member_id = %s
        """, (u["member_id"],))
        cols, rows = rows_to_json(cur)
        conn.close()
        return jsonify({"accountType": "member", **rows[0]})
    else:
        cur.execute("""
            SELECT s.staff_id, s.full_name, s.email, s.role, br.branch_name
            FROM staff s JOIN branches br ON br.branch_id = s.branch_id
            WHERE s.staff_id = %s
        """, (u["staff_id"],))
        cols, rows = rows_to_json(cur)
        conn.close()
        return jsonify({"accountType": "staff", **rows[0]})


STAFF_ROLES = ("Librarian", "Assistant Librarian", "Branch Manager", "IT Support")


@app.route("/api/auth/role", methods=["PATCH"])
@management_required
def switch_role():
    data = request.get_json(force=True)
    role = data.get("role")
    if role not in STAFF_ROLES:
        return jsonify({"error": f"Role must be one of: {', '.join(STAFF_ROLES)}"}), 400
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("UPDATE staff SET role = %s WHERE staff_id = %s", (role, request.user["staff_id"]))
    conn.commit()
    conn.close()
    return jsonify({"role": role})


@app.route("/api/branches")
def api_branches_public():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT branch_id, branch_name, city FROM branches ORDER BY branch_name")
    cols, rows = rows_to_json(cur)
    conn.close()
    return jsonify(rows)


# ============================================================ GROUP (password-gated academic project info)
@app.route("/api/group/members")
def group_members_public():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT full_name, role FROM group_members ORDER BY sort_order")
    cols, members = rows_to_json(cur)
    conn.close()
    return jsonify(members)


@app.route("/api/group/unlock", methods=["POST"])
def group_unlock():
    data = request.get_json(force=True)
    password = data.get("password") or ""
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT id, full_name, password_hash FROM group_admin LIMIT 1")
    row = cur.fetchone()
    if not row or not bcrypt.checkpw(password.encode(), row[2].encode()):
        conn.close()
        return jsonify({"error": "Incorrect password."}), 401

    cur.execute("SELECT full_name, student_id, role FROM group_members ORDER BY sort_order")
    cols, members = rows_to_json(cur)
    conn.close()
    token = issue_token({"account_type": "group_admin", "admin_name": row[1]})
    return jsonify({"token": token, "members": members})


def group_admin_required(f):
    @wraps(f)
    @auth_required
    def wrapper(*args, **kwargs):
        if request.user.get("account_type") != "group_admin":
            return jsonify({"error": "Group leader access required"}), 403
        return f(*args, **kwargs)
    return wrapper


@app.route("/api/group/members", methods=["POST"])
@group_admin_required
def add_group_member():
    data = request.get_json(force=True)
    full_name = (data.get("fullName") or "").strip()
    student_id = (data.get("studentId") or "").strip()
    role = (data.get("role") or "Member").strip() or "Member"

    if not full_name or not student_id:
        return jsonify({"error": "Full name and student ID are required."}), 400

    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT COALESCE(MAX(sort_order), 0) + 1 FROM group_members")
    next_sort = cur.fetchone()[0]
    cur.execute(
        "INSERT INTO group_members (full_name, student_id, role, sort_order) VALUES (%s, %s, %s, %s)",
        (full_name, student_id, role, next_sort),
    )
    conn.commit()

    cur.execute("SELECT full_name, student_id, role FROM group_members ORDER BY sort_order")
    cols, members = rows_to_json(cur)
    conn.close()
    return jsonify({"members": members}), 201


# ============================================================ dashboard stats (management only)
@app.route("/api/stats")
@management_required
def stats():
    conn = get_conn()
    cur = conn.cursor()
    out = {}
    cur.execute("SELECT COUNT(*) FROM books"); out["total_books"] = cur.fetchone()[0]
    cur.execute("SELECT COALESCE(SUM(total_copies),0) FROM books"); out["total_copies"] = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM members WHERE is_active"); out["active_members"] = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM loans"); out["total_loans"] = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM loans WHERE status = 'Borrowed'"); out["currently_borrowed"] = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM loans WHERE status = 'Overdue'"); out["overdue_now"] = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM branches"); out["branches"] = cur.fetchone()[0]
    cur.execute("SELECT COALESCE(SUM(amount),0) FROM fines WHERE status='Unpaid'"); out["fines_outstanding"] = float(cur.fetchone()[0])
    cur.execute("SELECT COALESCE(SUM(amount),0) FROM fines WHERE status='Paid'"); out["fines_collected"] = float(cur.fetchone()[0])
    cur.execute("""SELECT ROUND(100.0 * SUM(CASE WHEN status='Paid' THEN amount ELSE 0 END)
        / NULLIF(SUM(amount),0), 1) FROM fines""")
    r = cur.fetchone()[0]
    out["collection_rate_pct"] = float(r) if r is not None else 0
    conn.close()
    return jsonify(out)


# ============================================================ member self-service
@app.route("/api/my/loans")
@auth_required
def my_loans():
    if request.user["account_type"] != "member":
        return jsonify({"error": "Members only"}), 403
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        SELECT l.loan_id, b.title AS book, l.loan_date, l.due_date, l.return_date, l.status
        FROM loans l JOIN books b ON b.book_id = l.book_id
        WHERE l.member_id = %s ORDER BY l.loan_date DESC
    """, (request.user["member_id"],))
    cols, rows = rows_to_json(cur)
    conn.close()
    return jsonify(rows)


@app.route("/api/my/fines")
@auth_required
def my_fines():
    if request.user["account_type"] != "member":
        return jsonify({"error": "Members only"}), 403
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        SELECT f.fine_id, b.title AS book, f.amount, f.reason, f.issued_date, f.status
        FROM fines f JOIN loans l ON l.loan_id = f.loan_id JOIN books b ON b.book_id = l.book_id
        WHERE l.member_id = %s ORDER BY f.issued_date DESC
    """, (request.user["member_id"],))
    cols, rows = rows_to_json(cur)
    conn.close()
    return jsonify(rows)


# ============================================================ table browsers (management only)
def paginated(table_sql, count_sql, params, page, per_page=15):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(count_sql, params)
    total = cur.fetchone()[0]
    cur.execute(table_sql, params + [per_page, (page - 1) * per_page])
    cols, rows = rows_to_json(cur)
    conn.close()
    return jsonify({"rows": rows, "total": total, "page": page, "per_page": per_page})


@app.route("/api/books")
def api_books():
    q = request.args.get("q", "").strip()
    genre = request.args.get("genre", "").strip()
    page = int(request.args.get("page", 1))
    where, params = [], []
    if q:
        where.append("(b.title ILIKE %s OR a.full_name ILIKE %s)"); params += [f"%{q}%", f"%{q}%"]
    if genre:
        where.append("g.genre_name = %s"); params.append(genre)
    where_sql = ("WHERE " + " AND ".join(where)) if where else ""
    base = f"""FROM books b JOIN authors a ON a.author_id=b.author_id
        JOIN genres g ON g.genre_id=b.genre_id JOIN branches br ON br.branch_id=b.branch_id {where_sql}"""
    table_sql = f"""SELECT b.book_id, b.title, a.full_name AS author, g.genre_name AS genre,
        br.branch_name AS branch, b.publication_year, b.total_copies, b.available_copies, b.price
        {base} ORDER BY b.title LIMIT %s OFFSET %s"""
    return paginated(table_sql, f"SELECT COUNT(*) {base}", params, page)


@app.route("/api/members")
@management_required
def api_members():
    q = request.args.get("q", "").strip()
    page = int(request.args.get("page", 1))
    where = "WHERE m.full_name ILIKE %s OR m.email ILIKE %s" if q else ""
    params = [f"%{q}%", f"%{q}%"] if q else []
    base = f"FROM members m JOIN branches br ON br.branch_id=m.home_branch_id {where}"
    table_sql = f"""SELECT m.member_id, m.full_name, m.email, m.membership_type, m.membership_number,
        br.branch_name AS home_branch, m.join_date, m.is_active,
        (SELECT COUNT(*) FROM loans l WHERE l.member_id=m.member_id) AS total_loans
        {base} ORDER BY m.join_date DESC LIMIT %s OFFSET %s"""
    return paginated(table_sql, f"SELECT COUNT(*) {base}", params, page)


@app.route("/api/loans")
@management_required
def api_loans():
    status = request.args.get("status", "").strip()
    page = int(request.args.get("page", 1))
    where = "WHERE l.status = %s" if status else ""
    params = [status] if status else []
    base = f"""FROM loans l JOIN members m ON m.member_id=l.member_id JOIN books b ON b.book_id=l.book_id
        JOIN staff s ON s.staff_id=l.staff_id JOIN branches br ON br.branch_id=s.branch_id {where}"""
    table_sql = f"""SELECT l.loan_id, m.full_name AS member, b.title AS book, br.branch_name AS branch,
        l.loan_date, l.due_date, l.return_date, l.status {base} ORDER BY l.loan_date DESC LIMIT %s OFFSET %s"""
    return paginated(table_sql, f"SELECT COUNT(*) {base}", params, page)


@app.route("/api/fines")
@management_required
def api_fines():
    status = request.args.get("status", "").strip()
    page = int(request.args.get("page", 1))
    where = "WHERE f.status = %s" if status else ""
    params = [status] if status else []
    base = f"""FROM fines f JOIN loans l ON l.loan_id=f.loan_id JOIN members m ON m.member_id=l.member_id
        JOIN books b ON b.book_id=l.book_id {where}"""
    table_sql = f"""SELECT f.fine_id, m.full_name AS member, b.title AS book, f.amount, f.reason,
        f.issued_date, f.paid_date, f.status {base} ORDER BY f.issued_date DESC LIMIT %s OFFSET %s"""
    return paginated(table_sql, f"SELECT COUNT(*) {base}", params, page)


@app.route("/api/reservations")
@management_required
def api_reservations():
    status = request.args.get("status", "").strip()
    page = int(request.args.get("page", 1))
    where = "WHERE r.status = %s" if status else ""
    params = [status] if status else []
    base = f"FROM reservations r JOIN members m ON m.member_id=r.member_id JOIN books b ON b.book_id=r.book_id {where}"
    table_sql = f"""SELECT r.reservation_id, m.full_name AS member, b.title AS book, r.reservation_date, r.status
        {base} ORDER BY r.reservation_date DESC LIMIT %s OFFSET %s"""
    return paginated(table_sql, f"SELECT COUNT(*) {base}", params, page)


@app.route("/api/genres")
def api_genres():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT genre_name FROM genres ORDER BY genre_name")
    out = [r[0] for r in cur.fetchall()]
    conn.close()
    return jsonify(out)


# ============================================================ SQL query explorer (management only)
QUERIES = [
    {"id": 1, "title": "Books in the Science Fiction genre", "concepts": "SELECT, WHERE, JOIN, ORDER BY",
     "sql": """SELECT b.title, b.publication_year, a.full_name AS author, b.available_copies
FROM books b JOIN authors a ON a.author_id = b.author_id JOIN genres g ON g.genre_id = b.genre_id
WHERE g.genre_name = 'Science Fiction' ORDER BY b.publication_year DESC;"""},
    {"id": 2, "title": "15 most recently joined members", "concepts": "SELECT, ORDER BY, LIMIT",
     "sql": """SELECT member_id, full_name, membership_type, join_date FROM members
ORDER BY join_date DESC LIMIT 15;"""},
    {"id": 3, "title": "Loans processed per branch", "concepts": "JOIN, GROUP BY, COUNT, ORDER BY",
     "sql": """SELECT br.branch_name, COUNT(l.loan_id) AS total_loans FROM branches br
JOIN staff s ON s.branch_id = br.branch_id JOIN loans l ON l.staff_id = s.staff_id
GROUP BY br.branch_name ORDER BY total_loans DESC;"""},
    {"id": 4, "title": "Total value of fines collected", "concepts": "SUM, WHERE",
     "sql": "SELECT SUM(amount) AS total_fines_collected FROM fines WHERE status = 'Paid';"},
    {"id": 5, "title": "Books held per genre", "concepts": "GROUP BY, COUNT, JOIN, ORDER BY",
     "sql": """SELECT g.genre_name, COUNT(b.book_id) AS number_of_titles, SUM(b.total_copies) AS total_physical_copies
FROM genres g LEFT JOIN books b ON b.genre_id = g.genre_id
GROUP BY g.genre_name ORDER BY number_of_titles DESC;"""},
    {"id": 6, "title": "Genres with more than 10 titles", "concepts": "GROUP BY, HAVING",
     "sql": """SELECT g.genre_name, COUNT(b.book_id) AS number_of_titles FROM genres g
JOIN books b ON b.genre_id = g.genre_id GROUP BY g.genre_name
HAVING COUNT(b.book_id) > 10 ORDER BY number_of_titles DESC;"""},
    {"id": 7, "title": "Full catalogue listing", "concepts": "Multi-table JOIN, ORDER BY",
     "sql": """SELECT b.title, a.full_name AS author, p.publisher_name, g.genre_name, b.publication_year
FROM books b JOIN authors a ON a.author_id = b.author_id JOIN publishers p ON p.publisher_id = b.publisher_id
JOIN genres g ON g.genre_id = b.genre_id ORDER BY b.title LIMIT 25;"""},
    {"id": 8, "title": "Currently borrowed books, most recent first", "concepts": "Multi-table JOIN, WHERE, ORDER BY",
     "sql": """SELECT m.full_name AS member, b.title AS book, br.branch_name, l.loan_date, l.due_date, l.return_date, l.status
FROM loans l JOIN members m ON m.member_id = l.member_id JOIN books b ON b.book_id = l.book_id
JOIN staff s ON s.staff_id = l.staff_id JOIN branches br ON br.branch_id = s.branch_id
WHERE l.status = 'Borrowed' ORDER BY l.loan_date DESC LIMIT 25;"""},
    {"id": 9, "title": "Top 10 most borrowed books of all time", "concepts": "JOIN, GROUP BY, COUNT, ORDER BY, LIMIT",
     "sql": """SELECT b.title, a.full_name AS author, COUNT(l.loan_id) AS times_borrowed
FROM loans l JOIN books b ON b.book_id = l.book_id JOIN authors a ON a.author_id = b.author_id
GROUP BY b.title, a.full_name ORDER BY times_borrowed DESC LIMIT 10;"""},
    {"id": 10, "title": "Top 10 most active members", "concepts": "JOIN, GROUP BY, COUNT, ORDER BY, LIMIT",
     "sql": """SELECT m.full_name, m.membership_type, COUNT(l.loan_id) AS total_loans
FROM members m JOIN loans l ON l.member_id = m.member_id
GROUP BY m.full_name, m.membership_type ORDER BY total_loans DESC LIMIT 10;"""},
    {"id": 11, "title": "Members who have never borrowed a book", "concepts": "Subquery (NOT IN)",
     "sql": """SELECT member_id, full_name, membership_type, join_date FROM members
WHERE member_id NOT IN (SELECT DISTINCT member_id FROM loans) ORDER BY join_date;"""},
    {"id": 12, "title": "Books that have never been borrowed", "concepts": "Subquery (NOT EXISTS), JOIN",
     "sql": """SELECT b.title, a.full_name AS author, b.publication_year, b.total_copies
FROM books b JOIN authors a ON a.author_id = b.author_id
WHERE NOT EXISTS (SELECT 1 FROM loans l WHERE l.book_id = b.book_id) ORDER BY b.publication_year;"""},
    {"id": 13, "title": "Currently overdue loans with member contact info", "concepts": "JOIN, WHERE, ORDER BY, date arithmetic",
     "sql": """SELECT m.full_name, m.email, m.phone, b.title, l.due_date, (CURRENT_DATE - l.due_date) AS days_overdue
FROM loans l JOIN members m ON m.member_id = l.member_id JOIN books b ON b.book_id = l.book_id
WHERE l.status = 'Overdue' ORDER BY days_overdue DESC;"""},
    {"id": 14, "title": "Branches that collected more than K100 in fines", "concepts": "JOIN, GROUP BY, HAVING, SUM",
     "sql": """SELECT br.branch_name, SUM(f.amount) AS fines_collected FROM fines f
JOIN loans l ON l.loan_id = f.loan_id JOIN staff s ON s.staff_id = l.staff_id
JOIN branches br ON br.branch_id = s.branch_id WHERE f.status = 'Paid'
GROUP BY br.branch_name HAVING SUM(f.amount) > 100 ORDER BY fines_collected DESC;"""},
    {"id": 15, "title": "Monthly borrowing trend", "concepts": "GROUP BY (date part), COUNT, ORDER BY",
     "sql": """SELECT EXTRACT(YEAR FROM loan_date) AS loan_year, EXTRACT(MONTH FROM loan_date) AS loan_month, COUNT(*) AS total_loans
FROM loans GROUP BY EXTRACT(YEAR FROM loan_date), EXTRACT(MONTH FROM loan_date) ORDER BY loan_year, loan_month;"""},
    {"id": 16, "title": "Average days a book stays out, by genre", "concepts": "JOIN, GROUP BY, AVG, WHERE",
     "sql": """SELECT g.genre_name, ROUND(AVG(l.return_date - l.loan_date), 1) AS avg_days_out
FROM loans l JOIN books b ON b.book_id = l.book_id JOIN genres g ON g.genre_id = b.genre_id
WHERE l.return_date IS NOT NULL GROUP BY g.genre_name ORDER BY avg_days_out DESC;"""},
    {"id": 17, "title": "Fine payment / collection rate", "concepts": "SUM, COUNT, CASE expression",
     "sql": """SELECT COUNT(*) AS total_fines_issued, SUM(CASE WHEN status = 'Paid' THEN 1 ELSE 0 END) AS fines_paid,
    SUM(amount) AS total_amount_issued, SUM(CASE WHEN status = 'Paid' THEN amount ELSE 0 END) AS total_amount_collected,
    ROUND(100.0 * SUM(CASE WHEN status = 'Paid' THEN amount ELSE 0 END) / NULLIF(SUM(amount), 0), 1) AS collection_rate_pct
FROM fines;"""},
    {"id": 18, "title": "Members currently holding 2+ books at once", "concepts": "Subquery, GROUP BY, HAVING",
     "sql": """SELECT m.full_name, m.email, active.active_loans FROM members m JOIN (
    SELECT member_id, COUNT(*) AS active_loans FROM loans WHERE status IN ('Borrowed', 'Overdue')
    GROUP BY member_id HAVING COUNT(*) >= 2
) active ON active.member_id = m.member_id ORDER BY active.active_loans DESC;"""},
    {"id": 19, "title": "Loans processed per staff member", "concepts": "JOIN, GROUP BY, COUNT, ORDER BY",
     "sql": """SELECT s.full_name AS staff_member, s.role, br.branch_name, COUNT(l.loan_id) AS loans_processed
FROM staff s JOIN branches br ON br.branch_id = s.branch_id LEFT JOIN loans l ON l.staff_id = s.staff_id
GROUP BY s.full_name, s.role, br.branch_name ORDER BY loans_processed DESC;"""},
    {"id": 20, "title": "Most-borrowed book within each genre", "concepts": "Window function (RANK), CTE",
     "sql": """WITH book_loan_counts AS (
    SELECT b.book_id, b.title, g.genre_name, COUNT(l.loan_id) AS times_borrowed,
           RANK() OVER (PARTITION BY g.genre_name ORDER BY COUNT(l.loan_id) DESC) AS genre_rank
    FROM books b JOIN genres g ON g.genre_id = b.genre_id LEFT JOIN loans l ON l.book_id = b.book_id
    GROUP BY b.book_id, b.title, g.genre_name
)
SELECT genre_name, title, times_borrowed FROM book_loan_counts WHERE genre_rank = 1 ORDER BY times_borrowed DESC;"""},
]


@app.route("/api/queries")
@management_required
def api_queries_list():
    return jsonify([{"id": q["id"], "title": q["title"], "concepts": q["concepts"]} for q in QUERIES])


@app.route("/api/queries/<int:qid>")
@management_required
def api_query_run(qid):
    q = next((x for x in QUERIES if x["id"] == qid), None)
    if not q:
        return jsonify({"error": "not found"}), 404
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(q["sql"])
    cols, rows = rows_to_json(cur)
    conn.close()
    return jsonify({"id": q["id"], "title": q["title"], "concepts": q["concepts"], "sql": q["sql"], "columns": cols, "rows": rows})


# ============================================================ chart data (management only)
@app.route("/api/charts/top-books")
@management_required
def chart_top_books():
    conn = get_conn(); cur = conn.cursor()
    cur.execute("""SELECT b.title, COUNT(l.loan_id) AS n FROM loans l JOIN books b ON b.book_id = l.book_id
        GROUP BY b.title ORDER BY n DESC LIMIT 10""")
    rows = cur.fetchall(); conn.close()
    return jsonify({"labels": [r[0] for r in rows], "values": [r[1] for r in rows]})


@app.route("/api/charts/genre-composition")
@management_required
def chart_genre():
    conn = get_conn(); cur = conn.cursor()
    cur.execute("""SELECT g.genre_name, COUNT(b.book_id) AS n FROM genres g JOIN books b ON b.genre_id = g.genre_id
        GROUP BY g.genre_name ORDER BY n DESC""")
    rows = cur.fetchall(); conn.close()
    return jsonify({"labels": [r[0] for r in rows], "values": [r[1] for r in rows]})


@app.route("/api/charts/monthly-trend")
@management_required
def chart_trend():
    conn = get_conn(); cur = conn.cursor()
    cur.execute("""SELECT EXTRACT(YEAR FROM loan_date)::int AS y, EXTRACT(MONTH FROM loan_date)::int AS m, COUNT(*) AS n
        FROM loans GROUP BY 1,2 ORDER BY 1,2""")
    rows = cur.fetchall(); conn.close()
    return jsonify({"labels": [f"{y}-{m:02d}" for y, m, n in rows], "values": [n for y, m, n in rows]})


@app.route("/api/charts/branch-activity")
@management_required
def chart_branch():
    conn = get_conn(); cur = conn.cursor()
    cur.execute("""SELECT br.branch_name, COUNT(DISTINCT l.loan_id) AS loans,
               COALESCE(SUM(CASE WHEN f.status='Paid' THEN f.amount END), 0) AS fines
        FROM branches br JOIN staff s ON s.branch_id = br.branch_id JOIN loans l ON l.staff_id = s.staff_id
        LEFT JOIN fines f ON f.loan_id = l.loan_id GROUP BY br.branch_name ORDER BY loans DESC""")
    rows = cur.fetchall(); conn.close()
    return jsonify({"labels": [r[0] for r in rows], "loans": [r[1] for r in rows], "fines": [float(r[2]) for r in rows]})


@app.route("/api/health")
def health():
    try:
        conn = get_conn()
        conn.cursor().execute("SELECT 1")
        conn.close()
        return jsonify({"status": "UP"})
    except Exception:
        return jsonify({"status": "DOWN"}), 503


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5055))
    app.run(host="0.0.0.0", port=port, debug=os.environ.get("FLASK_DEBUG", "0") == "1")
