

import requests, os

API_KEY = "PhrRky7c5F7tKmdgPfr4Pgysj8FnViJxJuVPrAMnpvuPpZqS/g==--9S1Pqt+a/SVjJfsW--kbc5zktMJuy/y2HxgLtVHw=="
GAME = "marvelrivals"
MOD_ID = 1727          # <-- correct mod id
OUT = "nexus_images"

headers = {"apikey": API_KEY, "Accept": "application/json"}
media_url = f"https://api.nexusmods.com/v1/games/{GAME}/mods/{MOD_ID}/media.json"

r = requests.get(media_url, headers=headers)
if r.status_code == 200:
    items = r.json()
    os.makedirs(OUT, exist_ok=True)
    i = 1
    for itm in items:
        if itm.get("category") == "image":
            img_url = itm.get("uri") or itm.get("thumbnail")
            if img_url:
                data = requests.get(img_url).content
                with open(f"{OUT}/img_{i}.jpg", "wb") as f:
                    f.write(data)
                i += 1
    print("Done.")
else:
    print("Error", r.status_code, r.text)
