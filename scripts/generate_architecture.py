"""
Builds the Big Data Architecture diagram: how the operational SQL database
plugs into a larger Big Data pipeline once volumes grow from thousands to
millions/billions of records.
"""
import cairosvg

FONT = "Verdana, Arial, sans-serif"
WIDTH, HEIGHT = 1500, 980

# Each layer is a labelled vertical band; boxes sit inside their band.
LAYERS = [
    {"name": "1. DATA SOURCES", "y": 80, "h": 150, "color": "#eef2f6"},
    {"name": "2. INGESTION", "y": 260, "h": 150, "color": "#e7f0e9"},
    {"name": "3. STORAGE", "y": 440, "h": 160, "color": "#fdf1e3"},
    {"name": "4. PROCESSING", "y": 630, "h": 130, "color": "#f0e9f5"},
    {"name": "5. CONSUMPTION / DECISION-MAKING", "y": 790, "h": 150, "color": "#e9f2fb"},
]

BOXES = [
    # (label, sublabel, x, w, layer_index)
    ("Branch Systems", "circulation desks, 4 branches", 40, 260, 0),
    ("Self-Service Kiosks", "member check-out/return", 330, 240, 0),
    ("Online Member Portal", "web/mobile catalogue search", 600, 260, 0),
    ("Operational SQL Database", "PostgreSQL — today's system of record", 900, 320, 0),
    ("Legacy branch exports", "CSV/partner feeds", 1250, 200, 0),

    ("Kafka", "real-time event stream: loan, return,\nreservation, fine events", 60, 340, 1),
    ("Batch Extraction (Sqoop-style)", "nightly full/incremental pull from\nthe operational SQL database", 460, 340, 1),
    ("External Feeds", "e-book platform usage,\ninter-library loan network", 900, 300, 1),

    ("Data Lake (HDFS)", "raw zone — every event and export kept\nas-is, cheap distributed storage,\nscales to billions of records", 60, 420, 2),
    ("Data Warehouse (Hive)", "curated zone — cleaned, structured\ninto fact/dimension tables for\nfast SQL-style analytics", 560, 420, 2),
    ("Metadata / Governance", "schema registry,\ndata catalogue", 1060, 340, 2),

    ("Spark (batch)", "large-scale ETL: clean, join,\naggregate raw data into the warehouse", 60, 420, 3),
    ("Spark Streaming", "real-time processing of the Kafka feed\n(e.g. live “currently checked out” counts)", 560, 420, 3),
    ("ML / Recommendation Jobs", "usage-pattern modelling,\ndemand forecasting", 1060, 340, 3),

    ("BI Dashboards", "Power BI / Tableau —\nusage trends, branch performance", 60, 330, 4),
    ("Ad-hoc Analyst Queries", "HiveQL / SparkSQL over\nthe warehouse", 460, 330, 4),
    ("Library Management Decisions", "stock purchasing, staffing,\nbranch investment, fine policy", 860, 340, 4),
    ("Member-Facing Features", "“recommended for you”,\nreal-time availability", 1260, 200, 4),
]

ARROWS = [
    # simple vertical/near-vertical flow arrows between layers, by box index pairs
    (0, 5), (1, 5), (2, 5), (3, 5), (3, 6), (4, 6),
    (5, 8), (6, 8), (6, 9), (7, 9),
    (8, 11), (9, 12), (9, 11), (10, 11),
    (11, 14), (11, 15), (12, 14), (12, 15), (13, 15), (12, 17),
    (15, 16),
]


def box_rect(i):
    label, sub, x, w, layer_i = BOXES[i]
    layer = LAYERS[layer_i]
    y = layer["y"] + 34
    h = layer["h"] - 46
    return x, y, w, h


def render_box(i):
    label, sub, x, w, layer_i = BOXES[i]
    x0, y0, w0, h0 = box_rect(i)
    parts = [f'<rect x="{x0}" y="{y0}" width="{w0}" height="{h0}" rx="8" fill="#ffffff" stroke="#3a3a3a" stroke-width="1.3"/>']
    parts.append(f'<text x="{x0+w0/2}" y="{y0+22}" font-family="{FONT}" font-size="13.5" font-weight="bold" fill="#14314f" text-anchor="middle">{label}</text>')
    sub_lines = sub.split("\n")
    for j, line in enumerate(sub_lines):
        parts.append(f'<text x="{x0+w0/2}" y="{y0+42+j*15}" font-family="{FONT}" font-size="10.5" fill="#444444" text-anchor="middle">{line}</text>')
    return "\n".join(parts)


def center_bottom(i):
    x0, y0, w0, h0 = box_rect(i)
    return x0 + w0/2, y0 + h0


def center_top(i):
    x0, y0, w0, h0 = box_rect(i)
    return x0 + w0/2, y0


def render_arrow(i, j):
    x1, y1 = center_bottom(i)
    x2, y2 = center_top(j)
    # slight horizontal component if boxes aren't aligned, using a soft curve
    midy = (y1 + y2) / 2
    path = f'M {x1} {y1} C {x1} {midy}, {x2} {midy}, {x2} {y2}'
    return f'<path d="{path}" stroke="#8a8a8a" stroke-width="1.4" fill="none" marker-end="url(#arrow2)" opacity="0.85"/>'


def main():
    # LibreOffice's HTML->PDF conversion displays embedded images at native
    # pixel size and ignores CSS width, so render this already at its true
    # target display size rather than relying on the document to scale it.
    target_w = 620
    scale = target_w / WIDTH
    target_h = round(HEIGHT * scale)
    svg = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{target_w}" height="{target_h}" viewBox="0 0 {target_w} {target_h}">',
        f'<rect width="{target_w}" height="{target_h}" fill="#ffffff"/>',
        f'<g transform="scale({scale})">',
        f'<rect width="{WIDTH}" height="{HEIGHT}" fill="#ffffff"/>',
        '<defs><marker id="arrow2" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#8a8a8a"/></marker></defs>',
        f'<text x="{WIDTH/2}" y="30" font-family="{FONT}" font-size="20" font-weight="bold" fill="#14314f" text-anchor="middle">Library Management &#8212; Big Data Architecture (from thousands to billions of records)</text>',
    ]

    for layer in LAYERS:
        svg.append(f'<rect x="20" y="{layer["y"]}" width="{WIDTH-40}" height="{layer["h"]}" rx="10" fill="{layer["color"]}" stroke="#cccccc" stroke-width="1"/>')
        svg.append(f'<text x="36" y="{layer["y"]+22}" font-family="{FONT}" font-size="13" font-weight="bold" fill="#555555">{layer["name"]}</text>')

    for i, j in ARROWS:
        svg.append(render_arrow(i, j))

    for i in range(len(BOXES)):
        svg.append(render_box(i))

    svg.append('</g>')
    svg.append('</svg>')
    svg_str = "\n".join(svg)

    svg_path = "/home/tadiwanashe-nenzou/Desktop/Big_data/architecture/big_data_architecture.svg"
    png_path = "/home/tadiwanashe-nenzou/Desktop/Big_data/architecture/big_data_architecture.png"
    with open(svg_path, "w") as f:
        f.write(svg_str)
    cairosvg.svg2png(url=svg_path, write_to=png_path, output_width=target_w*3, output_height=target_h*3)
    from PIL import Image
    Image.open(png_path).resize((target_w, target_h), Image.LANCZOS).save(png_path)
    print("wrote", svg_path, "and", png_path, f"at {target_w}x{target_h}")


if __name__ == "__main__":
    main()
