import time
import json
import os
import hashlib
import urllib.request
import urllib.parse
import ssl
import threading
from flask import Flask, request, redirect

# ══════════════════════════════════════════
#  CONFIG
# ══════════════════════════════════════════
BOT_TOKEN      = "5713654811:AAHfzPDk5LHQ8-DI2ELzQseRn_s0GEykbZE"
CHANNEL_ID     = "@FY_TF"
PHONE          = "01003971136"
PASSWORD       = "1052003Mm$#@"
CHECK_INTERVAL = 15
MIN_GIFT       = 85
MAX_CARDS      = 2

# ✅ رابط السيرفر بتاعك على Railway
PUBLIC_URL = "https://gems-production-ac3f.up.railway.app"

# ✅ Railway بيحدد PORT تلقائياً من env
SERVER_PORT = int(os.environ.get("PORT", 5000))

STATE_FILE  = "bot_state.json"
OFFSET_FILE = "tg_offset.txt"
TG_URL      = f"https://api.telegram.org/bot{BOT_TOKEN}/"

CURRENT_TOKEN      = None
TOKEN_EXPIRY       = 0
LAST_RESPONSE_HASH = None

SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode    = ssl.CERT_NONE

# ══════════════════════════════════════════
#  FLASK SERVER
# ══════════════════════════════════════════
flask_app = Flask(__name__)

@flask_app.route("/")
def home():
    return "✅ TALASHNY Server Running", 200

@flask_app.route("/recharge")
def recharge():
    serial = request.args.get("serial", "").strip()
    serial = "".join(c for c in serial if c.isdigit())

    if len(serial) != 13:
        return "❌ رقم الكارت غلط", 400

    ussd = f"*858*{serial}#"
    tel  = "tel:" + urllib.parse.quote(ussd, safe="")
    return redirect(tel, code=302)

def run_flask():
    flask_app.run(host="0.0.0.0", port=SERVER_PORT, use_reloader=False)

# ══════════════════════════════════════════
#  LOGGER
# ══════════════════════════════════════════
def log(level, msg):
    print(f"[{time.strftime('%H:%M:%S')}] [{level}] {msg}", flush=True)

# ══════════════════════════════════════════
#  HTTP
# ══════════════════════════════════════════
def http_get(url, headers=None):
    req = urllib.request.Request(url, headers=headers or {})
    with urllib.request.urlopen(req, context=SSL_CTX, timeout=15) as res:
        return res.read().decode()

def http_post(url, data, headers=None):
    body = urllib.parse.urlencode(data).encode()
    req  = urllib.request.Request(url, data=body, headers=headers or {}, method="POST")
    with urllib.request.urlopen(req, context=SSL_CTX, timeout=15) as res:
        return res.read().decode()

def http_post_json(url, payload):
    body = json.dumps(payload).encode()
    req  = urllib.request.Request(
        url, data=body,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req, context=SSL_CTX, timeout=15) as res:
        return res.read().decode()

# ══════════════════════════════════════════
#  TELEGRAM
# ══════════════════════════════════════════
def tg(method, **params):
    try:
        raw = http_post_json(TG_URL + method, params)
        d   = json.loads(raw)
        if not d.get("ok"):
            desc = d.get("description", "")
            if "not modified" not in desc and "not found" not in desc:
                log("WARN", f"TG[{method}]: {desc}")
            return None
        return d.get("result")
    except Exception as e:
        log("ERR", f"TG[{method}]: {e}")
        return None

# ══════════════════════════════════════════
#  VODAFONE
# ══════════════════════════════════════════
def vf_login():
    try:
        raw = http_post(
            "https://mobile.vodafone.com.eg/auth/realms/vf-realm/protocol/openid-connect/token",
            data={
                "grant_type":    "password",
                "username":      PHONE,
                "password":      PASSWORD,
                "client_secret": "95fd95fb-7489-4958-8ae6-d31a525cd20a",
                "client_id":     "ana-vodafone-app"
            },
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept":       "application/json",
                "User-Agent":   "okhttp/4.11.0"
            }
        )
        data       = json.loads(raw)
        token      = data.get("access_token")
        expires_in = data.get("expires_in", 3600)
        if token:
            log("INFO", f"✅ VF Login OK | ~{expires_in//60} min")
            return token, time.time() + expires_in - 180
        log("ERR", f"❌ Login failed: {data.get('error_description','?')}")
        return None, 0
    except Exception as e:
        log("ERR", f"vf_login: {e}")
        return None, 0

def get_token():
    global CURRENT_TOKEN, TOKEN_EXPIRY
    if CURRENT_TOKEN and time.time() < TOKEN_EXPIRY:
        return CURRENT_TOKEN
    log("INFO", "🔑 Refreshing token...")
    token, expiry = vf_login()
    if token:
        CURRENT_TOKEN = token
        TOKEN_EXPIRY  = expiry
    return token

def vf_promos(token):
    try:
        raw_text = http_get(
            f"https://web.vodafone.com.eg/services/dxl/ramadanpromo/promotion"
            f"?@type=RamadanHub&channel=website&msisdn={PHONE}",
            headers={
                "Authorization":   f"Bearer {token}",
                "User-Agent":      "Mozilla/5.0",
                "Accept":          "application/json",
                "clientId":        "WebsiteConsumer",
                "api-host":        "PromotionHost",
                "channel":         "WEB",
                "Accept-Language": "ar",
                "msisdn":          PHONE,
                "Content-Type":    "application/json",
                "Referer":         "https://web.vodafone.com.eg/ar/ramadan"
            }
        )
        data  = json.loads(raw_text)
        cards = []

        for item in data:
            if not isinstance(item, dict) or "pattern" not in item:
                continue
            for pat in item["pattern"]:
                for action in pat.get("action", []):
                    c = {x["name"]: str(x["value"])
                         for x in action.get("characteristics", [])}
                    if not c:
                        continue

                    try:
                        gift = int(c.get("GIFT_UNITS", 0))
                    except:
                        continue

                    if gift < MIN_GIFT:
                        continue

                    serial = str(c.get("CARD_SERIAL", "")).strip()
                    if len(serial) != 13:
                        log("WARN", f"⚠️ Skip serial [{serial}] ({len(serial)} digits)")
                        continue

                    try:
                        amount    = int(c.get("amount", 0))
                        remaining = int(c.get("REMAINING_DEDICATIONS", 0))
                    except:
                        continue

                    cards.append({
                        "serial":    serial,
                        "gift":      gift,
                        "amount":    amount,
                        "remaining": remaining,
                    })

        cards.sort(key=lambda x: (x["gift"], x["amount"]), reverse=True)
        log("INFO", f"✅ {len(cards)} cards passed gift >= {MIN_GIFT} filter")
        return raw_text, cards

    except Exception as e:
        log("WARN", f"vf_promos: {e}")
        return None, []

def best_cards(cards):
    return cards[:MAX_CARDS]

# ══════════════════════════════════════════
#  MESSAGE
# ══════════════════════════════════════════
def build_msg(card):
    serial = str(card["serial"]).strip()
    ussd   = "*858*" + serial + "#"

    recharge_url = f"https://telegrambot.serv00.net/t.php?serial={serial}"
    text = f"""
╭────═⟃TALASHNY⟄═────╮
│            *Vodafone Card*
│╭────✦───✦───╮
╞╡ *Value:* ʚجنيه `{card['amount']}`
╞╡ *Gift Units:* ʚوحده `{card['gift']}`
╞╡ *Remaining:* ʚمتبقي `{card['remaining']}`
│╰────✦───✦───╯
│╭──────✦──────────╮
╞╡*Recharge Code:* `{ussd}`   
│╰──────✦──────────╯
╰────═⟃TALASHNY⟄═────╯"""

    keyboard = {
        "inline_keyboard": [[
            {
                "text": "📞 شحن الآن",
                "url": recharge_url
            }
        ]]
    }

    return text, keyboard

# ══════════════════════════════════════════
#  STATE
# ══════════════════════════════════════════
def load_state():
    return json.load(open(STATE_FILE, encoding="utf-8")) \
           if os.path.exists(STATE_FILE) else {}

def save_state(s):
    json.dump(s, open(STATE_FILE, "w", encoding="utf-8"),
              ensure_ascii=False, indent=2)

def load_offset():
    return int(open(OFFSET_FILE).read().strip()) \
           if os.path.exists(OFFSET_FILE) else 0

def save_offset(o):
    open(OFFSET_FILE, "w").write(str(o))

def clear_pending():
    res = tg("getUpdates", offset=-1, limit=1)
    if res:
        last = res[0]["update_id"]
        tg("getUpdates", offset=last+1)
        save_offset(last+1)
        log("INFO", f"🧹 Cleared — offset={last+1}")
    else:
        save_offset(0)

def handle_callbacks():
    offset  = load_offset()
    updates = tg("getUpdates", offset=offset, limit=85,
                 timeout=0, allowed_updates=["callback_query"])
    if updates:
        for upd in updates:
            save_offset(upd["update_id"] + 1)

# ══════════════════════════════════════════
#  MAIN CHECK
# ══════════════════════════════════════════
def check_and_update():
    global LAST_RESPONSE_HASH

    log("INFO", "🔄 Checking...")
    token = get_token()
    if not token:
        log("ERR", "❌ No token")
        return

    raw_text, all_cards = vf_promos(token)
    if raw_text is None:
        return

    current_hash = hashlib.md5(raw_text.encode()).hexdigest()
    if current_hash == LAST_RESPONSE_HASH:
        log("INFO", "⚡ No changes")
        return

    LAST_RESPONSE_HASH = current_hash
    log("INFO", "🔁 Changes detected — processing...")

    target     = best_cards(all_cards)
    target_map = {c["serial"]: c for c in target}
    state      = load_state()

    for mid in list(state.keys()):
        serial = state[mid]["serial"]
        live   = target_map.get(serial)
        if not live or live["remaining"] <= 0:
            tg("deleteMessage", chat_id=CHANNEL_ID, message_id=int(mid))
            del state[mid]
            log("INFO", f"🗑️ Deleted {mid}")

    for mid, cd in list(state.items()):
        live = target_map.get(cd["serial"])
        if live and live["remaining"] != cd["remaining"]:
            cd["remaining"] = live["remaining"]
            txt, kb = build_msg(cd)
            tg("editMessageText", chat_id=CHANNEL_ID,
               message_id=int(mid), text=txt,
               parse_mode="Markdown", reply_markup=kb)
            log("INFO", f"✏️ Updated {mid}")

    sent = {v["serial"] for v in state.values()}
    for serial, card in target_map.items():
        if len(state) >= MAX_CARDS:
            break
        if serial not in sent and card["remaining"] > 0:
            txt, kb = build_msg(card)
            res = tg("sendMessage", chat_id=CHANNEL_ID,
                     text=txt, parse_mode="Markdown",
                     reply_markup=kb)
            if res and "message_id" in res:
                state[str(res["message_id"])] = card.copy()
                log("INFO", f"📤 Sent [{serial}] gift={card['gift']}")

    save_state(state)
    log("INFO", f"✅ Done — {len(state)} active")

# ══════════════════════════════════════════
#  MAIN
# ══════════════════════════════════════════
if __name__ == "__main__":
    log("INFO", "🚀 TALASHNY | Bot + Server on Railway")

    # ✅ Flask في thread منفصل
    t = threading.Thread(target=run_flask, daemon=True)
    t.start()
    log("INFO", f"🌐 Flask running on port {SERVER_PORT}")

    token, expiry = vf_login()
    if token:
        CURRENT_TOKEN = token
        TOKEN_EXPIRY  = expiry

    clear_pending()
    last_check = 0
    fail_count = 0

    while True:
        try:
            handle_callbacks()
            if time.time() - last_check >= CHECK_INTERVAL:
                check_and_update()
                last_check = time.time()
            fail_count = 0
            time.sleep(1)

        except KeyboardInterrupt:
            log("INFO", "🛑 Stopped")
            break
        except Exception as e:
            fail_count += 1
            log("ERR", f"Error #{fail_count}: {e}")
            time.sleep(5 if fail_count < 10 else 30)

