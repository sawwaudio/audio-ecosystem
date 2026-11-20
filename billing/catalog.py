"""Find or create the one sandbox catalog entry, printing only public IDs."""
from urllib.parse import urlencode
from server import stripe, validate_price

NAME = "saww audio ecosystem pro"
KEY = "sae_pro_monthly"

def pages(resource,params):
    while True:
        page=stripe(resource+"?"+urlencode(dict(params,limit=100)))
        yield from page["data"]
        if not page["has_more"]:
            return
        params=dict(params,starting_after=page["data"][-1]["id"])

def setup():
    products=[p for p in pages("products",{}) if p["name"]==NAME]
    if len(products)>1 or any(not p["active"] for p in products):
        raise ValueError("Review matching sandbox products before continuing")
    product=products[0] if products else stripe("products",{"name":NAME,"description":"Professional audio environment for live performance, music production, and generative sound design."},KEY+"-product")
    matches=[]
    for p in pages("prices",{"product":product["id"],"active":"true"}):
        try:
            validate_price(p)
        except (TypeError,ValueError):
            continue
        matches.append(p)
    if len(matches)>1:
        raise ValueError("Review duplicate monthly prices")
    price=matches[0] if matches else stripe("prices",{"currency":"usd","unit_amount":999,"recurring[interval]":"month","product":product["id"],"lookup_key":KEY},KEY+"-price")
    validate_price(price)
    print(product["id"],price["id"])

if __name__=="__main__":
    setup()
