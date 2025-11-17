from __future__ import annotations
import argparse
import json
import re
import sys
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple

# ---------- Entity map loading ----------

def load_entity_map(path: Optional[str]) -> Dict[str, str]:
    mapping: Dict[str, str] = {}
    if not path:
        # Try default in repo root
        default = Path(__file__).resolve().parents[1] / 'character_ids.json'
        
        # If running as PyInstaller bundle, check _MEIPASS
        if not default.exists() and hasattr(sys, '_MEIPASS'):
            default = Path(sys._MEIPASS) / 'character_ids.json'
        
        if default.exists():
            path = str(default)
        else:
            return mapping
    p = Path(path)
    if not p.exists():
        return mapping
    try:
        data = json.loads(p.read_text(encoding='utf-8'))
    except Exception:
        return mapping
    # Support either list of {id:name} or single dict
    if isinstance(data, list):
        for item in data:
            if isinstance(item, dict):
                for k, v in item.items():
                    mapping[str(k)] = str(v)
    elif isinstance(data, dict):
        for k, v in data.items():
            mapping[str(k)] = str(v)
    return mapping

# ---------- Normalization helpers ----------

def split_camel(s: str) -> List[str]:
    # Split CamelCase to words: 'HeroKnight' -> ['Hero', 'Knight']
    return re.sub('([a-z0-9])([A-Z])', r"\1 \2", s).split()

def normalize_name(key: str) -> str:
    key = key.replace('_', ' ').replace('-', ' ').strip()
    parts: List[str] = []
    for token in key.split():
        parts.extend(split_camel(token))
    norm = ' '.join(parts) if parts else key
    # collapse spaces
    norm = re.sub(r"\s+", " ", norm).strip()
    return norm.lower()

# ---------- Category detection ----------

CATEGORY_RULES = [
    ("audio", lambda p, fn: ("/wwiseaudio/" in p) or ("/audio/" in p) or ("/sound/" in p) or ("/sfx/" in p) or fn.endswith(('.bnk', '.wem', '.wav'))),
    ("ui", lambda p, fn: ("/ui/" in p) or ("/umg/" in p) or ("/slate/" in p)),
    ("vfx", lambda p, fn: ("/vfx/" in p) or ("/fx/" in p) or ("/niagara/" in p) or re.match(r"^(ns_|ps_|fx_)", fn)),
    ("animation", lambda p, fn: ("/animations/" in p) or ("/anims/" in p) or ("/animsequence/" in p) or ("/montages/" in p) or re.match(r"^(a_|am_)", fn)),
    ("mesh", lambda p, fn: ("/meshes/" in p) or ("/skeletalmeshes/" in p) or ("/staticmeshes/" in p) or re.match(r"^(sk_|sm_)", fn)),
    ("environment", lambda p, fn: ("/environment/" in p) or ("/environments/" in p) or ("/env/" in p) or ("/maps/" in p) or ("/levels/" in p) or ("/world/" in p)),
    ("map", lambda p, fn: fn.endswith(('.umap', '.world'))),
    ("texture", lambda p, fn: ("/textures/" in p) or re.match(r"^(t_)", fn)),
    ("material", lambda p, fn: ("/materials/" in p) or ("/materialfunctions/" in p) or ("/materialinstances/" in p) or re.match(r"^(m_|mi_|mf_)", fn)),
    ("blueprint", lambda p, fn: ("/blueprints/" in p) or re.match(r"^(bp_)", fn)),
]

# ---------- Entity detection ----------

ENTITY_SYNONYMS = {
    'characters','character','char','chars',
    'heroes','villains','pawns','npcs','enemies','units',
    'weapons','items','vehicles','outfits','skins','costumes'
}

# Generic folder names to ignore when guessing entity from path tail
STOPWORD_SEGMENTS = {
    'game','content','assets','asset','art','common','shared','global','core',
    'ui','hud','widgets','menus','interface','icons',
    'audio','sound','sounds','sfx','vo','voice','music','wwiseaudio',
    'vfx','fx','niagara','particles',
    'materials','materialinstances','materialfunctions',
    'textures','texture',
    'meshes','skeletalmeshes','staticmeshes','mesh',
    'animations','anims','animsequence','montages','animation',
    'blueprints','blueprint','bp',
    'maps','levels','level','world',
    'data','datatable','curve','curves','db',
    'props','environment','env','shaders','unknown','default'
}

def find_category(path: str) -> Optional[str]:
    p = path.replace('\\', '/').lower()
    fn = Path(p).name.lower()
    for cat, pred in CATEGORY_RULES:
        try:
            if pred(p, fn):
                return cat
        except Exception:
            continue
    return None

def find_entity_key(path_segments: List[str]) -> Tuple[Optional[str], Optional[str]]:
    # Returns (id4, alpha_key)
    for i, seg in enumerate(path_segments):
        seg_l = seg.lower()
        if seg_l in ENTITY_SYNONYMS and i + 1 < len(path_segments):
            nxt = path_segments[i + 1]
            nxt_clean = nxt.strip().strip('_-')
            if re.fullmatch(r"\d{4,}", nxt_clean):
                return nxt_clean[:4], None
            else:
                return None, nxt_clean
    # Prefer folder-based exact 4-digit ID nearest to the file (exclude filename)
    if path_segments:
        folder_segs = path_segments[:-1]  # exclude filename
        for seg in reversed(folder_segs):
            s = seg.strip().strip('_-')
            if re.fullmatch(r"\d{4}", s):
                return s, None
    # No structured folder hit: prefer 7-digit then 8-digit then 6-digit tokens near filename
    tail_segments = path_segments[-3:] if len(path_segments) >= 3 else path_segments
    for seg in reversed(tail_segments):
        # Exact 8-digit tokens -> drop leading digit, then take first 4 of the remaining 7
        for tok in re.findall(r"\d{8}", seg):
            return tok[1:5], None
        # Exact 7-digit tokens -> take first 4 as id4
        for tok in re.findall(r"\d{7}", seg):
            return tok[:4], None
        # 6-digit tokens -> take first 4 as id4
        for tok in re.findall(r"\d{6}", seg):
            return tok[:4], None
    # Fallback: choose the last meaningful folder name as alpha key
    for seg in reversed(path_segments):
        s = seg.strip()
        if not s or '.' in s:
            # likely filename with extension or empty
            continue
        s_l = s.lower().strip('_-')
        if s_l in STOPWORD_SEGMENTS:
            continue
        # skip folder tokens that are purely numeric or very short
        if s_l.isdigit() or len(s_l) < 3:
            continue
        return None, s
    return None, None

def resolve_entity(id4: Optional[str], alpha_key: Optional[str], entity_map: Dict[str, str]) -> str:
    # If the numeric id is known, return the canonical name from the mapping
    if id4 and id4 in entity_map:
        return entity_map[id4]
    # Fallback: try to match folder-derived alpha_key to known entity names (loose match)
    if alpha_key:
        # Build loose name map from character_ids values
        def loose(s: str) -> str:
            # Normalize for matching only: lowercase and strip non-alphanumerics
            return re.sub(r"[^a-z0-9]", "", normalize_name(s))
        known: Dict[str, str] = {}
        for v in entity_map.values():
            # Use original value for output so we "follow character_ids.json"
            k = loose(v)
            if k and k not in known:
                known[k] = v
        # Attempt match
        ak_norm = loose(alpha_key)
        if ak_norm in known:
            return known[ak_norm]
    return "unknown"

# ---------- Main tagging ----------

def tag_asset(path: str, entity_map: Dict[str, str]) -> str:
    # Normalize separators, strip
    raw = path.strip()
    if not raw:
        return ""
    norm = raw.replace('\\', '/').strip()
    segs = [s for s in norm.split('/') if s]
    cat = find_category(norm)
    id4, alpha_key = find_entity_key(segs)
    entity = resolve_entity(id4, alpha_key, entity_map)
    # Return empty string if no meaningful tags can be generated
    # Only return tags when we have both a known entity and category, or just a meaningful category
    if entity == "unknown":
        # Only return category if it's meaningful (not just "ui" or empty)
        return (cat or "").lower() if cat else ""
    if not cat:
        # Don't return entity with trailing comma if no category
        return ""
    return f"{entity},{cat}".lower()

# ---------- CLI ----------

def parse_args(argv=None):
    p = argparse.ArgumentParser(description="Generate 'entity,category' tags from UE asset paths.")
    p.add_argument('--map', dest='map_path', default=None, help='Optional JSON map file (e.g., character_ids.json)')
    p.add_argument('paths', nargs='*', help='Asset paths (if omitted, read from stdin)')
    return p.parse_args(argv)


def main(argv=None) -> int:
    args = parse_args(argv)
    entity_map = load_entity_map(args.map_path)
    inputs: List[str] = []
    if args.paths:
        inputs = args.paths
    else:
        # Read from stdin lines
        for line in sys.stdin:
            line = line.rstrip('\n')
            if line:
                inputs.append(line)
    for p in inputs:
        print(tag_asset(p, entity_map))
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
