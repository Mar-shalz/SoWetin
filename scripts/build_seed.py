#!/usr/bin/env python3
"""
Builds data/ingredients-seed.json and data/catalogue-seed.json for the SoWetin pack.

Everything here is DRAFT seed data. Components are status "draft": a human must review
names, tags, ingredients, quantities (added later by the authoring pipeline, doc 05) and
illustrations before anything is published. Market unit sizes and prices are placeholders
except where a public source is cited.

Run: python3 scripts/build_seed.py
"""
import json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

# ---------------------------------------------------------------------------
# Allergen vocabulary (doc 05 section 2.4)
ALLERGENS = ["crustacean", "mollusc", "fish", "groundnut", "tree_nut", "coconut",
             "egg", "dairy", "gluten", "soy", "sesame"]

# ---------------------------------------------------------------------------
# Ingredients
# (slug, name, category, canonical_unit, allergens, may_contain, animal, pork, pantry flag (replaced by house_group below),
#  local_names, market_units[(label, qty, is_minimum, sellable)])
# Quantities in market units are PLACEHOLDERS to be replaced by weighing during the survey.
I = []
def ing(slug, name, cat, unit, allergens=(), animal=False, pantry=False, local=None,
        units=(), may=(), pork=False):
    I.append(dict(slug=slug, name=name, category=cat, canonical_unit=unit,
                  allergens=list(allergens), may_contain=list(may), animal=animal, pork=pork,
                  pantry_staple=pantry, local_names=local or {},
                  market_units=[dict(label=u[0], canonical_qty=u[1], is_minimum=u[2],
                                     sellable=u[3], placeholder=True) for u in units]))

g, ml, pc = "g", "ml", "piece"
# Grains, flours and swallow bases
ing("rice-local-parboiled", "Local rice (parboiled)", "grains_flours", g, pantry=True,
    units=[("derica", 750, True, True), ("paint bucket", 4000, False, True), ("50 kg bag", 50000, False, False)])
ing("rice-foreign-parboiled", "Foreign long-grain rice (parboiled)", "grains_flours", g, pantry=True,
    units=[("derica", 750, True, True), ("paint bucket", 4000, False, True), ("50 kg bag", 50000, False, False)])
ing("ofada-rice", "Ofada rice", "grains_flours", g, units=[("derica", 700, True, True), ("paint bucket", 3800, False, True)])
ing("garri-white", "White garri", "grains_flours", g, pantry=True, local={"yo": "gaari funfun"},
    units=[("cup", 250, True, True), ("paint bucket", 3000, False, True), ("50 kg bag", 50000, False, False)])
ing("garri-yellow", "Yellow garri", "grains_flours", g, pantry=True,
    units=[("cup", 250, True, True), ("paint bucket", 3000, False, True), ("50 kg bag", 50000, False, False)])
ing("yam-flour", "Yam flour (elubo)", "grains_flours", g, local={"yo": "elubo"},
    units=[("cup", 200, True, True), ("1 kg pack", 1000, False, True)])
ing("cassava-flour", "Cassava flour (lafun)", "grains_flours", g, local={"yo": "lafun"},
    units=[("cup", 200, True, True), ("1 kg pack", 1000, False, True)])
ing("semolina", "Semolina (semo)", "grains_flours", g, allergens=["gluten"], pantry=True,
    units=[("1 kg pack", 1000, True, True), ("2 kg pack", 2000, False, True)])
ing("wheat-meal", "Wheat meal (for swallow)", "grains_flours", g, allergens=["gluten"],
    units=[("1 kg pack", 1000, True, True), ("5 kg pack", 5000, False, True)])
ing("fufu-cassava", "Cassava fufu paste (akpu)", "grains_flours", g, local={"ig": "akpu", "yo": "fufu"},
    units=[("wrap", 400, True, True)])
ing("plantain-flour", "Unripe plantain flour", "grains_flours", g, units=[("1 kg pack", 1000, True, True)])
ing("maize-dry", "Dry maize (corn)", "grains_flours", g, local={"ha": "masara"},
    units=[("cup", 220, True, True), ("50 kg bag", 50000, False, False)])
ing("maize-flour", "Maize flour", "grains_flours", g, units=[("1 kg pack", 1000, True, True)])
ing("millet", "Millet", "grains_flours", g, local={"ha": "gero"}, units=[("cup", 220, True, True)])
ing("rice-flour", "Rice flour / short-grain rice for tuwo", "grains_flours", g, units=[("derica", 750, True, True)])
ing("ogi-paste", "Pap paste (ogi / akamu)", "grains_flours", g, local={"yo": "ogi", "ig": "akamu", "ha": "koko"},
    units=[("wrap", 300, True, True)])
ing("agidi-wrap", "Agidi (eko)", "grains_flours", g, local={"yo": "eko"}, units=[("wrap", 150, True, True)])
ing("wheat-flour", "Wheat flour", "grains_flours", g, allergens=["gluten"], pantry=True,
    units=[("1 kg pack", 1000, True, True), ("cup", 130, False, True)])
ing("cassava-starch", "Cassava starch (usi)", "grains_flours", g, local={"urh": "usi"}, units=[("cup", 200, True, True)])
ing("oats", "Rolled oats", "grains_flours", g, allergens=["gluten"], units=[("500 g pack", 500, True, True)])
ing("custard-powder", "Custard powder", "packaged", g, units=[("400 g tin", 400, True, True)])
ing("teff-flour", "Teff flour", "grains_flours", g, units=[("1 kg pack", 1000, True, True)])
ing("couscous-attieke", "Attiéké (cassava couscous)", "grains_flours", g, units=[("500 g pack", 500, True, True)])
ing("maize-meal-white", "White maize meal", "grains_flours", g, units=[("1 kg pack", 1000, True, True)])
# Pasta, bread, packaged
ing("spaghetti", "Spaghetti", "packaged", g, allergens=["gluten"], pantry=True, units=[("500 g pack", 500, True, True)])
ing("macaroni", "Macaroni", "packaged", g, allergens=["gluten"], units=[("500 g pack", 500, True, True)])
ing("instant-noodles", "Instant noodles", "packaged", pc, allergens=["gluten"], may=["soy"],
    units=[("pack", 1, True, True), ("carton", 40, False, True)])
ing("agege-bread", "Agege bread", "packaged", pc, allergens=["gluten"], may=["egg", "dairy"],
    units=[("small loaf", 1, True, True)])
ing("tomato-paste", "Tomato paste", "packaged", g, pantry=True, units=[("sachet", 70, True, True), ("tin", 210, False, True)])
ing("corned-beef", "Corned beef (tinned)", "packaged", g, animal=True, units=[("tin", 340, True, True)])
ing("sardines", "Sardines (tinned)", "packaged", g, allergens=["fish"], animal=True, units=[("tin", 125, True, True)])
ing("sweet-corn-tin", "Sweet corn (tinned)", "packaged", g, units=[("tin", 340, True, True)])
ing("baked-beans", "Baked beans (tinned)", "packaged", g, units=[("tin", 400, True, True)])
ing("mayonnaise", "Mayonnaise", "packaged", g, allergens=["egg"], may=["soy", "dairy"], units=[("small jar", 250, True, True)])
ing("baking-powder", "Baking powder", "packaged", g, pantry=True, units=[("sachet", 10, True, True)])
ing("yeast", "Dry yeast", "packaged", g, units=[("sachet", 10, True, True)])
ing("sugar", "Sugar", "packaged", g, pantry=True, units=[("cup", 200, True, True), ("1 kg pack", 1000, False, True)])
ing("tea-bags", "Tea bags", "packaged", pc, units=[("pack of 26", 26, True, True)])
ing("milk-evaporated", "Evaporated milk", "dairy_eggs", ml, allergens=["dairy"], animal=True, units=[("tin", 160, True, True)])
ing("milk-powder", "Milk powder", "dairy_eggs", g, allergens=["dairy"], animal=True, units=[("sachet", 16, True, True), ("400 g tin", 400, False, True)])
ing("fresh-cheese-wara", "Wara (local soft cheese)", "dairy_eggs", g, allergens=["dairy"], animal=True, local={"yo": "wara", "ha": "cuku"},
    units=[("piece", 150, True, True)])
ing("nono", "Nono (fermented milk)", "dairy_eggs", ml, allergens=["dairy"], animal=True, local={"ha": "nono"},
    units=[("bottle", 500, True, True)])
ing("butter-margarine", "Margarine", "oils_fats", g, may=["dairy", "soy"], units=[("250 g tub", 250, True, True)])
# Legumes, nuts, seeds
ing("beans-brown", "Brown beans (oloyin)", "legumes", g, local={"yo": "ewa oloyin"},
    units=[("cup", 250, True, True), ("derica", 750, False, True), ("paint bucket", 3800, False, True), ("50 kg bag", 50000, False, False)])
ing("beans-white", "White beans (black-eyed)", "legumes", g, local={"yo": "ewa funfun"},
    units=[("cup", 250, True, True), ("derica", 750, False, True), ("paint bucket", 3800, False, True)])
ing("egusi-ground", "Ground egusi (melon seed)", "nuts_seeds", g, local={"yo": "egusi", "ig": "egwusi", "ha": "agushi"},
    units=[("cup", 150, True, True), ("derica", 400, False, True)])
ing("ogbono-ground", "Ground ogbono", "nuts_seeds", g, local={"yo": "apon", "ig": "ogbono"},
    units=[("₦ cup", 80, True, True)])
ing("groundnuts", "Groundnuts (peanuts)", "nuts_seeds", g, allergens=["groundnut"], local={"yo": "epa", "ha": "gyada"},
    units=[("cup", 150, True, True)])
ing("groundnut-paste", "Groundnut paste", "nuts_seeds", g, allergens=["groundnut"], units=[("jar", 340, True, True)])
ing("tiger-nuts", "Tiger nuts", "nuts_seeds", g, local={"ha": "aya", "yo": "imumu"}, units=[("cup", 150, True, True)])
ing("ukwa-breadfruit", "African breadfruit (ukwa)", "legumes", g, local={"ig": "ukwa"}, units=[("cup", 200, True, True)])
ing("ugba", "Ugba (oil bean slices)", "nuts_seeds", g, local={"ig": "ugba"}, units=[("wrap", 100, True, True)])
ing("palm-nut", "Palm nuts / palm fruit concentrate", "oils_fats", g, local={"ig": "akwu", "urh": "amiedi"},
    units=[("tin concentrate", 800, True, True), ("cup fresh nuts", 300, False, True)])
ing("coconut", "Coconut", "fruits", pc, allergens=["coconut"], units=[("piece", 1, True, True)])
ing("sesame-seeds", "Sesame seeds", "nuts_seeds", g, allergens=["sesame"], units=[("small pack", 100, True, True)])
# Tubers, plantain
ing("yam", "Yam", "tubers_plantain", g, local={"yo": "isu", "ig": "ji", "ha": "doya"},
    units=[("small tuber", 1200, True, True), ("medium tuber", 2000, False, True)])
ing("water-yam", "Water yam (ewura)", "tubers_plantain", g, local={"yo": "ewura", "ig": "mbala"}, units=[("tuber", 1500, True, True)])
ing("plantain-ripe", "Ripe plantain", "tubers_plantain", pc, local={"yo": "dodo", "ig": "ogede"}, units=[("finger", 1, True, True), ("bunch", 12, False, False)])
ing("plantain-unripe", "Unripe plantain", "tubers_plantain", pc, units=[("finger", 1, True, True)])
ing("sweet-potato", "Sweet potato", "tubers_plantain", g, local={"ha": "dankali"}, units=[("heap", 1500, True, True)])
ing("irish-potato", "Irish potatoes", "tubers_plantain", g, units=[("heap", 1200, True, True)])
ing("cocoyam", "Cocoyam", "tubers_plantain", g, local={"ig": "ede", "yo": "koko"}, units=[("heap", 1000, True, True)])
ing("cassava-abacha", "Dried shredded cassava (abacha)", "tubers_plantain", g, local={"ig": "abacha"}, units=[("wrap", 300, True, True)])
ing("fresh-corn", "Fresh corn on the cob", "vegetables_fresh", pc, units=[("cob", 1, True, True)])
ing("ube-pear", "African pear (ube)", "fruits", pc, local={"ig": "ube", "yo": "elemi"}, units=[("heap of 6", 6, True, True)])
# Pepper, tomato, onion, fresh vegetables
ing("tomato-fresh", "Fresh tomatoes", "pepper_tomato_onion", g, local={"yo": "tomati"},
    units=[("heap", 900, True, True), ("kg", 1000, False, True), ("big basket", 25000, False, False)])
ing("tatashe", "Red bell pepper (tatashe)", "pepper_tomato_onion", g, local={"yo": "tatashe"},
    units=[("heap", 600, True, True)])
ing("scotch-bonnet", "Scotch bonnet pepper (ata rodo)", "pepper_tomato_onion", g, local={"yo": "ata rodo", "ig": "ose"},
    units=[("₦ mix", 120, True, True)])
ing("green-pepper-ayamase", "Green bell pepper and green scotch bonnet", "pepper_tomato_onion", g,
    units=[("heap", 600, True, True)])
ing("onion", "Onions", "pepper_tomato_onion", g, local={"yo": "alubosa", "ha": "albasa"},
    units=[("piece", 150, True, True), ("heap of 5", 750, False, True)])
ing("garlic", "Garlic", "pepper_tomato_onion", g, units=[("bulb", 40, True, True)])
ing("ginger", "Ginger", "pepper_tomato_onion", g, units=[("₦ piece", 80, True, True)])
ing("spring-onion", "Spring onions", "vegetables_fresh", g, units=[("bunch", 100, True, True)])
ing("carrot", "Carrots", "vegetables_fresh", g, units=[("heap", 500, True, True)])
ing("cabbage", "Cabbage", "vegetables_fresh", g, units=[("small head", 800, True, True)])
ing("cucumber", "Cucumber", "vegetables_fresh", pc, units=[("piece", 1, True, True)])
ing("green-beans", "Green beans", "vegetables_fresh", g, units=[("heap", 300, True, True)])
ing("lettuce", "Lettuce", "vegetables_fresh", g, units=[("head", 300, True, True)])
ing("garden-egg", "Garden egg", "vegetables_fresh", g, local={"yo": "igba", "ig": "anara"}, units=[("heap", 500, True, True)])
ing("okra", "Okra", "vegetables_fresh", g, local={"yo": "ila", "ig": "okwuru", "ha": "kubewa"}, units=[("heap", 400, True, True)])
ing("pumpkin", "Pumpkin", "vegetables_fresh", g, local={"ha": "kabewa"}, units=[("slice", 600, True, True)])
ing("peas-green", "Green peas", "vegetables_fresh", g, units=[("cup", 150, True, True)])
# Leaves and herbs
ing("ugu", "Ugu (fluted pumpkin leaves)", "leaves_herbs", g, local={"ig": "ugu", "yo": "efo elegede"}, units=[("bunch", 250, True, True)])
ing("efo-shoko-tete", "Efo shoko / tete (spinach, amaranth)", "leaves_herbs", g, local={"yo": "efo shoko"}, units=[("bunch", 300, True, True)])
ing("bitterleaf", "Bitterleaf (washed)", "leaves_herbs", g, local={"ig": "onugbu", "yo": "ewuro"}, units=[("wrap", 150, True, True)])
ing("waterleaf", "Waterleaf", "leaves_herbs", g, units=[("bunch", 300, True, True)])
ing("ewedu-leaves", "Ewedu (jute leaves)", "leaves_herbs", g, local={"yo": "ewedu"}, units=[("bunch", 250, True, True)])
ing("oha-leaves", "Oha leaves", "leaves_herbs", g, local={"ig": "oha"}, units=[("wrap", 150, True, True)])
ing("afang-leaves", "Afang (okazi) leaves, sliced", "leaves_herbs", g, local={"ef": "afang", "ig": "okazi"}, units=[("wrap", 150, True, True)])
ing("uziza-leaves", "Uziza leaves", "leaves_herbs", g, local={"ig": "uziza"}, units=[("bunch", 50, True, True)])
ing("scent-leaf", "Scent leaf", "leaves_herbs", g, local={"yo": "efinrin", "ig": "nchanwu", "ha": "daidoya"}, units=[("bunch", 60, True, True)])
ing("utazi", "Utazi leaves", "leaves_herbs", g, local={"ig": "utazi"}, units=[("bunch", 30, True, True)])
ing("atama-leaves", "Atama (beletete) leaves", "leaves_herbs", g, local={"ef": "atama"}, units=[("wrap", 150, True, True)])
ing("baobab-leaf-powder", "Baobab leaf powder (kuka)", "leaves_herbs", g, local={"ha": "kuka"}, units=[("cup", 60, True, True)])
ing("ndole-leaves", "Bitterleaf for ndolé", "leaves_herbs", g, units=[("wrap", 150, True, True)])
ing("eru-leaves", "Eru (okazi) leaves, shredded", "leaves_herbs", g, units=[("wrap", 150, True, True)])
ing("kale-sukuma", "Kale (sukuma wiki)", "leaves_herbs", g, units=[("bunch", 300, True, True)])
ing("thyme", "Dried thyme", "seasoning_spices", g, pantry=True, units=[("sachet", 10, True, True)])
ing("bay-leaves", "Bay leaves", "seasoning_spices", g, pantry=True, units=[("sachet", 5, True, True)])
ing("hibiscus-zobo", "Dried hibiscus (zobo leaves)", "leaves_herbs", g, local={"ha": "yakuwa"}, units=[("cup", 60, True, True)])
# Oils
ing("palm-oil", "Palm oil", "oils_fats", ml, pantry=True, local={"yo": "epo pupa", "ig": "mmanu nri"},
    units=[("75 cl bottle", 750, True, True), ("1 litre", 1000, False, True), ("5 litre", 5000, False, True)])
ing("vegetable-oil", "Vegetable oil", "oils_fats", ml, pantry=True,
    units=[("75 cl bottle", 750, True, True), ("1 litre", 1000, False, True), ("5 litre", 5000, False, True)])
# Seasoning and spices
ing("salt", "Salt", "seasoning_spices", g, pantry=True, units=[("500 g pack", 500, True, True)])
ing("seasoning-cube", "Seasoning cubes", "seasoning_spices", pc, may=["gluten", "soy"], pantry=True,
    units=[("piece", 1, True, True), ("pack of 50", 50, False, True)])
ing("curry-powder", "Curry powder", "seasoning_spices", g, pantry=True, units=[("sachet", 10, True, True)])
ing("iru", "Iru (locust beans)", "seasoning_spices", g, local={"yo": "iru", "ig": "ogiri okpei", "ha": "dawadawa"}, units=[("wrap", 40, True, True)])
ing("ogiri", "Ogiri (fermented seasoning)", "seasoning_spices", g, local={"ig": "ogiri"}, units=[("wrap", 30, True, True)])
ing("crayfish", "Ground crayfish", "seasoning_spices", g, allergens=["crustacean"], animal=True,
    local={"yo": "ede", "ig": "ayu"}, units=[("₦500 wrap", 30, True, True), ("cup", 80, False, True)])
ing("ehuru", "Calabash nutmeg (ehuru)", "seasoning_spices", g, local={"ig": "ehuru", "yo": "ariwo"}, units=[("wrap", 15, True, True)])
ing("uziza-seeds", "Uziza seeds", "seasoning_spices", g, units=[("wrap", 15, True, True)])
ing("pepper-soup-spice", "Pepper soup spice mix", "seasoning_spices", g, units=[("sachet", 30, True, True)])
ing("suya-spice", "Suya spice (yaji)", "seasoning_spices", g, allergens=["groundnut"], local={"ha": "yaji"}, units=[("wrap", 50, True, True)])
ing("dried-pepper", "Dry ground pepper (cameroon pepper)", "seasoning_spices", g, units=[("wrap", 30, True, True)])
ing("nutmeg", "Nutmeg", "seasoning_spices", g, units=[("piece", 5, True, True)])
ing("ofada-spice", "Ofada and nsala spices (uda, uziza)", "seasoning_spices", g, units=[("wrap", 20, True, True)])
ing("potash-akanwu", "Potash (akanwu / kaun)", "seasoning_spices", g, local={"ig": "akanwu", "yo": "kaun"}, units=[("lump", 10, True, True)])
ing("shito", "Shito (Ghanaian pepper sauce)", "seasoning_spices", g, allergens=["fish", "crustacean"], animal=True, units=[("jar", 250, True, True)])
ing("berbere", "Berbere spice", "seasoning_spices", g, units=[("pack", 100, True, True)])
ing("chilli-chakalaka-spice", "Curry and chilli mix", "seasoning_spices", g, units=[("sachet", 20, True, True)])
ing("lemon", "Lemon or lime", "fruits", pc, units=[("piece", 1, True, True)])
ing("cloves-ginger-mix", "Cloves and ginger (for zobo, kunu)", "seasoning_spices", g, units=[("wrap", 20, True, True)])
ing("pineapple", "Pineapple", "fruits", pc, units=[("piece", 1, True, True)])
# Meat, poultry
ing("beef", "Beef", "meat", g, animal=True, local={"yo": "eran malu", "ha": "naman sa"},
    units=[("₦2,000 portion", 250, True, True), ("kg", 1000, False, True)])
ing("goat-meat-raw", "Goat meat", "meat", g, animal=True, local={"yo": "eran ewure", "ig": "anu ewu"},
    units=[("₦2,500 portion", 250, True, True), ("kg", 1000, False, True)])
ing("goat-head", "Goat head (cut)", "meat", pc, animal=True, units=[("head", 1, True, True)])
ing("cow-foot", "Cow foot (nkwobi cut)", "meat", g, animal=True, local={"ig": "nkwobi"}, units=[("₦ portion", 500, True, True)])
ing("shaki-tripe", "Shaki (tripe)", "meat", g, animal=True, local={"yo": "shaki"}, units=[("₦ portion", 250, True, True)])
ing("ponmo-cowskin", "Ponmo (cow skin)", "meat", g, animal=True, local={"yo": "ponmo", "ig": "kpomo"}, units=[("piece", 120, True, True)])
ing("chicken", "Chicken (cut)", "poultry", g, animal=True, units=[("piece", 200, True, True), ("kg", 1000, False, True), ("whole bird", 1500, False, True)])
ing("turkey", "Turkey (cut)", "poultry", g, animal=True, units=[("piece", 250, True, True), ("kg", 1000, False, True)])
ing("gizzard", "Chicken gizzard", "poultry", g, animal=True, units=[("₦ portion", 250, True, True), ("kg", 1000, False, True)])
ing("eggs", "Eggs", "dairy_eggs", pc, allergens=["egg"], animal=True, units=[("piece", 1, True, True), ("crate of 30", 30, False, True)])
ing("snail", "Snails (cleaned)", "meat", pc, allergens=["mollusc"], animal=True, local={"yo": "igbin", "ig": "ejula"}, units=[("piece", 1, True, True)])
# Fish and seafood
ing("fish-titus", "Titus (mackerel)", "fish_seafood", pc, allergens=["fish"], animal=True, local={"yo": "eja kika"}, units=[("piece", 1, True, True)])
ing("fish-croaker", "Croaker fish", "fish_seafood", pc, allergens=["fish"], animal=True, units=[("piece", 1, True, True)])
ing("catfish-fresh", "Fresh catfish", "fish_seafood", g, allergens=["fish"], animal=True, local={"yo": "eja aro"}, units=[("small fish", 800, True, True), ("kg", 1000, False, True)])
ing("catfish-smoked", "Smoked catfish", "fish_seafood", pc, allergens=["fish"], animal=True, units=[("piece", 1, True, True)])
ing("stockfish", "Stockfish", "fish_seafood", g, allergens=["fish"], animal=True, local={"yo": "panla", "ig": "okporoko"}, units=[("₦ portion", 80, True, True)])
ing("dried-fish", "Dried fish", "fish_seafood", g, allergens=["fish"], animal=True, units=[("₦ portion", 80, True, True)])
ing("tilapia", "Tilapia", "fish_seafood", pc, allergens=["fish"], animal=True, units=[("piece", 1, True, True)])
ing("prawns", "Prawns / shrimps", "fish_seafood", g, allergens=["crustacean"], animal=True, units=[("cup", 150, True, True)])
ing("periwinkle", "Periwinkle", "fish_seafood", g, allergens=["mollusc"], animal=True, local={"ef": "mfi"}, units=[("cup", 150, True, True)])
ing("clams", "Clams (ngolo)", "fish_seafood", g, allergens=["mollusc"], animal=True, units=[("cup", 150, True, True)])
ing("crab", "Crab", "fish_seafood", pc, allergens=["crustacean"], animal=True, units=[("piece", 1, True, True)])
ing("bush-meat-smoked", "Smoked meat or fish for soups", "fish_seafood", g, allergens=["fish"], animal=True, units=[("₦ portion", 100, True, True)])

INGREDIENT_SLUGS = {x["slug"] for x in I}

# Reference observations from public sources (doc 04 section 7). Never shown to users as prices.
REFS = {
 "tomato-fresh": [dict(price_ngn=1560.56, per="kg", area="national", observed="2026-05", kind="retail_national_average",
                       source="NBS Selected Food Price Watch, May 2026 (as reported by the press)")],
 "beans-brown": [dict(price_ngn=1344.93, per="kg", area="national", observed="2026-05", kind="retail_national_average",
                      source="NBS Selected Food Price Watch, May 2026 (as reported by the press)"),
                 dict(price_ngn=105000, per="50 kg bag", area="lagos", observed="2026-09", kind="wholesale",
                      source="Nairametrics Lagos food price survey, September 2026")],
 "garri-white": [dict(price_ngn=808.96, per="kg", area="national", observed="2026-04", kind="retail_national_average",
                      source="NBS Selected Food Price Watch, spring 2026 (as reported by the press)"),
                 dict(price_ngn=19500, per="50 kg bag", area="lagos", observed="2026-09", kind="wholesale",
                      source="Nairametrics Lagos food price survey, September 2026")],
 "garri-yellow": [dict(price_ngn=18000, per="50 kg bag", area="lagos", observed="2026-09", kind="wholesale",
                       source="Nairametrics Lagos food price survey, September 2026")],
 "onion": [dict(price_ngn=1164.39, per="kg", area="national", observed="2026-04", kind="retail_national_average",
                source="NBS Selected Food Price Watch, April 2026 (as reported by the press)")],
 "ginger": [dict(price_ngn=5581.82, per="kg", area="national", observed="2026-04", kind="retail_national_average",
                 source="NBS Selected Food Price Watch, April 2026 (as reported by the press)")],
 "rice-local-parboiled": [dict(price_ngn=112000, per="50 kg bag", area="national", observed="2026-03", kind="national_average_bulk",
                               source="NBS Selected Food Price Watch, March 2026 (as reported by Vanguard and Guardian)")],
 "rice-foreign-parboiled": [dict(price_ngn=133975, per="50 kg bag", area="national", observed="2026-03", kind="national_average_bulk",
                                 source="NBS Selected Food Price Watch, March 2026 (as reported by Vanguard and Guardian)")],
 "vegetable-oil": [dict(price_ngn=11000, per="5 litre", area="lagos", observed="2026-09", kind="wholesale",
                        source="Nairametrics Lagos food price survey, September 2026 (local vegetable oil)")],
 "palm-oil": [dict(price_ngn=8500, per="5 litre", area="lagos", observed="2026-09", kind="wholesale",
                   source="Nairametrics Lagos food price survey, September 2026 (local palm oil)")],
 "maize-dry": [dict(price_ngn=40000, per="50 kg bag", area="lagos", observed="2026-09", kind="wholesale",
                    source="Nairametrics Lagos food price survey, September 2026")],
 "wheat-meal": [dict(price_ngn=6220, per="5 kg pack", area="lagos", observed="2026-09", kind="wholesale",
                     source="Nairametrics Lagos food price survey, September 2026 (branded wheat meal, 5 kg)")],
}
for x in I:
    x["reference_observations"] = REFS.get(x["slug"], [])
    x["seed_price"] = None  # filled only by the first real survey

# ---------------------------------------------------------------------------
# Components
# code for meal times: B breakfast, L lunch, D dinner, N late night
MT = {"B": "breakfast", "L": "lunch", "D": "dinner", "N": "late_night"}
C = []
def comp(slug, name, types, family, region, meals, effort, minutes, spice, tags, ingredients,
         local=None, popularity=0.5, protein_included=False, needs_sauce=False, forgotten=False,
         availability="everyday", aliases=(), note=None):
    lines = []
    for raw in ingredients:
        optional = raw.endswith("?")
        s = raw.rstrip("?")
        if s not in INGREDIENT_SLUGS:
            sys.exit(f"Unknown ingredient '{s}' in component '{slug}'")
        lines.append(dict(ingredient=s, optional=optional, qty_per_serving=None, group=None))
    C.append(dict(slug=slug, name=name, types=types, cuisine_family=family, region=region,
                  meal_times=[MT[c] for c in meals], effort=effort, total_minutes=minutes,
                  spice_level=spice, tags=tags, local_names=local or {}, aliases=list(aliases),
                  popularity_prior=popularity, protein_included=protein_included,
                  needs_sauce=needs_sauce, forgotten_classic=forgotten, availability=availability,
                  ingredient_lines=lines, steps=[], equipment=[], tips=[], mistakes=[], storage=None,
                  serving_note=None, pcm={}, pcm_reviewed=False, tested_by=None, tested_at=None,
                  illustration=None, videos=[],
                  status="draft", review_note=note))

NG, WA, EA, SA, NA, CO = "nigerian", "west_african", "east_african", "southern_african", "north_african", "continental"
SOUP = ["soup"]
# --- Soups (Nigerian)
comp("egusi-soup", "Egusi soup", SOUP, NG, "pan_nigerian", "LD", 2, 60, 2, ["soupy", "savoury", "filling", "comfort", "nutty"],
     ["egusi-ground", "palm-oil", "stockfish?", "dried-fish?", "crayfish?", "ugu", "scotch-bonnet", "onion", "seasoning-cube", "iru?", "salt"],
     local={"yo": "obe egusi", "ig": "ofe egwusi", "ha": "miyan agushi"}, popularity=0.9)
comp("efo-riro", "Efo riro", SOUP, NG, "yoruba", "LD", 2, 45, 2, ["saucy", "savoury", "herby", "comfort"],
     ["efo-shoko-tete", "palm-oil", "tatashe", "scotch-bonnet", "onion", "iru", "crayfish?", "stockfish?", "seasoning-cube", "salt"],
     local={"yo": "efo riro"}, popularity=0.8)
comp("ogbono-soup", "Ogbono soup", SOUP, NG, "pan_nigerian", "LD", 2, 40, 2, ["soupy", "savoury", "comfort"],
     ["ogbono-ground", "palm-oil", "stockfish?", "dried-fish?", "crayfish?", "ugu?", "scotch-bonnet", "seasoning-cube", "salt"],
     local={"yo": "obe apon", "ig": "ofe ogbono"}, popularity=0.75)
comp("okra-soup", "Okra soup", SOUP, NG, "pan_nigerian", "LD", 1, 35, 2, ["soupy", "light", "savoury", "quick"],
     ["okra", "palm-oil", "stockfish?", "dried-fish?", "crayfish?", "ugu?", "scotch-bonnet", "onion", "seasoning-cube", "salt"],
     local={"yo": "obe ila", "ig": "ofe okwuru", "ha": "miyan kubewa"}, popularity=0.8)
comp("ewedu", "Ewedu", SOUP, NG, "yoruba", "LD", 1, 25, 0, ["soupy", "light", "herby", "quick"],
     ["ewedu-leaves", "iru?", "crayfish?", "seasoning-cube", "salt", "potash-akanwu?"],
     local={"yo": "ewedu"}, popularity=0.7)
comp("gbegiri", "Gbegiri (bean soup)", SOUP, NG, "yoruba", "LD", 2, 90, 1, ["soupy", "creamy", "comfort"],
     ["beans-white", "palm-oil", "crayfish?", "iru?", "seasoning-cube", "salt", "dried-pepper"],
     local={"yo": "gbegiri"}, popularity=0.6, forgotten=True)
comp("edikang-ikong", "Edikang ikong", SOUP, NG, "efik_ibibio", "LD", 3, 75, 2, ["saucy", "herby", "festive", "sunday_special"],
     ["ugu", "waterleaf", "palm-oil", "periwinkle?", "stockfish?", "dried-fish?", "crayfish?", "scotch-bonnet", "onion", "seasoning-cube", "salt"],
     local={"ef": "edikang ikong"}, popularity=0.65)
comp("afang-soup", "Afang soup", SOUP, NG, "efik_ibibio", "LD", 3, 75, 2, ["saucy", "herby", "festive", "sunday_special"],
     ["afang-leaves", "waterleaf", "palm-oil", "periwinkle?", "stockfish?", "dried-fish?", "crayfish?", "scotch-bonnet", "seasoning-cube", "salt"],
     local={"ef": "afang"}, popularity=0.65)
comp("banga-soup", "Banga soup", SOUP, NG, "niger_delta", "LD", 3, 75, 2, ["soupy", "smoky", "festive"],
     ["palm-nut", "catfish-fresh?", "dried-fish?", "crayfish?", "scotch-bonnet", "onion", "seasoning-cube", "salt", "ofada-spice?"],
     local={"urh": "amiedi", "ig": "ofe akwu"}, popularity=0.6)
comp("oha-soup", "Oha soup", SOUP, NG, "igbo", "LD", 3, 70, 2, ["soupy", "herby", "comfort"],
     ["oha-leaves", "cocoyam", "palm-oil", "stockfish?", "dried-fish?", "crayfish?", "ogiri?", "scotch-bonnet", "seasoning-cube", "salt"],
     local={"ig": "ofe oha"}, popularity=0.6)
comp("bitterleaf-soup", "Bitterleaf soup", SOUP, NG, "igbo", "LD", 3, 70, 2, ["soupy", "bitter_greens", "comfort"],
     ["bitterleaf", "cocoyam", "palm-oil", "stockfish?", "dried-fish?", "crayfish?", "ogiri?", "scotch-bonnet", "seasoning-cube", "salt"],
     local={"ig": "ofe onugbu"}, popularity=0.55)
comp("nsala-soup", "Nsala (white soup)", SOUP, NG, "igbo", "LD", 2, 50, 3, ["soupy", "peppery", "light"],
     ["catfish-fresh", "yam", "uziza-leaves?", "ofada-spice", "crayfish?", "scotch-bonnet", "seasoning-cube", "salt"],
     local={"ig": "ofe nsala"}, popularity=0.5, protein_included=True)
comp("ofe-owerri", "Ofe Owerri", SOUP, NG, "igbo", "LD", 3, 80, 2, ["soupy", "herby", "festive", "sunday_special"],
     ["ugu", "cocoyam", "palm-oil", "stockfish?", "dried-fish?", "crayfish?", "ogiri?", "scotch-bonnet", "seasoning-cube", "salt"],
     local={"ig": "ofe owerri"}, popularity=0.4, forgotten=True)
comp("fisherman-soup", "Fisherman soup", SOUP, NG, "niger_delta", "LD", 3, 50, 3, ["soupy", "peppery", "festive"],
     ["catfish-fresh", "prawns?", "periwinkle?", "clams?", "crab?", "palm-oil", "scent-leaf", "scotch-bonnet", "seasoning-cube", "salt"],
     popularity=0.4, protein_included=True)
comp("owo-soup", "Owo soup", SOUP, NG, "niger_delta", "LD", 2, 50, 2, ["saucy", "smoky", "comfort"],
     ["palm-oil", "potash-akanwu", "cassava-starch", "dried-fish?", "crayfish?", "scotch-bonnet", "seasoning-cube", "salt"],
     local={"urh": "owo"}, popularity=0.35, forgotten=True)
comp("miyan-kuka", "Miyan kuka", SOUP, NG, "northern", "LD", 2, 45, 2, ["soupy", "herby", "savoury"],
     ["baobab-leaf-powder", "beef?", "dried-fish?", "iru", "palm-oil?", "scotch-bonnet", "onion", "seasoning-cube", "salt"],
     local={"ha": "miyan kuka"}, popularity=0.45)
comp("miyan-taushe", "Miyan taushe (pumpkin soup)", SOUP, NG, "northern", "LD", 2, 60, 1, ["soupy", "nutty", "sweet"],
     ["pumpkin", "groundnut-paste", "efo-shoko-tete", "beef?", "iru?", "scotch-bonnet", "onion", "seasoning-cube", "salt"],
     local={"ha": "miyan taushe"}, popularity=0.35, forgotten=True)
comp("black-soup", "Black soup (omoebe)", SOUP, NG, "edo", "LD", 3, 70, 2, ["soupy", "herby", "bitter_greens"],
     ["bitterleaf", "scent-leaf", "palm-oil?", "stockfish?", "dried-fish?", "crayfish?", "scotch-bonnet", "seasoning-cube", "salt"],
     local={"ed": "omoebe"}, popularity=0.35, forgotten=True)
comp("atama-soup", "Atama soup", SOUP, NG, "efik_ibibio", "LD", 3, 75, 2, ["soupy", "herby", "festive"],
     ["atama-leaves", "palm-nut", "periwinkle?", "stockfish?", "dried-fish?", "crayfish?", "scotch-bonnet", "seasoning-cube", "salt"],
     local={"ef": "abak atama"}, popularity=0.3, forgotten=True)
# --- Soups (West and Central African)
comp("light-soup", "Light soup (Ghana)", SOUP, WA, "ghana", "LD", 2, 50, 2, ["soupy", "light", "peppery"],
     ["tomato-fresh", "onion", "scotch-bonnet", "ginger", "goat-meat-raw?", "seasoning-cube", "salt"], popularity=0.3)
comp("groundnut-soup-ghana", "Groundnut soup (Ghana-style)", SOUP, WA, "ghana", "LD", 2, 70, 2, ["soupy", "nutty", "comfort"],
     ["groundnut-paste", "tomato-fresh", "onion", "scotch-bonnet", "chicken?", "seasoning-cube", "salt"],
     local={"tw": "nkatenkwan"}, popularity=0.3)
comp("eru", "Eru (Cameroon)", SOUP, WA, "cameroon", "LD", 3, 70, 2, ["saucy", "herby"],
     ["eru-leaves", "waterleaf", "palm-oil", "dried-fish?", "crayfish?", "cow-foot?", "scotch-bonnet", "seasoning-cube", "salt"],
     popularity=0.25)
# --- Swallows
SW = ["swallow"]
comp("eba", "Eba", SW, NG, "pan_nigerian", "LD", 1, 5, 0, ["filling", "quick", "base_cassava"], ["garri-yellow"],
     local={"yo": "eba"}, popularity=0.85, aliases=["garri"])
comp("pounded-yam", "Pounded yam", SW, NG, "pan_nigerian", "LD", 3, 40, 0, ["filling", "base_yam", "sunday_special"], ["yam"],
     local={"yo": "iyan", "ig": "nni ji"}, popularity=0.75, aliases=["iyan"])
comp("amala", "Amala", SW, NG, "yoruba", "LD", 1, 10, 0, ["filling", "quick", "base_yam"], ["yam-flour"],
     local={"yo": "amala isu"}, popularity=0.75)
comp("lafun", "Lafun (cassava amala)", SW, NG, "yoruba", "LD", 1, 10, 0, ["filling", "quick", "base_cassava"], ["cassava-flour"],
     local={"yo": "lafun"}, popularity=0.4, forgotten=True)
comp("semo", "Semo", SW, NG, "pan_nigerian", "LD", 1, 10, 0, ["filling", "quick", "base_wheat"], ["semolina"], popularity=0.6, aliases=["semovita"])
comp("fufu", "Fufu (akpu)", SW, NG, "igbo", "LD", 1, 20, 0, ["filling", "base_cassava"], ["fufu-cassava"],
     local={"ig": "akpu", "yo": "fufu"}, popularity=0.6, aliases=["akpu", "loi loi"])
comp("wheat-swallow", "Wheat swallow", SW, NG, "pan_nigerian", "LD", 1, 10, 0, ["filling", "quick", "base_wheat"], ["wheat-meal"], popularity=0.5)
comp("tuwo-shinkafa", "Tuwo shinkafa", SW, NG, "northern", "LD", 2, 40, 0, ["filling", "base_rice"], ["rice-flour"],
     local={"ha": "tuwon shinkafa"}, popularity=0.45)
comp("tuwo-masara", "Tuwo masara", SW, NG, "northern", "LD", 2, 40, 0, ["filling", "base_maize"], ["maize-flour"],
     local={"ha": "tuwon masara"}, popularity=0.35, forgotten=True)
comp("starch-usi", "Starch (usi)", SW, NG, "niger_delta", "LD", 2, 20, 0, ["filling", "base_cassava"], ["cassava-starch", "palm-oil"],
     local={"urh": "usi"}, popularity=0.35)
comp("unripe-plantain-swallow", "Unripe plantain swallow", SW, NG, "pan_nigerian", "LD", 1, 10, 0, ["filling", "base_plantain"], ["plantain-flour"],
     popularity=0.35)
comp("fufu-ghana", "Fufu (Ghana-style)", SW, WA, "ghana", "LD", 3, 40, 0, ["filling", "base_cassava"], ["cocoyam", "plantain-unripe"],
     popularity=0.2, note="Usually pounded cassava and plantain; confirm recipe with a Ghanaian cook")
# --- Rice
RICE = ["rice"]
comp("jollof-rice", "Jollof rice", RICE, NG, "pan_nigerian", "LD", 2, 60, 2, ["base_rice", "party_food", "smoky", "comfort"],
     ["rice-foreign-parboiled", "tomato-fresh", "tatashe", "scotch-bonnet", "onion", "tomato-paste", "vegetable-oil", "curry-powder", "thyme", "bay-leaves?", "seasoning-cube", "salt"],
     popularity=0.95)
comp("fried-rice", "Nigerian fried rice", RICE, NG, "pan_nigerian", "LD", 2, 60, 1, ["base_rice", "party_food", "savoury"],
     ["rice-foreign-parboiled", "carrot", "green-beans", "peas-green?", "sweet-corn-tin?", "onion", "vegetable-oil", "curry-powder", "thyme", "seasoning-cube", "salt"],
     popularity=0.85)
comp("white-rice", "White rice", RICE, NG, "pan_nigerian", "LD", 1, 25, 0, ["base_rice", "quick", "mild"], ["rice-foreign-parboiled", "salt"],
     popularity=0.85, needs_sauce=True, aliases=["plain rice", "boiled rice"])
comp("ofada-rice", "Ofada rice", RICE, NG, "yoruba", "LD", 1, 40, 0, ["base_rice", "comfort"], ["ofada-rice", "salt"],
     popularity=0.65, needs_sauce=True)
comp("coconut-rice", "Coconut rice", RICE, NG, "pan_nigerian", "LD", 2, 55, 1, ["base_rice", "party_food", "creamy"],
     ["rice-foreign-parboiled", "coconut", "tatashe", "onion", "vegetable-oil", "curry-powder", "thyme", "seasoning-cube", "salt"],
     popularity=0.5)
comp("native-jollof", "Native jollof (palm oil rice)", RICE, NG, "efik_ibibio", "LD", 2, 55, 2, ["base_rice", "smoky", "comfort"],
     ["rice-local-parboiled", "palm-oil", "dried-fish?", "crayfish?", "scent-leaf?", "scotch-bonnet", "onion", "iru?", "seasoning-cube", "salt"],
     local={"ef": "iwuk edesi"}, popularity=0.55, aliases=["palm oil rice", "concoction rice"])
comp("rice-and-beans", "Rice and beans", RICE, NG, "pan_nigerian", "LD", 1, 60, 0, ["base_rice", "base_beans", "filling"],
     ["rice-local-parboiled", "beans-white", "salt"], popularity=0.6, needs_sauce=True)
comp("pilau", "Pilau (Kenya)", RICE, EA, "kenya", "LD", 2, 60, 1, ["base_rice", "savoury"],
     ["rice-foreign-parboiled", "onion", "garlic", "ginger", "beef?", "vegetable-oil", "seasoning-cube", "salt"], popularity=0.25)
# --- Sauces and stews
SAUCE = ["sauce"]
comp("tomato-stew", "Tomato stew", SAUCE, NG, "pan_nigerian", "LD", 2, 50, 2, ["saucy", "comfort", "savoury"],
     ["tomato-fresh", "tatashe", "scotch-bonnet", "onion", "vegetable-oil", "tomato-paste?", "curry-powder", "thyme", "seasoning-cube", "salt"],
     local={"yo": "obe ata"}, popularity=0.85, aliases=["stew", "red stew"])
comp("buka-stew", "Buka stew (ata dindin)", SAUCE, NG, "yoruba", "LD", 2, 60, 3, ["saucy", "peppery", "smoky", "street_food"],
     ["tatashe", "scotch-bonnet", "tomato-fresh?", "onion", "palm-oil", "iru?", "seasoning-cube", "salt"],
     local={"yo": "obe ata dindin"}, popularity=0.7, aliases=["ata dindin", "mama put stew"])
comp("ayamase", "Ayamase (ofada sauce)", SAUCE, NG, "yoruba", "LD", 3, 70, 3, ["saucy", "peppery", "smoky"],
     ["green-pepper-ayamase", "onion", "palm-oil", "iru", "crayfish?", "seasoning-cube", "salt"],
     local={"yo": "ayamase"}, popularity=0.6, aliases=["designer stew", "ofada stew"])
comp("ofe-akwu", "Ofe akwu (palm nut stew)", SAUCE, NG, "igbo", "LD", 2, 60, 2, ["saucy", "smoky", "comfort"],
     ["palm-nut", "scent-leaf?", "dried-fish?", "crayfish?", "scotch-bonnet", "onion", "seasoning-cube", "salt"],
     local={"ig": "ofe akwu"}, popularity=0.45)
comp("egg-sauce", "Egg sauce", SAUCE, NG, "pan_nigerian", "BLD", 1, 15, 1, ["saucy", "quick", "breakfast_friendly"],
     ["eggs", "tomato-fresh", "onion", "scotch-bonnet", "vegetable-oil", "seasoning-cube", "salt"], popularity=0.75)
comp("garden-egg-sauce", "Garden egg sauce", SAUCE, NG, "pan_nigerian", "BLD", 1, 25, 2, ["saucy", "herby"],
     ["garden-egg", "palm-oil", "onion", "scotch-bonnet", "crayfish?", "dried-fish?", "seasoning-cube", "salt"],
     popularity=0.4, forgotten=True)
comp("corned-beef-sauce", "Corned beef sauce", SAUCE, NG, "pan_nigerian", "BLD", 1, 20, 1, ["saucy", "quick", "savoury"],
     ["corned-beef", "tomato-fresh", "onion", "scotch-bonnet", "vegetable-oil", "seasoning-cube"], popularity=0.5)
comp("agoyin-sauce", "Agoyin sauce", SAUCE, NG, "yoruba", "BLD", 2, 45, 3, ["saucy", "peppery", "smoky", "street_food"],
     ["dried-pepper", "onion", "palm-oil", "seasoning-cube", "salt"], popularity=0.5,
     note="Only pairs with ewa agoyin; keep pairing rules strict")
# --- Proteins
PR = ["protein"]
comp("goat-meat", "Goat meat", PR, NG, "pan_nigerian", "LD", 2, 50, 1, ["protein_goat"], ["goat-meat-raw", "onion", "seasoning-cube", "salt"], popularity=0.7)
comp("beef", "Beef", PR, NG, "pan_nigerian", "LD", 2, 45, 1, ["protein_beef"], ["beef", "onion", "seasoning-cube", "salt"], popularity=0.8)
comp("chicken", "Chicken (stewed or fried)", PR, NG, "pan_nigerian", "LD", 2, 45, 1, ["protein_chicken"], ["chicken", "onion", "seasoning-cube", "thyme", "curry-powder", "vegetable-oil?", "salt"], popularity=0.85)
comp("turkey", "Turkey", PR, NG, "pan_nigerian", "LD", 2, 50, 1, ["protein_turkey", "party_food"], ["turkey", "onion", "seasoning-cube", "vegetable-oil?", "salt"], popularity=0.6)
comp("assorted-meat", "Assorted meat (orisirisi)", PR, NG, "pan_nigerian", "LD", 2, 60, 1, ["protein_offal", "protein_beef"], ["shaki-tripe", "ponmo-cowskin", "beef", "onion", "seasoning-cube", "salt"],
     local={"yo": "orisirisi"}, popularity=0.7, aliases=["orisirisi", "obstacles"])
comp("fried-fish", "Fried fish (titus)", PR, NG, "pan_nigerian", "LD", 1, 25, 0, ["protein_fish", "fried"], ["fish-titus", "vegetable-oil", "seasoning-cube", "salt"], popularity=0.65)
comp("catfish", "Catfish (cooked in the pot)", PR, NG, "pan_nigerian", "LD", 2, 30, 1, ["protein_fish"], ["catfish-fresh", "salt"], popularity=0.5)
comp("ponmo", "Ponmo", PR, NG, "yoruba", "LD", 1, 30, 1, ["protein_offal"], ["ponmo-cowskin", "seasoning-cube", "salt"], local={"yo": "ponmo"}, popularity=0.5)
comp("gizzard", "Gizzard", PR, NG, "pan_nigerian", "LD", 1, 35, 1, ["protein_chicken"], ["gizzard", "onion", "seasoning-cube", "salt"], popularity=0.45)
comp("snail", "Peppered snail", PR, NG, "pan_nigerian", "LD", 2, 45, 3, ["protein_snail", "peppery", "party_food"], ["snail", "tatashe", "scotch-bonnet", "onion", "vegetable-oil", "seasoning-cube", "salt"], popularity=0.35)
comp("boiled-egg", "Boiled egg", PR, NG, "pan_nigerian", "BLDN", 1, 12, 0, ["protein_egg", "quick"], ["eggs"], popularity=0.6)
comp("fried-egg", "Fried egg", PR, NG, "pan_nigerian", "BLDN", 1, 8, 0, ["protein_egg", "quick", "fried"], ["eggs", "onion?", "vegetable-oil", "salt"], popularity=0.65)
# --- Sides
comp("dodo", "Dodo (fried plantain)", ["side", "tuber_base"], NG, "pan_nigerian", "BLDN", 1, 15, 0, ["fried", "sweet", "quick", "base_plantain"], ["plantain-ripe", "vegetable-oil", "salt"],
     local={"yo": "dodo"}, popularity=0.9, aliases=["fried plantain"])
comp("moi-moi", "Moi moi", ["side", "breakfast_main"], NG, "pan_nigerian", "BLD", 2, 70, 1, ["base_beans", "party_food", "comfort"],
     ["beans-white", "tatashe", "scotch-bonnet", "onion", "vegetable-oil", "eggs?", "crayfish?", "fish-titus?", "seasoning-cube", "salt"],
     local={"yo": "moin moin"}, popularity=0.75, aliases=["moin moin"])
comp("coleslaw", "Coleslaw", ["side"], CO, "pan_nigerian", "LD", 1, 15, 0, ["no_cook", "quick", "light"], ["cabbage", "carrot", "mayonnaise"], popularity=0.55)
comp("nigerian-salad", "Nigerian salad", ["side"], NG, "pan_nigerian", "LD", 1, 25, 0, ["no_cook", "party_food"],
     ["lettuce", "cabbage", "carrot", "cucumber", "tomato-fresh", "baked-beans?", "sweet-corn-tin?", "eggs?", "mayonnaise"], popularity=0.45)
comp("agidi", "Agidi (eko)", ["side", "breakfast_partner"], NG, "yoruba", "BLD", 1, 5, 0, ["mild", "base_maize"], ["agidi-wrap"],
     local={"yo": "eko", "ig": "agidi"}, popularity=0.3, forgotten=True)
comp("gizdodo", "Gizdodo", ["side", "snack"], NG, "pan_nigerian", "LDN", 2, 40, 2, ["party_food", "fried", "peppery"],
     ["gizzard", "plantain-ripe", "tatashe", "scotch-bonnet", "onion", "vegetable-oil", "seasoning-cube", "salt"], popularity=0.45)
# --- One-pot
OP = ["one_pot"]
comp("yam-porridge", "Yam porridge (asaro)", OP, NG, "pan_nigerian", "LD", 1, 40, 2, ["comfort", "base_yam", "soupy"],
     ["yam", "palm-oil", "tatashe", "scotch-bonnet", "onion", "crayfish?", "dried-fish?", "efo-shoko-tete?", "seasoning-cube", "salt"],
     local={"yo": "asaro", "ig": "ji mmiri oku"}, popularity=0.7, aliases=["asaro", "pottage"])
comp("plantain-porridge", "Plantain porridge", OP, NG, "pan_nigerian", "LD", 1, 35, 2, ["comfort", "base_plantain"],
     ["plantain-ripe", "palm-oil", "scotch-bonnet", "onion", "crayfish?", "efo-shoko-tete?", "seasoning-cube", "salt"], popularity=0.45)
comp("unripe-plantain-porridge", "Unripe plantain porridge", OP, NG, "pan_nigerian", "LD", 1, 40, 2, ["comfort", "base_plantain"],
     ["plantain-unripe", "palm-oil", "scotch-bonnet", "onion", "crayfish?", "dried-fish?", "ugu?", "seasoning-cube", "salt"], popularity=0.4, forgotten=True)
comp("beans-porridge", "Beans porridge (ewa riro)", OP, NG, "pan_nigerian", "LD", 2, 70, 2, ["comfort", "base_beans", "filling"],
     ["beans-brown", "palm-oil", "tatashe", "scotch-bonnet", "onion", "crayfish?", "seasoning-cube", "salt"],
     local={"yo": "ewa riro"}, popularity=0.75)
comp("ewa-agoyin", "Ewa agoyin", OP, NG, "yoruba", "BLD", 2, 75, 1, ["base_beans", "street_food", "comfort"],
     ["beans-white", "salt"], local={"yo": "ewa agoyin"}, popularity=0.65,
     note="Served with agoyin sauce; model the sauce as part of this one-pot or require agoyin-sauce pairing")
comp("sweet-potato-porridge", "Sweet potato porridge", OP, NG, "pan_nigerian", "LD", 1, 35, 2, ["comfort", "base_potato"],
     ["sweet-potato", "palm-oil", "scotch-bonnet", "onion", "crayfish?", "ugu?", "seasoning-cube", "salt"], popularity=0.3)
comp("ukodo", "Ukodo (yam pepper soup)", OP, NG, "niger_delta", "LDN", 2, 50, 3, ["soupy", "peppery", "light"],
     ["yam", "goat-meat-raw?", "pepper-soup-spice", "scotch-bonnet", "scent-leaf?", "seasoning-cube", "salt"],
     local={"urh": "ukodo"}, popularity=0.3, forgotten=True)
comp("adalu", "Adalu (beans and corn)", OP, NG, "yoruba", "LD", 2, 70, 1, ["comfort", "base_beans", "base_maize", "sweet"],
     ["beans-brown", "sweet-corn-tin", "palm-oil", "onion", "scotch-bonnet", "crayfish?", "seasoning-cube", "salt"],
     local={"yo": "adalu"}, popularity=0.3, forgotten=True)
comp("ukwa", "Ukwa (breadfruit porridge)", OP, NG, "igbo", "LD", 3, 120, 1, ["comfort", "filling", "weekend_cook"],
     ["ukwa-breadfruit", "potash-akanwu?", "palm-oil", "scotch-bonnet", "dried-fish?", "seasoning-cube", "salt"],
     local={"ig": "ukwa"}, popularity=0.25, forgotten=True)
comp("ikokore", "Ikokore (water yam pottage)", OP, NG, "yoruba", "LD", 2, 50, 2, ["comfort", "base_yam"],
     ["water-yam", "palm-oil", "dried-fish?", "crayfish?", "scotch-bonnet", "onion", "seasoning-cube", "salt"],
     local={"yo": "ikokore"}, popularity=0.2, forgotten=True)
comp("ekpang-nkukwo", "Ekpang nkukwo", OP, NG, "efik_ibibio", "LD", 3, 120, 2, ["comfort", "weekend_cook", "festive"],
     ["cocoyam", "water-yam", "ugu", "palm-oil", "periwinkle?", "dried-fish?", "crayfish?", "scotch-bonnet", "seasoning-cube", "salt"],
     local={"ef": "ekpang nkukwo"}, popularity=0.2, forgotten=True)
# --- Breakfast mains and partners
comp("akara", "Akara", ["breakfast_main", "snack"], NG, "pan_nigerian", "BLN", 2, 40, 1, ["fried", "breakfast_friendly", "street_food", "base_beans"],
     ["beans-white", "scotch-bonnet", "onion", "vegetable-oil", "salt"], local={"yo": "akara", "ha": "kosai"}, popularity=0.8, aliases=["kosai", "bean cakes"])
comp("ekuru", "Ekuru", ["breakfast_main"], NG, "yoruba", "BL", 2, 60, 2, ["base_beans", "light"], ["beans-white", "salt"],
     local={"yo": "ekuru"}, popularity=0.2, forgotten=True, note="Often eaten with a fried pepper sauce; consider pairing with buka-stew")
comp("masa", "Masa (rice cakes)", ["breakfast_main"], NG, "northern", "BL", 2, 40, 0, ["breakfast_friendly", "street_food", "base_rice"],
     ["rice-flour", "yeast", "sugar", "vegetable-oil", "salt"], local={"ha": "masa", "yo": "waina"}, popularity=0.3, forgotten=True, aliases=["waina"])
comp("agege-bread", "Agege bread", ["breakfast_main", "breakfast_partner", "side"], NG, "yoruba", "BLDN", 1, 0, 0, ["no_cook", "quick", "base_wheat"], ["agege-bread"],
     popularity=0.7)
comp("pap", "Pap (ogi / akamu)", ["breakfast_partner"], NG, "pan_nigerian", "BN", 1, 10, 0, ["breakfast_friendly", "light", "base_maize"],
     ["ogi-paste", "milk-powder?", "sugar?"], local={"yo": "ogi", "ig": "akamu", "ha": "koko"}, popularity=0.65, aliases=["ogi", "akamu", "koko"])
comp("custard", "Custard", ["breakfast_partner"], NG, "pan_nigerian", "BN", 1, 8, 0, ["breakfast_friendly", "creamy", "sweet"],
     ["custard-powder", "milk-powder?", "sugar?"], popularity=0.55)
comp("oats", "Oats", ["breakfast_partner"], CO, "pan_nigerian", "BN", 1, 8, 0, ["breakfast_friendly", "light"],
     ["oats", "milk-powder?", "sugar?"], popularity=0.4)
comp("tea-with-milk", "Tea with milk", ["breakfast_partner", "drink"], NG, "pan_nigerian", "BN", 1, 5, 0, ["breakfast_friendly", "quick"],
     ["tea-bags", "milk-powder", "sugar?"], popularity=0.6)
# --- Tuber bases
TB = ["tuber_base"]
comp("boiled-yam", "Boiled yam", TB, NG, "pan_nigerian", "BLD", 1, 25, 0, ["base_yam", "mild"], ["yam", "salt"], popularity=0.7)
comp("fried-yam", "Fried yam (dundun)", TB + ["snack"], NG, "yoruba", "BLDN", 1, 30, 0, ["base_yam", "fried", "street_food"], ["yam", "vegetable-oil", "salt"],
     local={"yo": "dundun"}, popularity=0.55)
comp("boiled-plantain", "Boiled plantain", TB, NG, "pan_nigerian", "BLD", 1, 20, 0, ["base_plantain", "mild", "light"], ["plantain-unripe"], popularity=0.45)
comp("boiled-sweet-potato", "Boiled sweet potato", TB, NG, "pan_nigerian", "BLD", 1, 20, 0, ["base_potato", "mild", "sweet"], ["sweet-potato", "salt"], popularity=0.35)
comp("irish-potatoes", "Irish potatoes (boiled or fried)", TB, CO, "pan_nigerian", "BLD", 1, 25, 0, ["base_potato", "mild"], ["irish-potato", "vegetable-oil?", "salt"], popularity=0.45)
# --- Pasta and noodles
PN = ["pasta_noodle"]
comp("jollof-spaghetti", "Jollof spaghetti", PN, NG, "pan_nigerian", "LDN", 1, 35, 2, ["base_wheat", "comfort", "student_friendly"],
     ["spaghetti", "tomato-fresh", "tatashe", "scotch-bonnet", "onion", "tomato-paste?", "vegetable-oil", "curry-powder?", "seasoning-cube", "salt"], popularity=0.7)
comp("stir-fry-spaghetti", "Stir-fry spaghetti", PN, CO, "pan_nigerian", "LDN", 1, 30, 1, ["base_wheat", "quick"],
     ["spaghetti", "carrot", "green-beans?", "onion", "vegetable-oil", "curry-powder", "seasoning-cube", "salt"], popularity=0.45)
comp("jollof-macaroni", "Jollof macaroni", PN, NG, "pan_nigerian", "LDN", 1, 35, 2, ["base_wheat", "comfort"],
     ["macaroni", "tomato-fresh", "tatashe", "scotch-bonnet", "onion", "vegetable-oil", "seasoning-cube", "salt"], popularity=0.4)
comp("instant-noodles", "Instant noodles", PN, NG, "pan_nigerian", "BLDN", 1, 10, 1, ["base_wheat", "quick", "late_night_friendly", "student_friendly"],
     ["instant-noodles", "onion?", "scotch-bonnet?", "vegetable-oil?"], popularity=0.85, aliases=["indomie", "noodles"])
comp("spaghetti-bolognese", "Spaghetti bolognese (Naija-style)", PN, CO, "pan_nigerian", "LD", 2, 45, 1, ["base_wheat", "comfort", "savoury"],
     ["spaghetti", "beef", "tomato-fresh", "onion", "garlic", "tomato-paste", "vegetable-oil", "thyme", "seasoning-cube", "salt"],
     popularity=0.4, protein_included=True)
# --- Snacks
SN = ["snack"]
comp("puff-puff", "Puff-puff", SN, NG, "pan_nigerian", "BLN", 2, 75, 0, ["fried", "sweet", "party_food", "street_food"],
     ["wheat-flour", "yeast", "sugar", "nutmeg?", "vegetable-oil", "salt"], popularity=0.7)
comp("meat-pie", "Meat pie", SN, NG, "pan_nigerian", "BLN", 3, 90, 1, ["party_food", "savoury"],
     ["wheat-flour", "butter-margarine", "beef", "irish-potato", "carrot", "onion", "eggs?", "baking-powder", "seasoning-cube", "salt"], popularity=0.55)
comp("chin-chin", "Chin-chin", SN, NG, "pan_nigerian", "BLN", 2, 60, 0, ["fried", "sweet", "crunchy", "party_food"],
     ["wheat-flour", "butter-margarine", "sugar", "milk-powder?", "eggs?", "nutmeg?", "vegetable-oil"], popularity=0.5)
comp("plantain-chips", "Plantain chips", SN, NG, "pan_nigerian", "BLN", 1, 30, 0, ["fried", "crunchy", "street_food"],
     ["plantain-unripe", "vegetable-oil", "salt"], popularity=0.45)
comp("roasted-corn-and-ube", "Roasted corn and ube", SN, NG, "pan_nigerian", "LDN", 1, 30, 0, ["grilled", "street_food", "seasonal"],
     ["fresh-corn", "ube-pear"], popularity=0.4, forgotten=True, availability="seasonal")
comp("fish-roll", "Fish roll", SN, NG, "yoruba", "BLN", 3, 90, 1, ["street_food", "savoury"],
     ["wheat-flour", "butter-margarine", "sardines", "onion", "scotch-bonnet?", "baking-powder", "salt"], popularity=0.3)
comp("kuli-kuli", "Kuli-kuli", SN, NG, "northern", "BLN", 3, 90, 1, ["crunchy", "nutty", "street_food"],
     ["groundnuts", "dried-pepper?", "salt"], local={"ha": "kuli kuli"}, popularity=0.25, forgotten=True)
comp("kelewele", "Kelewele (Ghana)", SN + ["side"], WA, "ghana", "LDN", 1, 25, 2, ["fried", "peppery", "sweet", "street_food"],
     ["plantain-ripe", "ginger", "scotch-bonnet", "vegetable-oil", "salt"], popularity=0.25)
# --- Singles (Nigerian)
SG = ["single"]
comp("suya", "Suya", SG + ["snack"], NG, "northern", "DN", 2, 40, 3, ["grilled", "peppery", "smoky", "street_food", "late_night_friendly", "protein_beef"],
     ["beef", "suya-spice", "onion", "tomato-fresh?", "cabbage?"], local={"ha": "tsire"}, popularity=0.8, protein_included=True)
comp("asun", "Asun (peppered goat)", SG + ["snack"], NG, "yoruba", "DN", 2, 50, 3, ["grilled", "peppery", "smoky", "party_food", "protein_goat"],
     ["goat-meat-raw", "scotch-bonnet", "onion", "vegetable-oil", "seasoning-cube", "salt"], popularity=0.5, protein_included=True)
comp("nkwobi", "Nkwobi", SG, NG, "igbo", "DN", 3, 90, 2, ["saucy", "peppery", "protein_offal", "party_food"],
     ["cow-foot", "palm-oil", "potash-akanwu", "ugba?", "utazi?", "dried-pepper", "onion", "seasoning-cube", "salt"],
     local={"ig": "nkwobi"}, popularity=0.45, protein_included=True)
comp("isi-ewu", "Isi ewu", SG, NG, "igbo", "DN", 3, 120, 2, ["saucy", "peppery", "protein_goat", "party_food", "weekend_cook"],
     ["goat-head", "palm-oil", "potash-akanwu", "ugba?", "utazi?", "dried-pepper", "onion", "seasoning-cube", "salt"],
     local={"ig": "isi ewu"}, popularity=0.35, protein_included=True)
comp("abacha", "Abacha (African salad)", SG, NG, "igbo", "LDN", 2, 30, 2, ["no_cook", "light", "herby"],
     ["cassava-abacha", "palm-oil", "potash-akanwu", "ugba", "utazi?", "garden-egg?", "dried-fish?", "crayfish?", "onion", "seasoning-cube", "salt"],
     local={"ig": "abacha"}, popularity=0.45, aliases=["african salad"])
comp("goat-pepper-soup", "Goat meat pepper soup", SG + ["soup"], NG, "pan_nigerian", "DN", 2, 60, 3, ["soupy", "peppery", "light", "late_night_friendly", "rainy_day", "protein_goat"],
     ["goat-meat-raw", "pepper-soup-spice", "scotch-bonnet", "scent-leaf?", "onion", "seasoning-cube", "salt"], popularity=0.6, protein_included=True)
comp("catfish-pepper-soup", "Catfish pepper soup (point and kill)", SG + ["soup"], NG, "pan_nigerian", "DN", 2, 40, 3, ["soupy", "peppery", "light", "late_night_friendly", "rainy_day", "protein_fish"],
     ["catfish-fresh", "pepper-soup-spice", "scotch-bonnet", "scent-leaf?", "uziza-leaves?", "onion", "seasoning-cube", "salt"],
     popularity=0.55, protein_included=True, aliases=["point and kill"])
comp("boli-and-fish", "Boli and fish", SG, NG, "niger_delta", "LDN", 2, 40, 2, ["grilled", "street_food", "base_plantain"],
     ["plantain-ripe", "fish-croaker", "palm-oil?", "scotch-bonnet", "onion", "salt"], popularity=0.4, protein_included=True)
comp("shawarma", "Shawarma (home-style)", SG, CO, "pan_nigerian", "LDN", 2, 40, 1, ["street_food", "late_night_friendly", "protein_chicken"],
     ["chicken", "cabbage", "carrot", "mayonnaise", "wheat-flour", "vegetable-oil", "seasoning-cube", "salt"], popularity=0.6, protein_included=True,
     note="Home version uses flatbread; consider a bought-wrap ingredient")
comp("chicken-and-chips", "Chicken and chips", SG, CO, "pan_nigerian", "LDN", 2, 50, 1, ["fried", "comfort", "protein_chicken"],
     ["chicken", "irish-potato", "vegetable-oil", "seasoning-cube", "salt"], popularity=0.55, protein_included=True)
# --- Singles (rest of Africa)
comp("waakye", "Waakye (Ghana)", SG, WA, "ghana", "BLD", 2, 75, 2, ["base_rice", "base_beans", "comfort", "street_food"],
     ["rice-local-parboiled", "beans-brown", "shito?", "eggs?", "spaghetti?", "salt"], popularity=0.3)
comp("red-red", "Red-red (Ghana)", SG, WA, "ghana", "LD", 2, 70, 2, ["base_beans", "comfort", "base_plantain"],
     ["beans-white", "palm-oil", "tomato-fresh", "onion", "scotch-bonnet", "plantain-ripe", "seasoning-cube", "salt"], popularity=0.25)
comp("kenkey-and-fish", "Kenkey and fried fish (Ghana)", SG, WA, "ghana", "LD", 1, 25, 3, ["street_food", "peppery", "base_maize", "protein_fish"],
     ["maize-meal-white", "fish-titus", "scotch-bonnet", "onion", "tomato-fresh", "vegetable-oil", "salt"], popularity=0.2, protein_included=True,
     availability="specialty", note="Kenkey is usually bought ready-made")
comp("banku-and-tilapia", "Banku and grilled tilapia (Ghana)", SG, WA, "ghana", "LD", 2, 60, 3, ["grilled", "peppery", "protein_fish"],
     ["maize-meal-white", "cassava-flour", "tilapia", "scotch-bonnet", "onion", "tomato-fresh", "salt"], popularity=0.25, protein_included=True)
comp("thieboudienne", "Thiéboudienne (Senegal)", SG, WA, "senegal", "LD", 3, 100, 1, ["base_rice", "festive", "protein_fish", "weekend_cook"],
     ["rice-local-parboiled", "fish-croaker", "tomato-paste", "cabbage", "carrot", "cassava-abacha?", "onion", "garlic", "vegetable-oil", "seasoning-cube", "salt"],
     popularity=0.2, protein_included=True, aliases=["ceebu jen"])
comp("yassa-chicken", "Chicken yassa (Senegal)", SG, WA, "senegal", "LD", 2, 75, 1, ["sour_tangy", "saucy", "protein_chicken"],
     ["chicken", "onion", "lemon", "garlic", "vegetable-oil", "rice-foreign-parboiled", "seasoning-cube", "salt"], popularity=0.2, protein_included=True)
comp("attieke-and-fish", "Attiéké and fish (Côte d'Ivoire)", SG, WA, "cote_divoire", "LD", 1, 30, 2, ["light", "protein_fish"],
     ["couscous-attieke", "tilapia", "tomato-fresh", "onion", "cucumber?", "scotch-bonnet", "vegetable-oil", "salt"], popularity=0.15,
     protein_included=True, availability="specialty")
comp("ndole", "Ndolé (Cameroon)", SG, WA, "cameroon", "LD", 3, 90, 1, ["saucy", "nutty", "bitter_greens", "weekend_cook"],
     ["ndole-leaves", "groundnuts", "beef?", "prawns?", "onion", "garlic", "vegetable-oil", "seasoning-cube", "salt"], popularity=0.15)
comp("maafe", "Maafe (peanut stew)", SG, WA, "senegal", "LD", 2, 70, 1, ["saucy", "nutty", "comfort"],
     ["groundnut-paste", "beef", "tomato-paste", "onion", "carrot?", "sweet-potato?", "rice-foreign-parboiled", "seasoning-cube", "salt"], popularity=0.2, protein_included=True)
comp("ugali-and-sukuma", "Ugali and sukuma wiki (Kenya)", SG, EA, "kenya", "LD", 1, 30, 0, ["base_maize", "light", "herby"],
     ["maize-meal-white", "kale-sukuma", "tomato-fresh", "onion", "vegetable-oil", "salt"], popularity=0.15)
comp("nyama-choma", "Nyama choma (Kenya)", SG, EA, "kenya", "LDN", 2, 60, 1, ["grilled", "smoky", "protein_goat"],
     ["goat-meat-raw", "salt", "lemon?", "tomato-fresh?", "onion?"], popularity=0.15, protein_included=True)
comp("chapati-and-beans", "Chapati and beans (East Africa)", SG, EA, "kenya", "BLD", 2, 60, 0, ["base_wheat", "base_beans", "comfort"],
     ["wheat-flour", "vegetable-oil", "beans-brown", "tomato-fresh", "onion", "salt"], popularity=0.15)
comp("injera-and-doro-wat", "Injera and doro wat (Ethiopia)", SG, EA, "ethiopia", "LD", 3, 120, 3, ["saucy", "peppery", "festive", "protein_chicken", "weekend_cook"],
     ["teff-flour", "chicken", "onion", "berbere", "eggs", "butter-margarine", "garlic", "ginger", "salt"], popularity=0.1,
     protein_included=True, availability="specialty", note="Teff is hard to find in Lagos; keep for Explore, rarely suggested")
comp("pap-and-chakalaka", "Pap and chakalaka (South Africa)", SG, SA, "south_africa", "LD", 1, 35, 2, ["base_maize", "peppery"],
     ["maize-meal-white", "baked-beans", "carrot", "tatashe", "onion", "chilli-chakalaka-spice", "vegetable-oil", "salt"], popularity=0.1,
     note="Not the same as Nigerian pap (ogi); keep names distinct in copy")
comp("bunny-chow", "Bunny chow (South Africa)", SG, SA, "south_africa", "LD", 2, 60, 2, ["saucy", "comfort"],
     ["agege-bread", "beef", "irish-potato", "curry-powder", "onion", "tomato-fresh", "vegetable-oil", "salt"], popularity=0.1, protein_included=True)
comp("shakshuka", "Shakshuka (North Africa)", SG, NA, "maghreb", "BLD", 1, 25, 2, ["saucy", "quick", "breakfast_friendly", "protein_egg"],
     ["eggs", "tomato-fresh", "tatashe", "onion", "garlic", "vegetable-oil", "salt"], popularity=0.2, protein_included=True)
# --- Drinks
DR = ["drink"]
comp("zobo", "Zobo", DR, NG, "pan_nigerian", "BLDN", 1, 40, 0, ["sweet", "sour_tangy", "no_cook"], ["hibiscus-zobo", "pineapple?", "cloves-ginger-mix", "sugar?"],
     local={"ha": "zobo"}, popularity=0.5)
comp("kunun-aya", "Kunun aya (tiger nut drink)", DR, NG, "northern", "BLDN", 2, 30, 0, ["sweet", "creamy"], ["tiger-nuts", "coconut?", "sugar?", "cloves-ginger-mix?"],
     local={"ha": "kunun aya"}, popularity=0.3, forgotten=True)
comp("kunu-zaki", "Kunu zaki", DR + ["breakfast_partner"], NG, "northern", "BLDN", 2, 60, 0, ["sweet", "light"], ["millet", "cloves-ginger-mix", "sugar?"],
     local={"ha": "kunun zaki"}, popularity=0.3, forgotten=True)
comp("fura-da-nono", "Fura da nono", DR + ["breakfast_partner"], NG, "northern", "BLD", 2, 60, 0, ["creamy", "filling"], ["millet", "nono", "sugar?"],
     local={"ha": "fura da nono"}, popularity=0.25, forgotten=True)

COMPONENT_SLUGS = {c["slug"] for c in C}

# ---------------------------------------------------------------------------
# Plate templates (doc 05 section 3)
TEMPLATES = [
 dict(key="soup_swallow", name="Soup and swallow", meal_times=["lunch", "dinner"], main_slot="soup",
      slots=[dict(key="soup", types=["soup"], min=1, max=2, second_requires_pairing=True),
             dict(key="swallow", types=["swallow"], min=1, max=1),
             dict(key="stew", types=["sauce"], min=0, max=1, requires_pairing_with="soup", min_pairing=0.8),
             dict(key="protein", types=["protein"], min=0, max=2)]),
 dict(key="rice_plate", name="Rice plate", meal_times=["lunch", "dinner", "late_night"], main_slot="rice",
      slots=[dict(key="rice", types=["rice"], min=1, max=1),
             dict(key="sauce", types=["sauce"], min=0, max=1, required_when="rice.needs_sauce"),
             dict(key="protein", types=["protein"], min=0, max=1),
             dict(key="side", types=["side"], min=0, max=2)]),
 dict(key="one_pot", name="One-pot", meal_times=["breakfast", "lunch", "dinner"], main_slot="main",
      slots=[dict(key="main", types=["one_pot"], min=1, max=1),
             dict(key="sauce", types=["sauce"], min=0, max=1, requires_pairing_with="main", min_pairing=0.9),
             dict(key="protein", types=["protein"], min=0, max=1),
             dict(key="side", types=["side"], min=0, max=1)]),
 dict(key="breakfast_pair", name="Breakfast pair", meal_times=["breakfast", "late_night"], main_slot="main",
      slots=[dict(key="main", types=["breakfast_main"], min=1, max=1),
             dict(key="partner", types=["breakfast_partner"], min=0, max=1),
             dict(key="protein", types=["protein"], min=0, max=1)]),
 dict(key="yam_plantain_sauce", name="Yam, plantain or potato with sauce", meal_times=["breakfast", "lunch", "dinner"], main_slot="base",
      slots=[dict(key="base", types=["tuber_base"], min=1, max=1),
             dict(key="sauce", types=["sauce"], min=1, max=1),
             dict(key="protein", types=["protein"], min=0, max=1)]),
 dict(key="pasta_noodles", name="Pasta or noodles", meal_times=["breakfast", "lunch", "dinner", "late_night"], main_slot="main",
      slots=[dict(key="main", types=["pasta_noodle"], min=1, max=1),
             dict(key="protein", types=["protein"], min=0, max=1),
             dict(key="side", types=["side"], min=0, max=1)]),
 dict(key="single", name="Complete dish", meal_times=["breakfast", "lunch", "dinner", "late_night"], main_slot="main",
      slots=[dict(key="main", types=["single"], min=1, max=1),
             dict(key="side", types=["side"], min=0, max=1, requires_pairing_with="main", min_pairing=0.7)]),
 dict(key="snack", name="Snack", meal_times=["breakfast", "lunch", "dinner", "late_night"], main_slot="main",
      slots=[dict(key="main", types=["snack"], min=1, max=1),
             dict(key="drink", types=["drink"], min=0, max=1)]),
]

# ---------------------------------------------------------------------------
# Pairing defaults by slot type pair, then explicit pairs (doc 05 section 4)
PAIRING_DEFAULTS = [
 dict(a="soup", b="swallow", score=0.6), dict(a="soup", b="protein", score=0.7),
 dict(a="soup", b="sauce", score=0.0), dict(a="soup", b="soup", score=0.0),
 dict(a="rice", b="sauce", score=0.6), dict(a="rice", b="protein", score=0.7), dict(a="rice", b="side", score=0.6),
 dict(a="sauce", b="protein", score=0.7), dict(a="sauce", b="side", score=0.5),
 dict(a="one_pot", b="protein", score=0.6), dict(a="one_pot", b="side", score=0.5), dict(a="one_pot", b="sauce", score=0.0),
 dict(a="breakfast_main", b="breakfast_partner", score=0.5), dict(a="breakfast_main", b="protein", score=0.5),
 dict(a="breakfast_partner", b="protein", score=0.5),
 dict(a="tuber_base", b="sauce", score=0.6), dict(a="tuber_base", b="protein", score=0.6),
 dict(a="pasta_noodle", b="protein", score=0.7), dict(a="pasta_noodle", b="side", score=0.5),
 dict(a="single", b="side", score=0.0), dict(a="snack", b="drink", score=0.5),
 dict(a="swallow", b="protein", score=0.7), dict(a="protein", b="side", score=0.6), dict(a="side", b="side", score=0.5),
 dict(a="swallow", b="sauce", score=0.0),
]
P = []
def pair(a, b, s, note=None):
    for x in (a, b):
        if x not in COMPONENT_SLUGS:
            sys.exit(f"Unknown component in pairing: {x}")
    P.append(dict(a=a, b=b, score=s, note=note, status="draft"))

# Soup + swallow
for sw, s in [("amala", .95), ("lafun", .85)]: pair("ewedu", sw, s); pair("gbegiri", sw, s - .05)
pair("ewedu", "gbegiri", 1.0, "Abula: ewedu and gbegiri together")
pair("ewedu", "buka-stew", .95, "Abula stew"); pair("gbegiri", "buka-stew", .95)
for sw, s in [("amala", .8), ("pounded-yam", .9), ("eba", .8), ("semo", .8), ("wheat-swallow", .75), ("lafun", .7), ("unripe-plantain-swallow", .7)]:
    pair("efo-riro", sw, s)
for sw, s in [("pounded-yam", .95), ("eba", .9), ("fufu", .85), ("semo", .85), ("wheat-swallow", .8), ("amala", .7), ("unripe-plantain-swallow", .75), ("tuwo-shinkafa", .55)]:
    pair("egusi-soup", sw, s)
for sw, s in [("eba", .9), ("fufu", .85), ("semo", .85), ("wheat-swallow", .8), ("pounded-yam", .8), ("amala", .65)]:
    pair("ogbono-soup", sw, s)
for sw, s in [("eba", .9), ("semo", .85), ("pounded-yam", .8), ("amala", .7), ("wheat-swallow", .8), ("tuwo-masara", .8), ("tuwo-shinkafa", .75), ("unripe-plantain-swallow", .75)]:
    pair("okra-soup", sw, s)
for soup in ["edikang-ikong", "afang-soup"]:
    for sw, s in [("pounded-yam", .9), ("eba", .85), ("fufu", .9), ("semo", .8)]:
        pair(soup, sw, s)
for soup in ["oha-soup", "bitterleaf-soup", "ofe-owerri"]:
    for sw, s in [("fufu", .9), ("pounded-yam", .85), ("eba", .85), ("semo", .75)]:
        pair(soup, sw, s)
for sw, s in [("pounded-yam", .9), ("fufu", .85), ("eba", .7)]: pair("nsala-soup", sw, s)
for sw, s in [("starch-usi", .98), ("eba", .75), ("pounded-yam", .7)]: pair("banga-soup", sw, s)
for sw, s in [("starch-usi", .95), ("eba", .6)]: pair("owo-soup", sw, s)
for sw, s in [("starch-usi", .7), ("pounded-yam", .8), ("eba", .75), ("fufu", .8)]: pair("fisherman-soup", sw, s)
for soup in ["miyan-kuka", "miyan-taushe"]:
    for sw, s in [("tuwo-shinkafa", .95), ("tuwo-masara", .9)]:
        pair(soup, sw, s)
for sw, s in [("pounded-yam", .9), ("eba", .8), ("fufu", .8)]: pair("black-soup", sw, s)
for sw, s in [("fufu", .85), ("pounded-yam", .85), ("eba", .8)]: pair("atama-soup", sw, s)
for soup in ["light-soup", "groundnut-soup-ghana"]: pair(soup, "fufu-ghana", .95)
for sw, s in [("eba", .9), ("fufu", .85)]: pair("eru", sw, s)
# Soup + protein
for pr, s in [("goat-meat", .9), ("assorted-meat", .9), ("beef", .85), ("chicken", .55), ("fried-fish", .6), ("ponmo", .8)]: pair("egusi-soup", pr, s)
for pr, s in [("assorted-meat", .9), ("ponmo", .9), ("beef", .85), ("goat-meat", .85)]: pair("efo-riro", pr, s)
for pr, s in [("beef", .85), ("assorted-meat", .85), ("goat-meat", .8), ("fried-fish", .7)]: pair("ogbono-soup", pr, s)
for pr, s in [("assorted-meat", .85), ("fried-fish", .8), ("beef", .8), ("catfish", .8)]: pair("okra-soup", pr, s)
for soup in ["edikang-ikong", "afang-soup"]:
    for pr, s in [("assorted-meat", .9), ("snail", .9), ("beef", .85), ("goat-meat", .85)]:
        pair(soup, pr, s)
for soup in ["oha-soup", "bitterleaf-soup", "ofe-owerri"]:
    for pr, s in [("assorted-meat", .9), ("goat-meat", .85), ("beef", .85)]:
        pair(soup, pr, s)
for pr, s in [("catfish", .9), ("beef", .7)]: pair("banga-soup", pr, s)
for pr, s in [("beef", .75), ("goat-meat", .7)]: pair("miyan-kuka", pr, s); pair("miyan-taushe", pr, s)
for pr, s in [("assorted-meat", .95), ("beef", .9), ("ponmo", .9)]: pair("buka-stew", pr, s)
# Rice
for x, s in [("chicken", .95), ("turkey", .9), ("beef", .85), ("fried-fish", .75), ("boiled-egg", .7), ("dodo", .95), ("moi-moi", .85), ("coleslaw", .85), ("nigerian-salad", .85), ("gizdodo", .8)]:
    pair("jollof-rice", x, s)
for x, s in [("chicken", .95), ("turkey", .9), ("beef", .8), ("dodo", .85), ("coleslaw", .9), ("nigerian-salad", .8), ("moi-moi", .75), ("gizdodo", .8)]:
    pair("fried-rice", x, s)
pair("jollof-rice", "tomato-stew", .3, "Some people add stew; keep low"); pair("fried-rice", "tomato-stew", .2)
for x, s in [("tomato-stew", .95), ("ofe-akwu", .95), ("buka-stew", .85), ("ayamase", .8), ("garden-egg-sauce", .8), ("corned-beef-sauce", .8), ("egg-sauce", .6),
             ("dodo", .9), ("chicken", .85), ("beef", .85), ("fried-fish", .85), ("boiled-egg", .7), ("assorted-meat", .8), ("moi-moi", .75)]:
    pair("white-rice", x, s)
for x, s in [("ayamase", .98), ("buka-stew", .8), ("dodo", .85), ("assorted-meat", .9), ("boiled-egg", .85), ("ponmo", .8)]:
    pair("ofada-rice", x, s)
for x, s in [("chicken", .85), ("fried-fish", .8), ("dodo", .8), ("coleslaw", .7)]: pair("coconut-rice", x, s)
for x, s in [("fried-fish", .85), ("ponmo", .8), ("dodo", .7), ("boiled-egg", .7)]: pair("native-jollof", x, s)
for x, s in [("tomato-stew", .95), ("ofe-akwu", .7), ("buka-stew", .8), ("dodo", .9), ("fried-fish", .85), ("chicken", .8), ("boiled-egg", .7)]:
    pair("rice-and-beans", x, s)
pair("pilau", "beef", .9)
# One-pot
for x, s in [("fried-fish", .85), ("dodo", .4)]: pair("yam-porridge", x, s)
for x, s in [("dodo", .95), ("agege-bread", .7), ("fried-fish", .8)]: pair("beans-porridge", x, s)
for x, s in [("agoyin-sauce", 1.0), ("agege-bread", .98), ("dodo", .9)]: pair("ewa-agoyin", x, s)
for x, s in [("fried-fish", .8)]: pair("plantain-porridge", x, s); pair("unripe-plantain-porridge", x, s + .05)
pair("adalu", "dodo", .7); pair("sweet-potato-porridge", "fried-fish", .75)
pair("ekuru", "buka-stew", .8, "Ekuru with fried pepper sauce")
# Breakfast
for x, s in [("pap", .95), ("agege-bread", .9), ("custard", .8), ("oats", .7), ("agidi", .85), ("kunu-zaki", .75)]: pair("akara", x, s)
for x, s in [("pap", .95), ("custard", .85), ("agidi", .9), ("agege-bread", .8)]: pair("moi-moi", x, s)
for x, s in [("tea-with-milk", .85), ("fried-egg", .9), ("boiled-egg", .75)]: pair("agege-bread", x, s)
for x, s in [("kunu-zaki", .85), ("tea-with-milk", .6)]: pair("masa", x, s)
pair("ekuru", "pap", .7)
# Tuber bases with sauces
for base, sc in [("boiled-yam", {"egg-sauce": .95, "garden-egg-sauce": .9, "tomato-stew": .85, "corned-beef-sauce": .8}),
                 ("fried-yam", {"egg-sauce": .7, "tomato-stew": .75, "buka-stew": .8}),
                 ("boiled-plantain", {"egg-sauce": .9, "garden-egg-sauce": .9, "tomato-stew": .8}),
                 ("boiled-sweet-potato", {"egg-sauce": .85, "tomato-stew": .75}),
                 ("irish-potatoes", {"egg-sauce": .85, "corned-beef-sauce": .8, "tomato-stew": .75}),
                 ("dodo", {"egg-sauce": .9, "tomato-stew": .75})]:
    for sauce, s in sc.items():
        pair(base, sauce, s)
for x, s in [("fried-fish", .75), ("fried-egg", .7)]: pair("fried-yam", x, s)
# Pasta and noodles
for x, s in [("chicken", .85), ("fried-fish", .75), ("dodo", .7), ("boiled-egg", .7), ("beef", .75)]: pair("jollof-spaghetti", x, s)
for x, s in [("chicken", .8), ("beef", .7), ("fried-egg", .6)]: pair("stir-fry-spaghetti", x, s)
for x, s in [("chicken", .8), ("fried-fish", .7)]: pair("jollof-macaroni", x, s)
for x, s in [("fried-egg", .95), ("boiled-egg", .8), ("dodo", .8)]: pair("instant-noodles", x, s)
# Singles with sides
for x, s in [("agidi", .8)]: pair("goat-pepper-soup", x, s); pair("catfish-pepper-soup", x, s)
# Snacks with drinks
for sn in ["puff-puff", "meat-pie", "chin-chin", "akara"]:
    pair(sn, "zobo", .75)
pair("puff-puff", "kunun-aya", .6)

# Classic plates promoted in Explore and as popularity anchors (curated)
CLASSIC_PLATES = [
 "soup_swallow:soup=ewedu+gbegiri,swallow=amala,stew=buka-stew,protein=assorted-meat",
 "soup_swallow:soup=egusi-soup,swallow=pounded-yam,protein=goat-meat",
 "soup_swallow:soup=okra-soup,swallow=eba,protein=fried-fish",
 "soup_swallow:soup=banga-soup,swallow=starch-usi,protein=catfish",
 "soup_swallow:soup=miyan-kuka,swallow=tuwo-shinkafa,protein=beef",
 "rice_plate:rice=jollof-rice,protein=chicken,side=dodo",
 "rice_plate:rice=ofada-rice,sauce=ayamase,protein=assorted-meat,side=dodo",
 "rice_plate:rice=white-rice,sauce=ofe-akwu,protein=fried-fish",
 "one_pot:main=ewa-agoyin,sauce=agoyin-sauce,side=agege-bread",
 "one_pot:main=beans-porridge,side=dodo",
 "breakfast_pair:main=akara,partner=pap",
 "yam_plantain_sauce:base=boiled-yam,sauce=egg-sauce",
 "pasta_noodles:main=instant-noodles,protein=fried-egg",
]

# ---------------------------------------------------------------------------
# Derive allergens and vegetarian flags from ingredient lines
IMAP = {x["slug"]: x for x in I}
for c in C:
    contains, may, opt_contains = set(), set(), set()
    veg_ok, veg_ok_if_optional_dropped = True, True
    for ln in c["ingredient_lines"]:
        ig = IMAP[ln["ingredient"]]
        target = opt_contains if ln["optional"] else contains
        target.update(ig["allergens"])
        may.update(ig["may_contain"])
        if ig["animal"]:
            veg_ok = False
            if not ln["optional"]:
                veg_ok_if_optional_dropped = False
    c["allergens_essential"] = sorted(contains)
    c["allergens_optional"] = sorted(opt_contains - contains)
    c["allergens_may_contain"] = sorted(may - contains - opt_contains)
    c["vegetarian_as_written"] = veg_ok
    c["vegetarian_ok"] = veg_ok_if_optional_dropped

# ---------------------------------------------------------------------------
# What's in the house (D-18) and minimum pots (D-17)
# house_group: "foodstuff" items drive suggestions and come off the price; "basic" items only come off the price.
HOUSE_FOODSTUFF = ["rice-local-parboiled", "rice-foreign-parboiled", "ofada-rice", "garri-white", "garri-yellow",
                   "semolina", "yam-flour", "spaghetti", "macaroni", "instant-noodles", "agege-bread",
                   "beans-brown", "beans-white", "yam", "plantain-ripe", "plantain-unripe", "sweet-potato",
                   "irish-potato", "eggs", "oats", "custard-powder"]
HOUSE_BASIC = ["vegetable-oil", "palm-oil", "salt", "seasoning-cube", "curry-powder", "thyme", "bay-leaves",
               "tomato-paste", "onion", "scotch-bonnet", "tatashe", "tomato-fresh", "crayfish", "sugar",
               "dried-pepper", "garlic", "ginger", "milk-evaporated", "milk-powder", "butter-margarine"]
for x in I:
    x["house_group"] = "foodstuff" if x["slug"] in HOUSE_FOODSTUFF else ("basic" if x["slug"] in HOUSE_BASIC else None)
    x.pop("pantry_staple", None)
missing = [s for s in HOUSE_FOODSTUFF + HOUSE_BASIC if s not in INGREDIENT_SLUGS]
if missing:
    sys.exit(f"Unknown house ingredients: {missing}")

# batch_servings_min: the smallest pot a home cook would make. Placeholders (P) for the content team to confirm.
POT_SIZE = {"tomato-stew": 6, "buka-stew": 6, "ayamase": 6, "ofe-akwu": 6, "agoyin-sauce": 4,
            "garden-egg-sauce": 2, "goat-pepper-soup": 2, "catfish-pepper-soup": 2}
COOKED_CHIPS = ["tomato-stew", "egusi-soup", "efo-riro", "ogbono-soup", "okra-soup", "ayamase",
                "buka-stew", "edikang-ikong", "afang-soup", "banga-soup", "beans-porridge", "ofe-akwu"]
CSLUGS = {c["slug"] for c in C}
for c in C:
    if c["slug"] in POT_SIZE:
        c["batch_servings_min"] = POT_SIZE[c["slug"]]
    elif "soup" in c["types"]:
        c["batch_servings_min"] = 4
    elif c["slug"] in ("beans-porridge", "moi-moi"):
        c["batch_servings_min"] = 4
    else:
        c["batch_servings_min"] = 1
    c["house_chip"] = c["slug"] in COOKED_CHIPS
missing = [s for s in COOKED_CHIPS + list(POT_SIZE) if s not in CSLUGS]
if missing:
    print("Note: cooked chips or pot sizes not in catalogue:", missing)

TAG_VOCAB = sorted({t for c in C for t in c["tags"]} | {"veg_friendly", "kid_friendly", "light", "filling", "mild", "peppery"})

catalogue = dict(
    meta=dict(version="0.1-draft", generated_for="SoWetin pack v1.3, 8 Nov 2026",
              note="DRAFT. Every component is status draft. Quantities and steps are filled by the authoring pipeline "
                   "(doc 05 section 5), written to the recipe standard (doc 05 section 10), reviewed and cooked from the written "
                   "steps by a human before publishing. Local names need native-speaker review."),
    allergen_vocabulary=ALLERGENS,
    tag_vocabulary=TAG_VOCAB,
    plate_templates=TEMPLATES,
    pairing_defaults=PAIRING_DEFAULTS,
    pairings=P,
    classic_plates=CLASSIC_PLATES,
    components=C,
)
ingredients = dict(
    meta=dict(version="0.1-draft", note="Market unit sizes are placeholders to be replaced by weighing during the first Lagos survey "
              "(doc 04 section 6). reference_observations come from public reports and are sanity checks only, never shown to users as prices."),
    ingredients=I,
)
DATA.mkdir(exist_ok=True)
(DATA / "catalogue-seed.json").write_text(json.dumps(catalogue, ensure_ascii=False, indent=1))
(DATA / "ingredients-seed.json").write_text(json.dumps(ingredients, ensure_ascii=False, indent=1))

from collections import Counter
types = Counter(t for c in C for t in c["types"])
print(f"components: {len(C)}  ingredients: {len(I)}  pairings: {len(P)}  templates: {len(TEMPLATES)}")
print("by type:", dict(types))
print("forgotten classics:", sum(c['forgotten_classic'] for c in C))
print("unused ingredients:", sorted(INGREDIENT_SLUGS - {l['ingredient'] for c in C for l in c['ingredient_lines']}))
