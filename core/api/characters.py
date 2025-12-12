"""
API endpoints for Marvel Rivals character and skin data.
"""

from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from core.db.db import get_connection, get_all_characters, get_character_skins
from core.extraction.service import extract_and_ingest


router = APIRouter(prefix="/api", tags=["characters"])


class CharacterSkin(BaseModel):
    variant: str
    name: str


class Character(BaseModel):
    character_id: str
    name: str
    skins: List[CharacterSkin]


class RebuildResponse(BaseModel):
    success: bool
    message: str
    characters_count: int
    skins_count: int


@router.get("/characters", response_model=List[Character])
async def list_characters():
    """
    Get all characters with their skins.
    """
    conn = get_connection()
    try:
        characters = get_all_characters(conn)
        return characters
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch characters: {str(e)}")
    finally:
        conn.close()


@router.get("/characters/{character_id}/skins", response_model=List[CharacterSkin])
async def list_character_skins(character_id: str):
    """
    Get all skins for a specific character.
    """
    conn = get_connection()
    try:
        skins = get_character_skins(conn, character_id)
        if not skins:
            # Check if character exists
            cur = conn.cursor()
            char_exists = cur.execute(
                "SELECT COUNT(*) FROM characters WHERE character_id = ?",
                (character_id,)
            ).fetchone()[0] > 0
            
            if not char_exists:
                raise HTTPException(status_code=404, detail=f"Character {character_id} not found")
        
        return skins
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch skins: {str(e)}")
    finally:
        conn.close()


class TagLookupRequest(BaseModel):
    tags: List[str]


class TagInfo(BaseModel):
    type: str  # "character" or "skin"
    character_id: str | None = None
    parent: str | None = None  # Primary parent (first match)
    parents: List[str] = []    # All possible parents for disambiguation


@router.post("/characters/lookup-tags", response_model=Dict[str, TagInfo])
async def lookup_tags(request: TagLookupRequest):
    """
    Lookup tags to determine which are characters and which are skins.
    Returns mapping of tag -> {type: 'character'|'skin', character_id?, parent?, parents[]}
    
    This is used by the frontend to properly build hierarchical character-skin filters.
    """
    conn = get_connection()
    try:
        result: Dict[str, TagInfo] = {}
        
        for tag in request.tags:
            tag_lower = tag.lower()
            
            # Check if it's a character name
            cur = conn.cursor()
            char = cur.execute(
                "SELECT character_id FROM characters WHERE LOWER(name) = ?",
                (tag_lower,)
            ).fetchone()
            
            if char:
                result[tag] = TagInfo(
                    type="character",
                    character_id=char[0],
                    parent=None,
                    parents=[]
                )
                continue
            
            # Check if it's a skin name - fetch ALL matches to handle ambiguity
            # e.g. "The Life Fantastic" -> ["Mister Fantastic", "Invisible Woman"]
            skins = cur.execute(
                """SELECT s.character_id, c.name 
                   FROM skins s 
                   JOIN characters c ON s.character_id = c.character_id 
                   WHERE LOWER(s.name) = ?""",
                (tag_lower,)
            ).fetchall()
            
            if skins:
                # Aggregate all parents
                all_parents = sorted(list(set(row[1] for row in skins)))
                
                # Use first found as primary for backward compat
                primary_skin = skins[0]
                
                result[tag] = TagInfo(
                    type="skin",
                    character_id=primary_skin[0],
                    parent=primary_skin[1],
                    parents=all_parents
                )
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to lookup tags: {str(e)}")
    finally:
        conn.close()


@router.post("/rebuild-character-data", response_model=RebuildResponse)
async def rebuild_character_data():
    """
    Rebuild character and skin data by re-extracting from PAK files.
    This will delete all existing character data and re-populate from game files.
    """
    try:
        # Run extraction and ingestion
        extract_and_ingest()
        
        # Get counts
        conn = get_connection()
        try:
            cur = conn.cursor()
            char_count = cur.execute("SELECT COUNT(*) FROM characters").fetchone()[0]
            skin_count = cur.execute("SELECT COUNT(*) FROM skins").fetchone()[0]
            
            return RebuildResponse(
                success=True,
                message=f"Successfully rebuilt character data",
                characters_count=char_count,
                skins_count=skin_count
            )
        finally:
            conn.close()
            
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to rebuild character data: {str(e)}"
        )
