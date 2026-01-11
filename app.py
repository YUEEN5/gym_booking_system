from flask import Flask, render_template, request, redirect, session, jsonify
import sqlite3
from datetime import datetime, timedelta

app = Flask(__name__)
app.secret_key = "dadgym"

DB = "dadgym.db"

def get_db():
    return sqlite3.connect(DB)

def init_db():
    db = get_db()
    c = db.cursor()

    c.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT,
        password TEXT,
        role TEXT
    )
    """)

    c.execute("""
    CREATE TABLE IF NOT EXISTS slots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trainer_id INTEGER,
        date TEXT,
        time TEXT,
        booked_by INTEGER
    )
    """)

    db.commit()
    db.close()

init_db()

@app.route("/", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        u = request.form["username"]
        p = request.form["password"]

        db = get_db()
        c = db.cursor()
        c.execute("SELECT * FROM users WHERE username=? AND password=?", (u, p))
        user = c.fetchone()

        if user:
            session["user"] = {
                "id": user[0],
                "username": user[1],
                "role": user[3]
            }
            return redirect("/dashboard")
    return render_template("login.html")

@app.route("/register", methods=["GET","POST"])
def register():
    if request.method == "POST":
        u = request.form["username"]
        p = request.form["password"]
        r = request.form["role"]

        db = get_db()
        c = db.cursor()
        c.execute("INSERT INTO users (username,password,role) VALUES (?,?,?)",(u,p,r))
        db.commit()
        return redirect("/")
    return render_template("register.html")

@app.route("/dashboard")
def dashboard():
    if "user" not in session:
        return redirect("/")

    if session["user"]["role"] == "trainer":
        return render_template("trainer_dashboard.html")
    else:
        return render_template("client_dashboard.html")

@app.route("/create_slots", methods=["POST"])
def create_slots():
    data = request.json
    date = data["date"]
    start = data["start"]
    end = data["end"]

    def to_minutes(t):
        h, m = map(int, t.split(":"))
        return h * 60 + m

    start_m = to_minutes(start)
    end_m = to_minutes(end)

    db = get_db()
    c = db.cursor()

    current = start_m
    while current + 60 <= end_m:
        h = current // 60
        m = current % 60
        time = f"{h:02d}:{m:02d}"

        c.execute(
            "INSERT INTO slots (trainer_id,date,time,booked_by) VALUES (?,?,?,NULL)",
            (session["user"]["id"], date, time)
        )
        current += 60

    db.commit()
    return jsonify({"status": "ok"})


@app.route("/get_slots")
def get_slots():
    trainer = request.args.get("trainer")
    date = request.args.get("date")

    # If trainer=me, use the logged-in trainer's ID
    if trainer == "me":
        trainer = session["user"]["id"]

    db = get_db()
    c = db.cursor()
    c.execute("""
    SELECT slots.id, time, booked_by, users.username
    FROM slots LEFT JOIN users ON slots.booked_by = users.id
    WHERE trainer_id=? AND date=?
    """,(trainer,date))

    rows = c.fetchall()
    return jsonify(rows)

@app.route("/get_month_status")
def get_month_status():
    """
    Return status for each date in a month for a given trainer:
    - 'grey' = no slots
    - 'green' = at least one available
    - 'red' = all booked
    """
    trainer = request.args.get("trainer")
    year = int(request.args.get("year"))
    month = int(request.args.get("month"))  # 1-based (1=Jan)

    if trainer == "me":
        trainer = session["user"]["id"]

    db = get_db()
    c = db.cursor()

    # get all slots for this trainer in the month
    start_date = f"{year}-{month:02d}-01"
    end_date = f"{year}-{month:02d}-{31}"  # SQLite will handle overflow
    c.execute("""
        SELECT date, booked_by
        FROM slots
        WHERE trainer_id=? AND date BETWEEN ? AND ?
    """, (trainer, start_date, end_date))
    rows = c.fetchall()

    # Build a dict: { date: status }
    status_dict = {}
    for r in rows:
        date = r[0]
        booked_by = r[1]
        if date not in status_dict:
            status_dict[date] = {"total":0, "booked":0}
        status_dict[date]["total"] += 1
        if booked_by:
            status_dict[date]["booked"] += 1

    # Convert to status string
    result = {}
    for d, v in status_dict.items():
        if v["total"] == 0:
            result[d] = "grey"
        elif v["booked"] >= v["total"]:
            result[d] = "red"
        else:
            result[d] = "green"

    return jsonify(result)


@app.route("/book", methods=["POST"])
def book():
    slot_id = request.json["slot"]

    db = get_db()
    c = db.cursor()
    c.execute("UPDATE slots SET booked_by=? WHERE id=? AND booked_by IS NULL",
              (session["user"]["id"], slot_id))
    db.commit()
    return jsonify({"status":"booked"})

@app.route("/cancel", methods=["POST"])
def cancel():
    slot_id = request.json["slot"]

    db = get_db()
    c = db.cursor()
    c.execute("SELECT date,time FROM slots WHERE id=?", (slot_id,))
    s = c.fetchone()

    session_time = datetime.strptime(s[0] + " " + s[1], "%Y-%m-%d %H:%M")
    if session_time - datetime.now() < timedelta(hours=5):
        return jsonify({"error":"too_late"})

    c.execute("UPDATE slots SET booked_by=NULL WHERE id=? AND booked_by=?",
              (slot_id, session["user"]["id"]))
    db.commit()
    return jsonify({"status":"cancelled"})

@app.route("/trainers")
def trainers():
    db = get_db()
    c = db.cursor()
    c.execute("SELECT id,username FROM users WHERE role='trainer'")
    return jsonify(c.fetchall())

@app.route("/logout")
def logout():
    session.clear()
    return redirect("/")

app.run(debug=True)
