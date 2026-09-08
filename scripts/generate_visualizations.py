"""
Generates the data visualisation deliverables straight from live query
results against the library schema (not hand-typed numbers), using
matplotlib. Each chart is saved as a PNG plus a short explanation text file
that gets folded into the report.
"""
import psycopg2
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker

OUT_DIR = "/home/tadiwanashe-nenzou/Desktop/Big_data/visualizations"

conn = psycopg2.connect(host="localhost", dbname="mindcare", user="mindcare", password="mindcare_dev_password")
cur = conn.cursor()
cur.execute("SET search_path TO library;")

NAVY = "#14314f"
BLUE = "#4a7fb5"
LIGHT_BLUE = "#a9c6e0"
ACCENT = "#b8860b"

plt.rcParams.update({
    "font.family": "DejaVu Sans",
    "axes.edgecolor": "#888888",
    "axes.labelcolor": "#333333",
    "text.color": "#222222",
    "xtick.color": "#333333",
    "ytick.color": "#333333",
})


def savefig(fig, name):
    path = f"{OUT_DIR}/{name}.png"
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print("saved", path)


# ------------------------------------------------------------------
# Chart 1: Top 10 most borrowed books
# ------------------------------------------------------------------
cur.execute("""
    SELECT b.title, COUNT(l.loan_id) AS times_borrowed
    FROM loans l JOIN books b ON b.book_id = l.book_id
    GROUP BY b.title
    ORDER BY times_borrowed DESC
    LIMIT 10;
""")
rows = cur.fetchall()
titles = [r[0] for r in rows][::-1]
counts = [r[1] for r in rows][::-1]

fig, ax = plt.subplots(figsize=(9, 5.5))
bars = ax.barh(titles, counts, color=BLUE)
ax.set_xlabel("Number of times borrowed")
ax.set_title("Top 10 Most Borrowed Books", fontsize=14, fontweight="bold", color=NAVY, pad=12)
for bar, count in zip(bars, counts):
    ax.text(bar.get_width() + 0.1, bar.get_y() + bar.get_height()/2, str(count), va="center", fontsize=9)
ax.xaxis.set_major_locator(mticker.MaxNLocator(integer=True))
ax.spines[["top", "right"]].set_visible(False)
fig.tight_layout()
savefig(fig, "chart1_top_borrowed_books")

# ------------------------------------------------------------------
# Chart 2: Catalogue composition by genre
# ------------------------------------------------------------------
cur.execute("""
    SELECT g.genre_name, COUNT(b.book_id) AS n
    FROM genres g JOIN books b ON b.genre_id = g.genre_id
    GROUP BY g.genre_name
    ORDER BY n DESC;
""")
rows = cur.fetchall()
genres = [r[0] for r in rows]
genre_counts = [r[1] for r in rows]

fig, ax = plt.subplots(figsize=(8, 8))
colors = plt.cm.Blues_r([0.15 + 0.65 * i / len(genres) for i in range(len(genres))])
wedges, texts, autotexts = ax.pie(
    genre_counts, labels=genres, autopct=lambda p: f"{p:.0f}%" if p >= 4 else "",
    colors=colors, startangle=90, pctdistance=0.8,
    wedgeprops={"edgecolor": "white", "linewidth": 1},
)
for t in texts:
    t.set_fontsize(9)
for t in autotexts:
    t.set_fontsize(8)
    t.set_color("white")
ax.set_title("Catalogue Composition by Genre", fontsize=14, fontweight="bold", color=NAVY, pad=16)
fig.tight_layout()
savefig(fig, "chart2_catalogue_by_genre")

# ------------------------------------------------------------------
# Chart 3: Monthly borrowing trend
# ------------------------------------------------------------------
cur.execute("""
    SELECT EXTRACT(YEAR FROM loan_date)::int AS y, EXTRACT(MONTH FROM loan_date)::int AS m, COUNT(*) AS n
    FROM loans
    GROUP BY 1, 2
    ORDER BY 1, 2;
""")
rows = cur.fetchall()
labels = [f"{y}-{m:02d}" for y, m, n in rows]
values = [n for y, m, n in rows]

fig, ax = plt.subplots(figsize=(12, 5))
ax.plot(labels, values, color=BLUE, marker="o", markersize=4, linewidth=1.8)
ax.fill_between(range(len(labels)), values, color=LIGHT_BLUE, alpha=0.4)
ax.set_title("Monthly Borrowing Trend (Jan 2024 – Sep 2026)", fontsize=14, fontweight="bold", color=NAVY, pad=12)
ax.set_ylabel("Number of loans")
ax.set_xticks(range(0, len(labels), 2))
ax.set_xticklabels([labels[i] for i in range(0, len(labels), 2)], rotation=45, ha="right", fontsize=8)
ax.spines[["top", "right"]].set_visible(False)
ax.grid(axis="y", color="#e5e5e5", linewidth=0.8)
fig.tight_layout()
savefig(fig, "chart3_monthly_trend")

# ------------------------------------------------------------------
# Chart 4: Loans processed per branch, with fines collected overlay
# ------------------------------------------------------------------
cur.execute("""
    SELECT br.branch_name, COUNT(DISTINCT l.loan_id) AS loans,
           COALESCE(SUM(CASE WHEN f.status='Paid' THEN f.amount END), 0) AS fines
    FROM branches br
    JOIN staff s ON s.branch_id = br.branch_id
    JOIN loans l ON l.staff_id = s.staff_id
    LEFT JOIN fines f ON f.loan_id = l.loan_id
    GROUP BY br.branch_name
    ORDER BY loans DESC;
""")
rows = cur.fetchall()
branches = [r[0] for r in rows]
loans_n = [r[1] for r in rows]
fines_n = [float(r[2]) for r in rows]

fig, ax1 = plt.subplots(figsize=(8, 5.5))
x = range(len(branches))
bars = ax1.bar(x, loans_n, color=BLUE, width=0.5, label="Total loans")
ax1.set_ylabel("Total loans processed", color=NAVY)
ax1.set_xticks(list(x))
ax1.set_xticklabels(branches, fontsize=10)
ax1.spines[["top"]].set_visible(False)
for bar, v in zip(bars, loans_n):
    ax1.text(bar.get_x()+bar.get_width()/2, bar.get_height()+1, str(v), ha="center", fontsize=9)

ax2 = ax1.twinx()
ax2.plot(x, fines_n, color=ACCENT, marker="D", markersize=7, linewidth=2, label="Fines collected (K)")
ax2.set_ylabel("Fines collected (K)", color=ACCENT)
ax2.spines[["top"]].set_visible(False)

ax1.set_title("Branch Activity: Loans Processed vs. Fines Collected", fontsize=13.5, fontweight="bold", color=NAVY, pad=12)
lines1, labels1 = ax1.get_legend_handles_labels()
lines2, labels2 = ax2.get_legend_handles_labels()
ax1.legend(lines1 + lines2, labels1 + labels2, loc="upper right", fontsize=9, frameon=False)
fig.tight_layout()
savefig(fig, "chart4_branch_activity")

cur.close()
conn.close()
print("all charts generated")
