"""
Generates realistic seed data for the library schema and writes it as
sql/02_seed_data.sql (plain INSERT statements) so the SQL script deliverable
is self-contained and reviewable, not hidden behind a script someone has to
trust blindly.
"""
import random
from datetime import date, timedelta

random.seed(42)

OUT_PATH = "/home/tadiwanashe-nenzou/Desktop/Big_data/sql/02_seed_data.sql"

# ---------------------------------------------------------------- branches
BRANCHES = [
    ("Central Library", "12 Cairo Road", "Lusaka", "+260-211-220011", date(2005, 3, 1)),
    ("Northmead Branch", "45 Church Road", "Lusaka", "+260-211-221345", date(2010, 6, 15)),
    ("Kitwe Branch", "8 Independence Ave", "Kitwe", "+260-212-224678", date(2012, 1, 20)),
    ("Ndola Branch", "21 Buteko Ave", "Ndola", "+260-212-227890", date(2015, 9, 10)),
]

# ---------------------------------------------------------------- staff
FIRST_NAMES_M = ["James","Michael","David","John","Robert","Peter","Daniel","Joseph","Kennedy","Emmanuel","Bwalya","Mulenga","Chanda","Bright","Francis"]
FIRST_NAMES_F = ["Mary","Grace","Patricia","Linda","Susan","Elizabeth","Mercy","Chileshe","Natasha","Ruth","Ireen","Mutinta","Precious","Loveness","Chanda"]
LAST_NAMES = ["Banda","Phiri","Mwansa","Tembo","Zulu","Sakala","Mumba","Chola","Kunda","Lungu","Ngoma","Chisenga","Mbewe","Zimba","Kabwe","Musonda","Chirwa","Sinyangwe","Kaluba","Mwape"]

def random_name():
    if random.random() < 0.5:
        first = random.choice(FIRST_NAMES_M)
    else:
        first = random.choice(FIRST_NAMES_F)
    return f"{first} {random.choice(LAST_NAMES)}"

STAFF_ROLES = ["Librarian","Librarian","Assistant Librarian","Assistant Librarian","Branch Manager","IT Support"]

staff_rows = []
staff_id = 1
for branch_id in range(1, len(BRANCHES) + 1):
    n_staff = random.randint(3, 4)
    for _ in range(n_staff):
        name = random_name()
        role = random.choice(STAFF_ROLES)
        email = name.lower().replace(" ", ".") + f"{staff_id}@citylibrary.zm"
        hire = date(random.randint(2008, 2024), random.randint(1, 12), random.randint(1, 28))
        staff_rows.append((staff_id, branch_id, name, role, email, hire, True))
        staff_id += 1

# ---------------------------------------------------------------- authors
AUTHOR_POOL = [
    ("Chinua Achebe","Nigerian",1930),("Ngugi wa Thiong'o","Kenyan",1938),("Chimamanda Ngozi Adichie","Nigerian",1977),
    ("J.K. Rowling","British",1965),("George Orwell","British",1903),("Jane Austen","British",1775),
    ("Ernest Hemingway","American",1899),("Toni Morrison","American",1931),("Stephen King","American",1947),
    ("Agatha Christie","British",1890),("Arthur Conan Doyle","British",1859),("Mark Twain","American",1835),
    ("Harper Lee","American",1926),("F. Scott Fitzgerald","American",1896),("Leo Tolstoy","Russian",1828),
    ("Fyodor Dostoevsky","Russian",1821),("Gabriel Garcia Marquez","Colombian",1927),("Isabel Allende","Chilean",1942),
    ("Yuval Noah Harari","Israeli",1976),("Malcolm Gladwell","Canadian",1963),("Michelle Obama","American",1964),
    ("Barack Obama","American",1961),("Nelson Mandela","South African",1918),("Wole Soyinka","Nigerian",1934),
    ("Ben Okri","Nigerian",1959),("Alexander McCall Smith","Zimbabwean",1948),("Petina Gappah","Zimbabwean",1971),
    ("NoViolet Bulawayo","Zimbabwean",1981),("Bessie Head","Botswanan",1937),("Doris Lessing","British",1919),
    ("J.R.R. Tolkien","British",1892),("C.S. Lewis","British",1898),("Roald Dahl","British",1916),
    ("Suzanne Collins","American",1962),("Dan Brown","American",1964),("John Grisham","American",1955),
    ("Paulo Coelho","Brazilian","1947"),("Haruki Murakami","Japanese",1949),("Kazuo Ishiguro","British",1954),
    ("Margaret Atwood","Canadian",1939),("Neil Gaiman","British",1960),
]
authors_rows = [(i+1, n, nat, int(yr)) for i, (n, nat, yr) in enumerate(AUTHOR_POOL)]

# ---------------------------------------------------------------- publishers
PUBLISHER_POOL = [
    ("Penguin Random House","USA"),("HarperCollins","USA"),("Simon & Schuster","USA"),("Macmillan Publishers","UK"),
    ("Oxford University Press","UK"),("Cambridge University Press","UK"),("Zebra Press","South Africa"),
    ("Jacana Media","South Africa"),("Weaver Press","Zimbabwe"),("East African Educational Publishers","Kenya"),
    ("Bloomsbury Publishing","UK"),("Vintage Books","USA"),("Scholastic","USA"),("Hachette Book Group","USA"),
    ("Kachere Series","Malawi"),
]
publishers_rows = [(i+1, n, c, n.lower().replace(" ", "").replace("&","and")[:15] + "@pub.com") for i, (n, c) in enumerate(PUBLISHER_POOL)]

# ---------------------------------------------------------------- genres
GENRE_LIST = ["Fiction","Non-Fiction","Science Fiction","Fantasy","Mystery & Crime","Romance",
              "Biography","History","Children's","Young Adult","Technology & Computing","Self-Help","Poetry","Education"]
genres_rows = [(i+1, g) for i, g in enumerate(GENRE_LIST)]

# ---------------------------------------------------------------- books
TITLE_TEMPLATES = [
    "The {adj} {noun}","{noun} of the {adj} {noun2}","A {adj} Journey","The Last {noun}","Shadows of {noun}",
    "The {noun}'s Secret","Beyond the {adj} {noun2}","{adj} Hearts","The {noun} Chronicles","Whispers of {noun}",
    "The {adj} Path","Return to {noun}","The {noun2} Within","Echoes of {adj} {noun}","The {noun} Diaries",
]
ADJ = ["Silent","Hidden","Golden","Broken","Forgotten","Distant","Ancient","Wild","Quiet","Burning","Lost","Sacred","Endless","Crimson","Final"]
NOUN = ["River","Mountain","City","Garden","Ocean","Forest","Kingdom","Village","Storm","Star","Dream","Shadow","Light","Winter","Road"]
NOUN2 = ["Truth","Time","Memory","World","Heart","Mind","Soul","Horizon","Silence","Fire"]

def gen_title():
    t = random.choice(TITLE_TEMPLATES)
    return t.format(adj=random.choice(ADJ), noun=random.choice(NOUN), noun2=random.choice(NOUN2))

used_titles = set()
books_rows = []
n_books = 150
for i in range(1, n_books + 1):
    title = gen_title()
    while title in used_titles:
        title = gen_title()
    used_titles.add(title)
    author_id = random.randint(1, len(authors_rows))
    publisher_id = random.randint(1, len(publishers_rows))
    # weight genres unevenly so analytics have real patterns to find
    genre_weights = [3,2,3,3,2,2,2,2,3,2,1,1,1,1]
    genre_id = random.choices(range(1, len(GENRE_LIST) + 1), weights=genre_weights, k=1)[0]
    branch_id = random.randint(1, len(BRANCHES))
    pub_year = random.randint(1960, 2024)
    total_copies = random.randint(1, 8)
    on_loan_now = random.randint(0, total_copies)
    available_copies = total_copies - on_loan_now
    price = round(random.uniform(8.5, 65.0), 2)
    isbn = f"978-{random.randint(0,9)}-{random.randint(100,999)}-{random.randint(10000,99999)}-{random.randint(0,9)}"
    books_rows.append((i, isbn, title, author_id, publisher_id, genre_id, branch_id, pub_year, total_copies, available_copies, price))

# ---------------------------------------------------------------- members
MEMBERSHIP_TYPES = ["Student","Student","Student","Public","Public","Staff","Senior"]
members_rows = []
n_members = 130
for i in range(1, n_members + 1):
    name = random_name()
    email = name.lower().replace(" ", ".") + f"{i}@mail.zm"
    phone = f"+260-9{random.randint(7,9)}-{random.randint(1000000,9999999)}"
    home_branch = random.randint(1, len(BRANCHES))
    mtype = random.choice(MEMBERSHIP_TYPES)
    join_date = date(random.randint(2015, 2025), random.randint(1, 12), random.randint(1, 28))
    is_active = random.random() > 0.08
    members_rows.append((i, name, email, phone, home_branch, mtype, join_date, is_active))

# ---------------------------------------------------------------- loans
# Popular books get borrowed far more often than obscure ones -> realistic
# skew for analytics ("most borrowed book" etc.)
book_popularity = {b[0]: random.choices([1,2,3,4,5], weights=[10,25,30,20,15])[0] for b in books_rows}

loans_rows = []
loan_id = 1
n_loans = 420
today = date(2026, 9, 8)
start_window = date(2024, 1, 1)
days_span = (today - start_window).days

for _ in range(n_loans):
    # weighted book choice by popularity
    weighted_books = []
    for b in books_rows:
        weighted_books += [b[0]] * book_popularity[b[0]]
    book_id = random.choice(weighted_books)
    member_id = random.randint(1, n_members)
    staff_row = random.choice(staff_rows)
    staff_id_v = staff_row[0]

    loan_date = start_window + timedelta(days=random.randint(0, days_span))
    due_date = loan_date + timedelta(days=14)
    days_since_due = (today - due_date).days

    roll = random.random()
    if loan_date > today - timedelta(days=14):
        # too recent to have a verdict yet either way, mostly still out
        if roll < 0.85:
            status = "Borrowed"
            return_date = None
        else:
            status = "Returned"
            return_date = loan_date + timedelta(days=random.randint(1, 13))
    elif days_since_due <= 45:
        # recently overdue window: a mix of on-time/late returns, genuinely
        # overdue right now, or just lost
        if roll < 0.72:
            status = "Returned"
            delay = random.choices([0, 0, 0, random.randint(1, 20)], weights=[40,20,20,20])[0]
            return_date = due_date + timedelta(days=delay) if delay else loan_date + timedelta(days=random.randint(1, 13))
        elif roll < 0.94:
            status = "Overdue"
            return_date = None
        else:
            status = "Lost"
            return_date = None
    else:
        # due date is well in the past: by now the library would have
        # either gotten the book back or written it off as lost, never
        # left sitting as "Overdue" for months
        if roll < 0.93:
            status = "Returned"
            delay = random.choices([0, 0, 0, random.randint(1, 25)], weights=[40,20,20,20])[0]
            return_date = due_date + timedelta(days=delay) if delay else loan_date + timedelta(days=random.randint(1, 13))
        else:
            status = "Lost"
            return_date = None

    loans_rows.append((loan_id, book_id, member_id, staff_id_v, loan_date, due_date, return_date, status))
    loan_id += 1

# A uniform random spread over ~2.7 years leaves only a handful of loans
# "currently" active, which understates how many books a real library has
# checked out at any one moment. Top up with a batch of recent loans,
# deliberately reusing some members so a few genuinely hold 2+ books at once.
frequent_members = random.sample(range(1, n_members + 1), 18)
for _ in range(40):
    weighted_books = []
    for b in books_rows:
        weighted_books += [b[0]] * book_popularity[b[0]]
    book_id = random.choice(weighted_books)
    member_id = random.choice(frequent_members) if random.random() < 0.55 else random.randint(1, n_members)
    staff_id_v = random.choice(staff_rows)[0]

    loan_date = today - timedelta(days=random.randint(0, 13))
    due_date = loan_date + timedelta(days=14)
    if random.random() < 0.88:
        status = "Borrowed"
        return_date = None
    else:
        status = "Returned"
        return_date = loan_date + timedelta(days=random.randint(1, min(13, max(1, (today - loan_date).days))))

    loans_rows.append((loan_id, book_id, member_id, staff_id_v, loan_date, due_date, return_date, status))
    loan_id += 1

# ---------------------------------------------------------------- fines
fines_rows = []
fine_id = 1
for loan in loans_rows:
    lid, book_id, member_id, staff_id_v, loan_date, due_date, return_date, status = loan
    if status == "Lost":
        book_price = next(b[10] for b in books_rows if b[0] == book_id)
        fines_rows.append((fine_id, lid, book_price, "Lost", due_date + timedelta(days=5), None, "Unpaid"))
        fine_id += 1
    elif status == "Overdue":
        days_over = (today - due_date).days
        amount = round(max(days_over, 1) * 0.75, 2)
        fines_rows.append((fine_id, lid, amount, "Overdue", due_date + timedelta(days=1), None, random.choice(["Unpaid","Unpaid","Paid"])) )
        fine_id += 1
    elif status == "Returned" and return_date and return_date > due_date:
        days_over = (return_date - due_date).days
        amount = round(days_over * 0.75, 2)
        paid = random.random() < 0.85
        paid_date = return_date + timedelta(days=random.randint(0,4)) if paid else None
        fines_rows.append((fine_id, lid, amount, "Overdue", due_date + timedelta(days=1), paid_date, "Paid" if paid else "Unpaid"))
        fine_id += 1

# ---------------------------------------------------------------- reservations
reservations_rows = []
res_id = 1
n_reservations = 70
for _ in range(n_reservations):
    book_id = random.randint(1, n_books)
    member_id = random.randint(1, n_members)
    res_date = start_window + timedelta(days=random.randint(0, days_span))
    status = random.choices(["Fulfilled","Pending","Cancelled","Expired"], weights=[45,15,15,25])[0]
    reservations_rows.append((res_id, book_id, member_id, res_date, status))
    res_id += 1


def sql_str(v):
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "TRUE" if v else "FALSE"
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, date):
        return f"'{v.isoformat()}'"
    escaped = str(v).replace("'", "''")
    return f"'{escaped}'"


def emit_insert(f, table, columns, rows):
    f.write(f"\n-- {table} ({len(rows)} rows)\n")
    f.write(f"INSERT INTO {table} ({', '.join(columns)}) VALUES\n")
    lines = []
    for row in rows:
        lines.append("  (" + ", ".join(sql_str(v) for v in row) + ")")
    f.write(",\n".join(lines))
    f.write(";\n")


with open(OUT_PATH, "w") as f:
    f.write("-- ============================================================\n")
    f.write("-- Library Management and Usage Analytics - Seed Data\n")
    f.write("-- Generated deterministically (random.seed(42)) for reproducibility\n")
    f.write("-- ============================================================\n")
    f.write("SET search_path TO library;\n")

    emit_insert(f, "branches", ["branch_id","branch_name","address","city","phone","opened_date"], BRANCHES and [(i+1,)+b for i,b in enumerate(BRANCHES)])
    emit_insert(f, "staff", ["staff_id","branch_id","full_name","role","email","hire_date","is_active"], staff_rows)
    emit_insert(f, "authors", ["author_id","full_name","nationality","birth_year"], authors_rows)
    emit_insert(f, "publishers", ["publisher_id","publisher_name","country","contact_email"], publishers_rows)
    emit_insert(f, "genres", ["genre_id","genre_name"], genres_rows)
    emit_insert(f, "books", ["book_id","isbn","title","author_id","publisher_id","genre_id","branch_id","publication_year","total_copies","available_copies","price"], books_rows)
    emit_insert(f, "members", ["member_id","full_name","email","phone","home_branch_id","membership_type","join_date","is_active"], members_rows)
    emit_insert(f, "loans", ["loan_id","book_id","member_id","staff_id","loan_date","due_date","return_date","status"], loans_rows)
    emit_insert(f, "fines", ["fine_id","loan_id","amount","reason","issued_date","paid_date","status"], fines_rows)
    emit_insert(f, "reservations", ["reservation_id","book_id","member_id","reservation_date","status"], reservations_rows)

    f.write("\n-- keep the SERIAL sequences consistent with the explicit ids we inserted\n")
    for table, col in [("branches","branch_id"),("staff","staff_id"),("authors","author_id"),
                        ("publishers","publisher_id"),("genres","genre_id"),("books","book_id"),
                        ("members","member_id"),("loans","loan_id"),("fines","fine_id"),
                        ("reservations","reservation_id")]:
        f.write(f"SELECT setval(pg_get_serial_sequence('{table}', '{col}'), (SELECT MAX({col}) FROM {table}));\n")

print("wrote", OUT_PATH)
print("counts:", {
    "branches": len(BRANCHES), "staff": len(staff_rows), "authors": len(authors_rows),
    "publishers": len(publishers_rows), "genres": len(genres_rows), "books": len(books_rows),
    "members": len(members_rows), "loans": len(loans_rows), "fines": len(fines_rows),
    "reservations": len(reservations_rows),
})
