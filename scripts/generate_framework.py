"""
Generates src/data/framework.ts and src/data/people.ts from the client's
"Mock Data _1Moby" workbook.

Usage:  python scripts/generate_framework.py "path/to/Mock Data _1Moby (2).xlsx"

The workbook is the source of truth for:
  * competency definitions and the 1-4 level descriptions (Thai)
  * the expected-level matrix per career role (Map Level sheet)
  * 22 employees with their self assessment and manager assessment scores
"""

import json
import re
import sys
from pathlib import Path

import openpyxl

if len(sys.argv) < 2:
    raise SystemExit(
        "usage: python scripts/generate_framework.py <path to Mock Data _1Moby.xlsx>"
    )

SRC = Path(sys.argv[1])
ROOT = Path(__file__).resolve().parent.parent
OUT_FRAMEWORK = ROOT / "src" / "data" / "framework.ts"
OUT_PEOPLE = ROOT / "src" / "data" / "people.ts"

wb = openpyxl.load_workbook(SRC, data_only=True)

# --------------------------------------------------------------- competencies

COMP_IDS = {
    "Create Impact": "create-impact",
    "Take Ownership": "take-ownership",
    "Adaptive": "adaptive",
    "Collaboration": "collaboration",
    "Process": "process",
    "Purpose": "purpose",
    "People": "people",
    "Result": "result",
    "Programming & Code Quality": "programming",
    "Software Architecture and Design": "architecture",
    "Databases & Data Management": "databases",
    "Code Version Control": "version-control",
    "Analytical Thinking & Time Management": "analytical",
}

# English mirrors of the Thai framework text (authored to match the workbook).
EN_NAME = {
    "create-impact": "Create Impact",
    "take-ownership": "Take Ownership",
    "adaptive": "Adaptive",
    "collaboration": "Collaboration",
    "process": "Process",
    "purpose": "Purpose",
    "people": "People",
    "result": "Result",
    "programming": "Programming & Code Quality",
    "architecture": "Software Architecture and Design",
    "databases": "Databases & Data Management",
    "version-control": "Code Version Control",
    "analytical": "Analytical Thinking & Time Management",
}

LEVEL_LABEL_EN = {
    4: "Exemplary",
    3: "Proficient",
    2: "Developing",
    1: "Needs Improvement",
}
LEVEL_LABEL_TH = {
    4: "ทำได้สม่ำเสมอ เป็นแบบอย่างให้กับผู้อื่น",
    3: "ทำได้ดีสม่ำเสมอ ตามบทบาทหน้าที่",
    2: "ทำได้บ้าง ยังต้องพัฒนา",
    1: "ยังไม่ทำ หรือทำในทางตรงข้าม",
}


def clean(v):
    if v is None:
        return ""
    return re.sub(r"[ \t]+", " ", str(v)).strip()


def score_of(text):
    m = re.match(r"\s*(\d)", str(text))
    return int(m.group(1)) if m else None


def read_competency_sheet(sheet, sub_col, score_col, desc_col, beh_col):
    ws = wb[sheet]
    items, cur = [], None
    for row in ws.iter_rows(min_row=2, values_only=True):
        if all(v is None for v in row[:6]):
            continue
        name = clean(row[0])
        if name:
            cur = {"nameTh": name, "definitionTh": clean(row[1]), "levels": [], "sub": ""}
            items.append(cur)
        if cur is None:
            continue
        if sub_col is not None and clean(row[sub_col]) and not cur["sub"]:
            cur["sub"] = clean(row[sub_col])
        sc = score_of(row[score_col]) if row[score_col] else None
        if sc:
            cur["levels"].append(
                {
                    "score": sc,
                    "descTh": clean(row[desc_col]),
                    "behaviorTh": clean(row[beh_col]).replace("\n", "\\n"),
                }
            )
    return items


core = read_competency_sheet("Core Competency", 2, 3, 4, 5)
managerial = read_competency_sheet("Managerial", 2, 3, 4, 5)
functional = read_competency_sheet("Fuctional For SE", None, 2, 3, 4)

groups = [("core", core), ("managerial", managerial), ("functional", functional)]

competencies = []
for group, items in groups:
    for it in items:
        raw = it["nameTh"]
        key = raw.strip()
        # the workbook truncates one functional name
        if key.startswith("Analytical Thinking"):
            key = "Analytical Thinking & Time Management"
        cid = COMP_IDS.get(key)
        if cid is None:
            print("!! unmapped competency:", repr(key))
            continue
        competencies.append(
            {
                "id": cid,
                "group": group,
                "name": EN_NAME[cid],
                "definitionTh": it["definitionTh"],
                "subTh": it["sub"],
                "levels": sorted(it["levels"], key=lambda x: -x["score"]),
            }
        )

# ------------------------------------------------------- expected level matrix

ws = wb["Map Level"]
rows = list(ws.iter_rows(min_row=1, max_row=25, values_only=True))
role_cols = {}
for r in rows:
    if clean(r[0]) == "Competency" and clean(r[2]).endswith("Senior"):
        for ci in range(2, 9):
            label = clean(r[ci])
            if label:
                role_cols[ci] = re.sub(r"^[\d\-\. ]+", "", label).strip()
        break

expected = {role: {} for role in role_cols.values()}
expected["Executive"] = {}

# core competencies: expectation 3 for everyone
for r in rows[1:5]:
    cid = COMP_IDS[clean(r[0])]
    for role in expected:
        expected[role][cid] = int(float(r[1]))

# functional: expectation 3 for everyone (workbook uses a single expected column)
for c in competencies:
    if c["group"] == "functional":
        for role in expected:
            expected[role][c["id"]] = 3

# managerial: the workbook repeats the block twice - a tick-mark version and a
# numeric version. Take the last header row, whose rows carry the numbers.
header_idx = [i for i, r in enumerate(rows) if clean(r[0]) == "Competency" and clean(r[2])]
numeric_start = header_idx[-1] + 1
for r in rows[numeric_start : numeric_start + 4]:
    key = clean(r[0]).strip()
    if key not in COMP_IDS:
        continue
    cid = COMP_IDS[key]
    if cid not in ("process", "purpose", "people", "result"):
        continue
    for ci, role in role_cols.items():
        val = r[ci]
        expected[role][cid] = int(float(val)) if isinstance(val, (int, float)) else None
    # Executive is explicitly not assessed on managerial competencies
    expected["Executive"][cid] = None

# ------------------------------------------------------------------- employees

ws = wb["Result"]
result_rows = [r for r in ws.iter_rows(min_row=3, values_only=True) if r[0] is not None]

SCORE_KEYS = [
    "create-impact",
    "take-ownership",
    "adaptive",
    "collaboration",
    "process",
    "purpose",
    "people",
    "result",
    "programming",
    "architecture",
    "databases",
    "version-control",
    "analytical",
]
SELF_AT, MGR_AT = 11, 28

# row number -> demo identity. Keeps the ids already used across the app.
IDENTITY = {
    1: ("vichai", "Vichai Somsak", "Chai"),
    2: ("emma", "Emma Wilson", "Em"),
    3: ("loraine", "Loraine Karli", "Lora"),
    4: ("deidra", "Deidra Yvette", "Dee"),
    5: ("sarah", "Sarah Chen", "Sara"),
    6: ("david", "David Kim", "Dave"),
    7: ("jessa", "Jessa Jacinda", "Jess"),
    8: ("unique", "Unique Catherin", "Cat"),
    9: ("pimchanok", "Pimchanok Aroon", "Pim"),
    10: ("boss", "Boss Kitty", "Boss"),
    11: ("michael", "Michael Lee", "Mike"),
    12: ("alpha", "Alpha Kellan", "Al"),
    13: ("josiah", "Josiah Rebeckah", "Jo"),
    14: ("joe", "Joe Lynne", "Joe"),
    15: ("kengkra", "Kengkra Samad", "Keng"),
    16: ("ilene", "Ilene Reene", "Ile"),
    17: ("nathakit", "Nathakit Pongpat", "Nat"),
    18: ("kanya", "Kanya Sirichai", "Kan"),
    19: ("thanet", "Thanet Rungroj", "Net"),
    20: ("worapon", "Worapon Meesuk", "Pon"),
    21: ("siriporn", "Siriporn Chaiwat", "Siri"),
    22: ("apisit", "Apisit Nakorn", "Sit"),
}

LEVEL_OF_ROLE = {
    "Executive": "Level 1: Operation",
    "Senior": "Level 2: Senior Operation",
    "Specialist": "Level 2: Senior Operation",
    "Team Lead": "Level 3: Supervise",
    "Specialist Lead": "Level 3: Supervise",
    "Manager": "Level 4: Management",
    "Expertise": "Level 5: Strategy",
    "Director": "Level 5: Strategy",
}
GRADE_OF_ROLE = {
    "Executive": "EX1",
    "Senior": "SR2",
    "Specialist": "SP2",
    "Team Lead": "TL1",
    "Specialist Lead": "SL1",
    "Manager": "MG1",
    "Expertise": "EP1",
    "Director": "EP3",
}

# who each person reports to, by demo id
REPORTS_TO = {
    "vichai": "neo",
    "emma": "vichai",
    "loraine": "emma",
    "deidra": "emma",
    "sarah": "emma",
    "david": "emma",
    "jessa": "emma",
    "unique": "emma",
    "pimchanok": "vichai",
    "boss": "vichai",
    "michael": "vichai",
    "alpha": "boss",
    "josiah": "boss",
    "joe": "boss",
    "kengkra": "boss",
    "ilene": "boss",
    "nathakit": "boss",
    "kanya": "vichai",
    "thanet": "kanya",
    "worapon": "kanya",
    "siriporn": "kanya",
    "apisit": "kanya",
}

DIVISION_FIX = {
    "Data Insight‚ Product Development": "Data Insight, Product Development",
    "Data Insight Product Development": "Data Insight, Product Development",
    "Data Insight‚Product Development": "Data Insight, Product Development",
    "Data Insigh Product Development": "Data Insight, Product Development",
    "MULTI-COMUNICATION Product Development": "MULTI-COMMUNICATION Product Development",
}

people = []
for r in result_rows:
    no = int(float(r[0]))
    ident = IDENTITY[no]
    role = clean(r[7])
    division = DIVISION_FIX.get(clean(r[9]), clean(r[9]))

    def block(at):
        out = {}
        for i, key in enumerate(SCORE_KEYS):
            v = r[at + i]
            if isinstance(v, (int, float)):
                out[key] = int(float(v))
        return out

    people.append(
        {
            "id": ident[0],
            "employeeId": str(int(float(r[1]))),
            "name": ident[1],
            "nickname": ident[2],
            "position": clean(r[6]),
            "jobRole": role,
            "level": LEVEL_OF_ROLE[role],
            "grade": GRADE_OF_ROLE[role],
            "department": clean(r[8]),
            "division": division,
            "businessUnit": clean(r[8]),
            "reportTo": REPORTS_TO[ident[0]],
            "selfScores": block(SELF_AT),
            "managerScores": block(MGR_AT),
        }
    )

# --------------------------------------------------------------------- emitters


def ts(v, indent=0):
    pad = "  " * indent
    if isinstance(v, str):
        return json.dumps(v, ensure_ascii=False)
    if isinstance(v, bool):
        return "true" if v else "false"
    if v is None:
        return "null"
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, list):
        if not v:
            return "[]"
        inner = ",\n".join(pad + "  " + ts(x, indent + 1) for x in v)
        return "[\n" + inner + "\n" + pad + "]"
    if isinstance(v, dict):
        if not v:
            return "{}"
        inner = ",\n".join(
            pad + "  " + (k if re.match(r"^[A-Za-z_$][A-Za-z0-9_$]*$", k) else json.dumps(k, ensure_ascii=False))
            + ": " + ts(val, indent + 1)
            for k, val in v.items()
        )
        return "{\n" + inner + "\n" + pad + "}"
    raise TypeError(type(v))


header = (
    "// GENERATED FILE - do not edit by hand.\n"
    "// Source: scripts/generate_framework.py + the client's \"Mock Data _1Moby\" workbook.\n\n"
)

framework = header + f"""export type Group = "core" | "functional" | "managerial";

export type RoleName =
  | "Executive"
  | "Senior"
  | "Specialist"
  | "Team Lead"
  | "Specialist Lead"
  | "Manager"
  | "Expertise"
  | "Director";

export type LevelDetail = {{
  score: number;
  labelEn: string;
  labelTh: string;
  descTh: string;
  behaviorTh: string;
}};

export type FrameworkCompetency = {{
  id: string;
  group: Group;
  name: string;
  definitionTh: string;
  subTh: string;
  levels: LevelDetail[];
}};

export const LEVEL_LABEL_EN: Record<number, string> = {ts({str(k): v for k, v in LEVEL_LABEL_EN.items()})};

export const LEVEL_LABEL_TH: Record<number, string> = {ts({str(k): v for k, v in LEVEL_LABEL_TH.items()})};

/** Competency framework straight out of the client workbook. */
export const FRAMEWORK: FrameworkCompetency[] = {ts([
    {
        "id": c["id"],
        "group": c["group"],
        "name": c["name"],
        "definitionTh": c["definitionTh"],
        "subTh": c["subTh"],
        "levels": [
            {
                "score": lv["score"],
                "labelEn": LEVEL_LABEL_EN[lv["score"]],
                "labelTh": LEVEL_LABEL_TH[lv["score"]],
                "descTh": lv["descTh"],
                "behaviorTh": lv["behaviorTh"],
            }
            for lv in c["levels"]
        ],
    }
    for c in competencies
])};

/**
 * Expected level per career role. `null` means the competency is not assessed
 * for that role - Executives, for example, are not assessed on Managerial.
 */
export const EXPECTED_BY_ROLE: Record<RoleName, Record<string, number | null>> = {ts(expected)};

export function expectedFor(role: string, competencyId: string): number | null {{
  const row = EXPECTED_BY_ROLE[role as RoleName];
  if (!row) return 3;
  const v = row[competencyId];
  return v === undefined ? 3 : v;
}}

export function isAssessed(role: string, competencyId: string): boolean {{
  return expectedFor(role, competencyId) !== null;
}}
"""

OUT_FRAMEWORK.write_text(framework, encoding="utf-8")
print("wrote", OUT_FRAMEWORK, len(framework), "chars")

people_ts = header + f"""export const RAW_PEOPLE = {ts(people)} as const;
"""
(ROOT / "src" / "data" / "people.generated.ts").write_text(people_ts, encoding="utf-8")
print("wrote people.generated.ts", len(people_ts), "chars")
print("competencies:", len(competencies), "people:", len(people))
print("roles:", sorted(expected.keys()))
