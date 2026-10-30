#!/usr/bin/env python3
"""Generate a big Pixel Agents office: 8 rooms + hallway + garden with a fountain.

Usage: make_office.py <out_layout.json> <out_assets_dir>
"""
import json, os, sys, random, collections
from PIL import Image, ImageDraw

COLS, ROWS = 64, 50
WALL, VOID = 0, 255
F_PLAIN, F_QUAD, F_BRICK, F_WOOD, F_CHECK = 1, 4, 6, 7, 9  # TileType ids

tiles = [VOID] * (COLS * ROWS)
colors = [None] * (COLS * ROWS)
furniture = []
blocked = set()      # tiles occupied by furniture footprints
seats = []           # (row, col) of seats, for reporting

def put(r, c, t, col=None):
    tiles[r * COLS + c] = t
    colors[r * COLS + c] = col

def fill(r0, c0, r1, c1, t, col):
    for r in range(r0, r1 + 1):
        for c in range(c0, c1 + 1):
            put(r, c, t, col)

WALLC = {"h": 214, "s": 30, "b": -100, "c": -55}
# footprint (w, h) per catalog type (from the bundled manifests)
FP = {
    "DESK_FRONT": (3, 2), "PC_FRONT_OFF": (1, 2), "CUSHIONED_BENCH": (1, 1),
    "TABLE_FRONT": (3, 4), "PC_SIDE": (1, 2), "WOODEN_CHAIR_SIDE": (1, 2),
    "SOFA_FRONT": (2, 1), "SOFA_BACK": (2, 1), "SOFA_SIDE": (1, 2),
    "COFFEE_TABLE": (2, 2), "COFFEE": (1, 1), "SMALL_TABLE_FRONT": (2, 2),
    "SMALL_TABLE_SIDE": (1, 3), "PLANT": (1, 2), "PLANT_2": (1, 2),
    "LARGE_PLANT": (2, 3), "CACTUS": (1, 2), "POT": (1, 1), "BIN": (1, 1),
    "WOODEN_BENCH": (1, 1), "FOUNTAIN": (2, 2),
    "DOUBLE_BOOKSHELF": (2, 2), "WHITEBOARD": (2, 2), "LARGE_PAINTING": (2, 2),
    "SMALL_PAINTING": (1, 2), "SMALL_PAINTING_2": (1, 2), "CLOCK": (1, 2),
    "HANGING_PLANT": (1, 2), "BOOKSHELF": (2, 1),
}
WALL_ITEMS = {"DOUBLE_BOOKSHELF", "WHITEBOARD", "LARGE_PAINTING", "SMALL_PAINTING",
              "SMALL_PAINTING_2", "CLOCK", "HANGING_PLANT", "BOOKSHELF"}
OVERLAY = {"PC_FRONT_OFF", "PC_SIDE", "COFFEE"}   # sit on top of another piece

def add(t, r, c):
    base = t.split(":")[0]
    w, h = FP[base]
    furniture.append({"uid": f"f-{1790000000000 + len(furniture)}-{len(furniture):04x}", "type": t, "col": c, "row": r})
    if base in WALL_ITEMS or base in OVERLAY:
        return
    for rr in range(r, r + h):
        for cc in range(c, c + w):
            blocked.add((rr, cc))

def desk_group(r, c):
    add("DESK_FRONT", r, c); add("PC_FRONT_OFF", r, c + 1); add("CUSHIONED_BENCH", r + 2, c + 1)
    seats.append((r + 2, c + 1))

def side_table(r, c):
    add("TABLE_FRONT", r, c)
    for dr in (0, 2):
        add("PC_SIDE", r + dr, c); add("PC_SIDE:left", r + dr, c + 2)
        add("WOODEN_CHAIR_SIDE", r + dr, c - 1); add("WOODEN_CHAIR_SIDE:left", r + dr, c + 3)
        seats.extend([(r + dr, c - 1), (r + dr, c + 3)])

def lounge_set(r, c):
    add("SOFA_FRONT", r, c); add("COFFEE_TABLE", r + 1, c)
    add("SOFA_SIDE", r + 1, c - 1); add("SOFA_SIDE:left", r + 1, c + 2)
    add("SOFA_BACK", r + 3, c); add("COFFEE", r + 2, c)

# ---- geometry ---------------------------------------------------------------
WALLX = [5, 18, 31, 44, 57]
TOPW, MID1, MID2, BOTW = 2, 14, 20, 32          # wall rows
TOP_IN = (3, 13)           # interior rows of the top rooms
BOT_IN = (21, 31)
HALL = (15, 19)

# rooms: (name, x0, row0, kind, floor_type, floor_color)
WOOD = {"h": 25, "s": 48, "b": -43, "c": -88}
BLUE = {"h": 209, "s": 39, "b": -25, "c": -80}
CHECK = {"h": 209, "s": 0, "b": -16, "c": -8}
PINK = {"h": 335, "s": 30, "b": -28, "c": -75}
SLATE = {"h": 214, "s": 22, "b": -32, "c": -62}
DARKW = {"h": 20, "s": 40, "b": -55, "c": -85}
TEAL = {"h": 165, "s": 32, "b": -30, "c": -75}
ROOMS = [
    ("Dev A",   WALLX[0] + 1, TOP_IN[0], "desks6",  F_WOOD,  WOOD),
    ("Dev B",   WALLX[1] + 1, TOP_IN[0], "desks6",  F_WOOD,  WOOD),
    ("Design",  WALLX[2] + 1, TOP_IN[0], "design",  F_PLAIN, PINK),
    ("Meeting", WALLX[3] + 1, TOP_IN[0], "meeting", F_QUAD,  SLATE),
    ("Ops",     WALLX[0] + 1, BOT_IN[0], "desks6",  F_PLAIN, BLUE),
    ("Lab",     WALLX[1] + 1, BOT_IN[0], "lab",     F_CHECK, CHECK),
    ("Manager", WALLX[2] + 1, BOT_IN[0], "manager", F_WOOD,  DARKW),
    ("Lounge",  WALLX[3] + 1, BOT_IN[0], "lounge",  F_PLAIN, TEAL),
]

# ---- garden first (everything inside the 64x50 grid outside the building) ----
GRASS_A = {"h": 108, "s": 42, "b": -32, "c": -62}
GRASS_B = {"h": 104, "s": 44, "b": -38, "c": -62}
for r in range(TOPW, ROWS):
    for c in range(COLS):
        put(r, c, F_PLAIN, GRASS_A if (r + c) % 2 == 0 else GRASS_B)
for r in range(0, TOPW):                       # rows above the building stay void
    for c in range(COLS):
        put(r, c, VOID)

# ---- building shell ---------------------------------------------------------
fill(TOPW, WALLX[0], BOTW, WALLX[-1], WALL, WALLC)          # solid, rooms are carved out
for name, x0, y0, kind, ft, fc in ROOMS:
    y1 = TOP_IN[1] if y0 == TOP_IN[0] else BOT_IN[1]
    fill(y0, x0, y1, x0 + 11, ft, fc)
fill(HALL[0], WALLX[0] + 1, HALL[1], WALLX[-1] - 1, F_CHECK, CHECK)   # hallway

def door(cells, ft, fc):
    for r, c in cells:
        put(r, c, ft, fc)

for name, x0, y0, kind, ft, fc in ROOMS:
    top = y0 == TOP_IN[0]
    wall_row = MID1 if top else MID2
    door([(wall_row, x0 + 5), (wall_row, x0 + 6)], ft, fc)                    # to hallway
for i in range(3):                                                           # between rooms
    for rows in ((10, 11), (28, 29)):
        x = WALLX[i + 1]
        left = [r for r in ROOMS if r[1] == WALLX[i] + 1 and ((r[2] == TOP_IN[0]) == (rows[0] < 14))][0]
        door([(rows[0], x), (rows[1], x)], left[4], left[5])
door([(16, WALLX[0]), (17, WALLX[0])], F_CHECK, CHECK)                       # hall -> garden (left)
door([(16, WALLX[-1]), (17, WALLX[-1])], F_CHECK, CHECK)                     # hall -> garden (right)
PATH = {"h": 35, "s": 22, "b": -8, "c": -58}
door([(BOTW, 50), (BOTW, 51)], F_BRICK, PATH)                                # main entrance (south)

# ---- furniture ---------------------------------------------------------------
def wall_decor(x0, wall_row, kinds):
    """kinds: list of (type, dx); keeps the two door columns free."""
    for t, dx in kinds:
        add(t, wall_row - 1, x0 + dx)

for name, x0, y0, kind, ft, fc in ROOMS:
    top = y0 == TOP_IN[0]
    wr = TOPW if top else MID2
    g1, g2 = (4, 8) if top else (22, 26)
    if kind == "desks6":
        for r in (g1, g2):
            for dc in (0, 4, 8):
                desk_group(r, x0 + dc)
        wall_decor(x0, wr, [("DOUBLE_BOOKSHELF", 0), ("CLOCK", 3), ("DOUBLE_BOOKSHELF", 8), ("HANGING_PLANT", 11)])
        add("PLANT_2", y0 + 9, x0 + 11)
        add("BIN", g2 + 4, x0 + 0)
    elif kind == "design":
        for dc in (0, 4, 8):
            desk_group(g1, x0 + dc)
        lounge_set(g2, x0 + 5)
        wall_decor(x0, wr, [("LARGE_PAINTING", 0), ("SMALL_PAINTING", 3), ("SMALL_PAINTING_2", 8), ("LARGE_PAINTING", 10)])
        add("PLANT", g2, x0 + 0); add("LARGE_PLANT", g2 + 1, x0 + 10)
    elif kind == "meeting":
        for r in (4, 9):
            side_table(r, x0 + 4)
            add("PLANT", r, x0 + 0); add("LARGE_PLANT", r + 1, x0 + 9)
        wall_decor(x0, wr, [("WHITEBOARD", 0), ("CLOCK", 3), ("WHITEBOARD", 8), ("HANGING_PLANT", 11)])
    elif kind == "lab":
        for r in (22, 27):
            side_table(r, x0 + 4)
            add("PLANT_2", r, x0 + 0); add("LARGE_PLANT", r + 1, x0 + 9)
        wall_decor(x0, wr, [("DOUBLE_BOOKSHELF", 0), ("WHITEBOARD", 2), ("WHITEBOARD", 8), ("DOUBLE_BOOKSHELF", 10)])
    elif kind == "manager":
        for dc in (1, 7):
            desk_group(22, x0 + dc)
        lounge_set(26, x0 + 5)
        wall_decor(x0, wr, [("DOUBLE_BOOKSHELF", 0), ("LARGE_PAINTING", 2), ("SMALL_PAINTING", 8), ("DOUBLE_BOOKSHELF", 10)])
        add("PLANT", 22, x0 + 11); add("PLANT_2", 28, x0 + 0)
    elif kind == "lounge":
        lounge_set(23, x0 + 2); lounge_set(23, x0 + 8)
        # cafe counter
        add("SMALL_TABLE_FRONT", 28, x0 + 0); add("COFFEE", 28, x0 + 0); add("COFFEE", 29, x0 + 1)
        add("SMALL_TABLE_FRONT", 28, x0 + 10)
        wall_decor(x0, wr, [("SMALL_PAINTING", 0), ("LARGE_PAINTING", 2), ("LARGE_PAINTING", 8), ("SMALL_PAINTING_2", 11)])
        add("PLANT", 30, x0 + 3); add("PLANT_2", 30, x0 + 8); add("PLANT", 30, x0 + 11)

# hallway: benches (seats) + plants, decor on the south wall faces
for c in (8, 14, 22, 28, 34, 40, 48, 54):
    add("CUSHIONED_BENCH", 16, c); seats.append((16, c))
for c in (7, 20, 33, 46, 55):
    add("PLANT", 18, c)

# ---- garden ---------------------------------------------------------------------
WATER = {"h": 200, "s": 75, "b": -5, "c": -45}
STONE = {"h": 214, "s": 6, "b": -20, "c": -30}
POND = (37, 29, 41, 34)                          # r0, c0, r1, c1
fill(*POND, F_PLAIN, WATER)
for r in range(POND[0] - 1, POND[2] + 2):        # stone rim
    for c in range(POND[1] - 1, POND[3] + 2):
        if r in (POND[0] - 1, POND[2] + 1) or c in (POND[1] - 1, POND[3] + 1):
            put(r, c, F_BRICK, STONE)
add("FOUNTAIN", 38, 31)
for r in range(POND[0], POND[2] + 1):
    for c in range(POND[1], POND[3] + 1):
        blocked.add((r, c))                      # nobody wades into the pond
# stone path from the entrance to the pond rim
for r in range(BOTW + 1, POND[0]):
    for c in (50, 51):
        put(r, c, F_BRICK, PATH)
for c in range(POND[3] + 1, 52):
    put(34, c, F_BRICK, PATH)
for r in range(34, POND[0]):
    for c in (50, 51):
        put(r, c, F_BRICK, PATH)
for r in range(34, 35):
    for c in range(31, 52):
        put(r, c, F_BRICK, PATH)
for r in range(34, POND[0] - 1):
    put(r, 31, F_BRICK, PATH); put(r, 32, F_BRICK, PATH)
# benches around the pond, plants and trees
for c in (29, 31, 33):
    add("WOODEN_BENCH", POND[2] + 3, c)
for r in (38, 40):
    add("WOODEN_BENCH", r, POND[1] - 3); add("WOODEN_BENCH", r, POND[3] + 3)
rnd = random.Random(7)
spots = [(r, c) for r in range(34, 49) for c in range(2, 62)
         if (r, c) not in blocked and not (POND[0] - 2 <= r <= POND[2] + 5 and POND[1] - 5 <= c <= POND[3] + 5)
         and c not in (50, 51) and not (r == 34)]
rnd.shuffle(spots)
placed = []
for t in ["LARGE_PLANT"] * 7 + ["PLANT"] * 10 + ["PLANT_2"] * 8 + ["CACTUS"] * 4 + ["POT"] * 8:
    for (r, c) in spots:
        w, h = FP[t]
        cells = {(rr, cc) for rr in range(r, r + h) for cc in range(c, c + w)}
        if cells & blocked or any(abs(r - pr) < 4 and abs(c - pc) < 5 for pr, pc in placed):
            continue
        if r + h > ROWS - 1 or c + w > COLS - 1:
            continue
        add(t, r, c); placed.append((r, c)); break
# side gardens along the building (left / right of the walls)
for r in (6, 12, 24, 30):
    add("LARGE_PLANT", r, 1); add("LARGE_PLANT", r, 60)
for r in (9, 27):
    add("PLANT", r, 3); add("PLANT_2", r, 59)

layout = {"version": 1, "cols": COLS, "rows": ROWS, "layoutRevision": 2,
          "tiles": tiles, "tileColors": colors, "furniture": furniture}

# ---- checks -----------------------------------------------------------------------
def walkable(r, c):
    return 0 <= r < ROWS and 0 <= c < COLS and tiles[r * COLS + c] not in (WALL, VOID) and (r, c) not in blocked

seatset = set(seats)
def passable(r, c):
    return walkable(r, c) or (r, c) in seatset

start = (BOTW + 2, 50)
assert walkable(*start), "entrance not walkable"
seen = {start}; dq = collections.deque([start])
while dq:
    r, c = dq.popleft()
    for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        n = (r + dr, c + dc)
        if n not in seen and passable(*n):
            seen.add(n); dq.append(n)
unreach = [s for s in seats if s not in seen]
print(f"furniture={len(furniture)} seats={len(seats)} unreachable_seats={len(unreach)} {unreach[:6]}")
# walls must not hold floor furniture
bad = [(f["type"], f["row"], f["col"]) for f in furniture
       if f["type"].split(":")[0] not in WALL_ITEMS | OVERLAY
       and any(tiles[rr * COLS + cc] in (WALL, VOID)
               for rr in range(f["row"], f["row"] + FP[f["type"].split(":")[0]][1])
               for cc in range(f["col"], f["col"] + FP[f["type"].split(":")[0]][0]))]
print("floor furniture on wall/void:", bad[:8], len(bad))
overlap = collections.Counter()
occ = collections.defaultdict(list)
for f in furniture:
    b = f["type"].split(":")[0]
    if b in WALL_ITEMS | OVERLAY: continue
    w, h = FP[b]
    for rr in range(f["row"], f["row"] + h):
        for cc in range(f["col"], f["col"] + w):
            occ[(rr, cc)].append(b)
clash = {k: v for k, v in occ.items() if len(v) > 1}
print("overlapping furniture tiles:", len(clash), list(clash.items())[:5])

out_layout, out_assets = sys.argv[1], sys.argv[2]
json.dump(layout, open(out_layout, "w"))

# ---- fountain sprite (custom asset) --------------------------------------------------
d = os.path.join(out_assets, "assets", "furniture", "FOUNTAIN")
os.makedirs(d, exist_ok=True)
S = 32
im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
g = ImageDraw.Draw(im)
rim_d, rim_l, rim_m = (92, 98, 110, 255), (196, 201, 210, 255), (150, 156, 168, 255)
w_d, w_m, w_l = (45, 110, 170, 255), (74, 163, 223, 255), (143, 211, 244, 255)
g.ellipse((1, 9, 30, 30), fill=rim_d)
g.ellipse((2, 9, 29, 27), fill=rim_l)
g.ellipse((4, 11, 27, 25), fill=rim_m)
g.ellipse((5, 12, 26, 24), fill=w_d)
g.ellipse((5, 12, 26, 22), fill=w_m)
g.ellipse((8, 14, 23, 20), fill=w_l)
g.rectangle((14, 6, 17, 17), fill=rim_m); g.rectangle((14, 6, 15, 17), fill=rim_l); g.rectangle((17, 6, 17, 17), fill=rim_d)
g.ellipse((11, 3, 20, 8), fill=rim_l); g.ellipse((12, 4, 19, 8), fill=rim_m)
for x, y in ((15, 0), (16, 1), (13, 1), (18, 2), (11, 3), (20, 4), (9, 6), (22, 7)):
    g.point((x, y), fill=(210, 240, 255, 255))
for x, y in ((12, 2), (19, 2), (10, 5), (21, 6), (15, 2), (16, 2)):
    g.point((x, y), fill=w_l)
im.save(os.path.join(d, "FOUNTAIN.png"))
json.dump({"id": "FOUNTAIN", "name": "Fountain", "category": "decor", "type": "asset",
           "file": "FOUNTAIN.png", "width": 32, "height": 32, "footprintW": 2, "footprintH": 2,
           "canPlaceOnWalls": False, "canPlaceOnSurfaces": False, "backgroundTiles": 0},
          open(os.path.join(d, "manifest.json"), "w"), indent=2)

# ascii preview
sym = {WALL: "#", VOID: " ", F_WOOD: "w", F_PLAIN: ".", F_QUAD: "q", F_CHECK: "c", F_BRICK: "b"}
grid = [[sym.get(tiles[r * COLS + c], "?") for c in range(COLS)] for r in range(ROWS)]
for (r, c) in blocked:
    if 0 <= r < ROWS and 0 <= c < COLS: grid[r][c] = "X"
open(out_layout + ".txt", "w").write("\n".join("".join(row) for row in grid))
