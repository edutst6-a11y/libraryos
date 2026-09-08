"""
Builds the Entity Relationship Diagram for the library schema as a clean,
hand-laid-out SVG (no Graphviz available in this environment), then
rasterises it to PNG for embedding in the report.
"""
import cairosvg

TABLES = {
    "authors": {
        "pos": (30, 30), "w": 230,
        "fields": [("author_id", "PK"), ("full_name", ""), ("nationality", ""), ("birth_year", "")],
    },
    "publishers": {
        "pos": (300, 30), "w": 230,
        "fields": [("publisher_id", "PK"), ("publisher_name", ""), ("country", ""), ("contact_email", "")],
    },
    "genres": {
        "pos": (570, 30), "w": 190,
        "fields": [("genre_id", "PK"), ("genre_name", "")],
    },
    "branches": {
        "pos": (800, 30), "w": 230,
        "fields": [("branch_id", "PK"), ("branch_name", ""), ("address", ""), ("city", ""), ("phone", ""), ("opened_date", "")],
    },
    "staff": {
        "pos": (1070, 30), "w": 230,
        "fields": [("staff_id", "PK"), ("branch_id", "FK"), ("full_name", ""), ("role", ""), ("email", ""), ("hire_date", ""), ("is_active", "")],
    },
    "books": {
        "pos": (300, 330), "w": 260,
        "fields": [("book_id", "PK"), ("isbn", ""), ("title", ""), ("author_id", "FK"), ("publisher_id", "FK"),
                   ("genre_id", "FK"), ("branch_id", "FK"), ("publication_year", ""), ("total_copies", ""),
                   ("available_copies", ""), ("price", "")],
    },
    "members": {
        "pos": (800, 330), "w": 250,
        "fields": [("member_id", "PK"), ("full_name", ""), ("email", ""), ("phone", ""), ("home_branch_id", "FK"),
                   ("membership_type", ""), ("join_date", ""), ("is_active", "")],
    },
    "loans": {
        "pos": (460, 660), "w": 260,
        "fields": [("loan_id", "PK"), ("book_id", "FK"), ("member_id", "FK"), ("staff_id", "FK"),
                   ("loan_date", ""), ("due_date", ""), ("return_date", ""), ("status", "")],
    },
    "reservations": {
        "pos": (800, 660), "w": 250,
        "fields": [("reservation_id", "PK"), ("book_id", "FK"), ("member_id", "FK"),
                   ("reservation_date", ""), ("status", "")],
    },
    "fines": {
        "pos": (200, 960), "w": 240,
        "fields": [("fine_id", "PK"), ("loan_id", "FK"), ("amount", ""), ("reason", ""),
                   ("issued_date", ""), ("paid_date", ""), ("status", "")],
    },
}

RELATIONSHIPS = [
    # (from_table, to_table, label, (label_dx, label_dy))
    ("authors", "books", "1 author writes M books", (-70, -18)),
    ("publishers", "books", "1 publisher releases M books", (60, 4)),
    ("genres", "books", "1 genre classifies M books", (0, -14)),
    ("branches", "books", "1 branch holds M books", (-40, 30)),
    ("branches", "staff", "1 branch employs M staff", (0, -14)),
    ("branches", "members", "1 branch is home to M members", (0, 0)),
    ("books", "loans", "1 book has M loans", (-90, -10)),
    ("members", "loans", "1 member makes M loans", (70, -34)),
    ("staff", "loans", "1 staff processes M loans", (110, 60)),
    ("loans", "fines", "1 loan may incur M fines", (0, 0)),
    ("books", "reservations", "1 book has M reservations", (-30, 34)),
    ("members", "reservations", "1 member makes M reservations", (0, 16)),
]

ROW_H = 22
HEADER_H = 30
FONT = "Verdana, Arial, sans-serif"


def box_dims(t):
    d = TABLES[t]
    h = HEADER_H + len(d["fields"]) * ROW_H + 6
    return d["pos"][0], d["pos"][1], d["w"], h


def anchor_point(t, side):
    x, y, w, h = box_dims(t)
    if side == "left":
        return x, y + h / 2
    if side == "right":
        return x + w, y + h / 2
    if side == "top":
        return x + w / 2, y
    if side == "bottom":
        return x + w / 2, y + h


def render_table(t):
    x, y, w, h = box_dims(t)
    d = TABLES[t]
    parts = [f'<g>']
    parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="6" fill="#ffffff" stroke="#2c3e50" stroke-width="1.5"/>')
    parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{HEADER_H}" rx="6" fill="#14314f"/>')
    parts.append(f'<rect x="{x}" y="{y+HEADER_H-8}" width="{w}" height="8" fill="#14314f"/>')
    parts.append(f'<text x="{x+w/2}" y="{y+20}" font-family="{FONT}" font-size="14" font-weight="bold" fill="#ffffff" text-anchor="middle">{t.upper()}</text>')
    for i, (field, key) in enumerate(d["fields"]):
        fy = y + HEADER_H + i * ROW_H + 16
        weight = "bold" if key == "PK" else "normal"
        color = "#14314f" if key == "PK" else ("#8a5a00" if key == "FK" else "#222222")
        label = field + (f"  ({key})" if key else "")
        parts.append(f'<text x="{x+12}" y="{fy}" font-family="{FONT}" font-size="11.5" font-weight="{weight}" fill="{color}">{label}</text>')
        if i > 0:
            parts.append(f'<line x1="{x}" y1="{y+HEADER_H+i*ROW_H}" x2="{x+w}" y2="{y+HEADER_H+i*ROW_H}" stroke="#e0e0e0" stroke-width="1"/>')
    parts.append('</g>')
    return "\n".join(parts)


def best_sides(t1, t2):
    x1, y1, w1, h1 = box_dims(t1)
    x2, y2, w2, h2 = box_dims(t2)
    c1x, c1y = x1 + w1/2, y1 + h1/2
    c2x, c2y = x2 + w2/2, y2 + h2/2
    dx, dy = c2x - c1x, c2y - c1y
    if abs(dx) > abs(dy):
        return ("right", "left") if dx > 0 else ("left", "right")
    else:
        return ("bottom", "top") if dy > 0 else ("top", "bottom")


def render_line(t1, t2):
    s1, s2 = best_sides(t1, t2)
    x1, y1 = anchor_point(t1, s1)
    x2, y2 = anchor_point(t2, s2)
    return f'<path d="M {x1} {y1} L {x2} {y2}" stroke="#7a7a7a" stroke-width="1.6" fill="none" marker-end="url(#arrow)"/>'


def render_label(t1, t2, label, offset):
    s1, s2 = best_sides(t1, t2)
    x1, y1 = anchor_point(t1, s1)
    x2, y2 = anchor_point(t2, s2)
    mx, my = (x1 + x2) / 2 + offset[0], (y1 + y2) / 2 + offset[1]
    label_bg = f'<rect x="{mx-len(label)*3.1-4}" y="{my-9}" width="{len(label)*6.2+8}" height="15" fill="#fffef2" stroke="#cccccc" stroke-width="0.5" rx="2"/>'
    label_txt = f'<text x="{mx}" y="{my+2}" font-family="{FONT}" font-size="9.5" fill="#555555" text-anchor="middle">{label}</text>'
    return label_bg + "\n" + label_txt


def main():
    width, height = 1360, 1230
    # LibreOffice's HTML->PDF conversion displays embedded images at their
    # native pixel size and ignores CSS width on <img> — so instead of
    # relying on the document to scale this down, we render it already at
    # its true target display size (a single A4 page is ~620px of usable
    # content width at this pipeline's effective DPI).
    target_w = 620
    scale = target_w / width
    target_h = round(height * scale)
    svg_parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{target_w}" height="{target_h}" viewBox="0 0 {target_w} {target_h}">',
        f'<rect width="{target_w}" height="{target_h}" fill="#ffffff"/>',
        f'<g transform="scale({scale})">',
        f'<rect width="{width}" height="{height}" fill="#ffffff"/>',
        '<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#7a7a7a"/></marker></defs>',
        f'<text x="{width/2}" y="26" font-family="{FONT}" font-size="20" font-weight="bold" fill="#14314f" text-anchor="middle">Library Management and Usage Analytics &#8212; Entity Relationship Diagram</text>',
    ]

    # lines behind the boxes, boxes next, labels last so nothing hides them
    for t1, t2, label, offset in RELATIONSHIPS:
        svg_parts.append(render_line(t1, t2))

    for t in TABLES:
        svg_parts.append(render_table(t))

    for t1, t2, label, offset in RELATIONSHIPS:
        svg_parts.append(render_label(t1, t2, label, offset))

    svg_parts.append('</g>')
    svg_parts.append('</svg>')
    svg = "\n".join(svg_parts)

    svg_path = "/home/tadiwanashe-nenzou/Desktop/Big_data/erd/library_erd.svg"
    png_path = "/home/tadiwanashe-nenzou/Desktop/Big_data/erd/library_erd.png"
    with open(svg_path, "w") as f:
        f.write(svg)
    # Render at 3x then downsample for anti-aliased text, but the FINAL
    # saved PNG's pixel dimensions must equal the true target display size.
    cairosvg.svg2png(url=svg_path, write_to=png_path, output_width=target_w*3, output_height=target_h*3)
    from PIL import Image
    Image.open(png_path).resize((target_w, target_h), Image.LANCZOS).save(png_path)
    print("wrote", svg_path, "and", png_path, f"at {target_w}x{target_h}")


if __name__ == "__main__":
    main()
