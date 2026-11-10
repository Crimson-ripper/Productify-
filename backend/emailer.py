"""Transactional email for Productify, sent with Resend from noreply@productifynow.com.

RESEND_API_KEY comes from the environment (Render). Without it, emails are logged and skipped,
so nothing breaks before the key is set. Sending never raises into request handlers.
"""
import html
import logging
import os

import httpx

log = logging.getLogger("emailer")

FROM = os.environ.get("EMAIL_FROM", "Productify <noreply@productifynow.com>")
REPLY_TO = os.environ.get("EMAIL_REPLY_TO", "support@productifynow.com")
SITE = os.environ.get("FRONTEND_URL", "https://www.productifynow.com").rstrip("/")


def _layout(title: str, body_html: str, button: tuple | None = None) -> str:
    btn = ""
    if button:
        label, url = button
        btn = (f'<p style="margin:28px 0"><a href="{html.escape(url)}" style="background:#c8f04c;color:#0a0a0b;'
               f'padding:12px 22px;text-decoration:none;font-weight:700;display:inline-block">{html.escape(label)}</a></p>')
    return f"""<!doctype html><html><body style="margin:0;background:#f4f4f1;font-family:Arial,Helvetica,sans-serif;color:#18181b">
<div style="max-width:560px;margin:0 auto;padding:32px 20px">
<div style="font-weight:800;font-size:20px;margin-bottom:24px">productify<span style="color:#7fa61a">.</span></div>
<div style="background:#ffffff;padding:28px 26px">
<h1 style="font-size:20px;margin:0 0 14px">{html.escape(title)}</h1>
{body_html}{btn}
</div>
<p style="font-size:12px;color:#6b6b66;margin-top:18px">Productify · <a href="{SITE}" style="color:#6b6b66">productifynow.com</a> ·
Questions? Reply to this email or write to support@productifynow.com.</p>
</div></body></html>"""


def _p(text: str) -> str:
    return f'<p style="font-size:15px;line-height:1.6;margin:0 0 12px">{html.escape(text)}</p>'


async def send(to: str, subject: str, html_body: str, text_body: str) -> bool:
    key = os.environ.get("RESEND_API_KEY", "").strip()
    if not key:
        log.warning(f"email skipped (RESEND_API_KEY not set): {subject!r} -> {to}")
        return False
    try:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.post("https://api.resend.com/emails", headers={"Authorization": f"Bearer {key}"},
                             json={"from": FROM, "to": [to], "reply_to": REPLY_TO, "subject": subject,
                                   "html": html_body, "text": text_body})
        if r.status_code >= 300:
            log.warning(f"email failed {r.status_code}: {subject!r} -> {to}: {r.text[:200]}")
            return False
        return True
    except Exception as e:  # network trouble must never break the caller
        log.warning(f"email error: {subject!r} -> {to}: {e}")
        return False


# ---------- messages ----------

def money(v: float) -> str:
    return f"${v:,.2f}"


async def verify_email(to: str, name: str, token: str):
    url = f"{SITE}/verify-email?token={token}"
    await send(to, "Confirm your email for Productify",
               _layout("Confirm your email", _p(f"Hi {name}, thanks for signing up to Productify.") +
                       _p("Please confirm this is your email address. The link works for 48 hours."),
                       ("Confirm my email", url)),
               f"Hi {name},\n\nConfirm your email for Productify: {url}\n\nThe link works for 48 hours.")


async def seller_code(to: str, name: str, code: str) -> bool:
    """6-digit code that confirms a seller's email address (Seller onboarding)."""
    return await send(to, "Your Productify verification code",  # code not in the subject: it's logged
                      _layout("Confirm your email", _p(f"Hi {name}, enter this code to confirm your email for selling on Productify:") +
                              _p(f"<b style=\"font-size:22px;letter-spacing:4px\">{code}</b>") +
                              _p("It works for 10 minutes. If you didn't ask for it, ignore this email.")),
                      f"Hi {name},\n\nYour Productify code is {code}. It works for 10 minutes.\n"
                      "If you didn't ask for it, ignore this email.")


async def welcome(to: str, name: str):
    await send(to, "Welcome to Productify",
               _layout("Welcome to Productify", _p(f"Hi {name}, your account is ready.") +
                       _p("Productify is in closed beta. You can claim $5 of free credit and rent a GPU by the hour "
                          "from the GPU rentals page. Payments are in test mode during the beta."),
                       ("Browse GPUs", f"{SITE}/rentals")),
               f"Hi {name},\n\nYour Productify account is ready. Browse GPUs: {SITE}/rentals")


async def instance_started(to: str, name: str, gpu: str, price: float, inst_id: str):
    url = f"{SITE}/instances/{inst_id}"
    await send(to, f"Your GPU instance is running ({gpu})",
               _layout("Your instance is running", _p(f"Hi {name}, your instance on {gpu} has started.") +
                       _p(f"It costs {money(price)} per hour, billed per second while it runs. "
                          "Stop it when you're done so you're not charged for idle time."),
                       ("Open the instance", url)),
               f"Hi {name},\n\nYour instance on {gpu} is running at {money(price)}/hour.\nOpen it: {url}")


async def instance_stopped(to: str, name: str, gpu: str, seconds: int, cost: float, reason: str, balance: float | None):
    hours, rem = divmod(int(seconds), 3600)
    mins = rem // 60
    why = {"stopped by user": "You stopped it.", "credits ran out": "It was stopped because your credits ran out.",
           "not_running": "It stopped on the machine (the job ended or the machine went offline)."}.get(reason, f"Reason: {reason}.")
    bal = f" Your remaining balance is {money(balance)}." if balance is not None else ""
    await send(to, f"Receipt: {money(cost)} for {gpu}",
               _layout("Your instance has stopped",
                       _p(f"Hi {name}, your instance on {gpu} has stopped. {why}") +
                       _p(f"Run time: {hours} h {mins} min. Charged: {money(cost)} in credits.{bal}") +
                       _p("The container and its files were deleted when it stopped."),
                       ("View your instances", f"{SITE}/instances")),
               f"Hi {name},\n\nYour instance on {gpu} stopped. {why}\nRun time: {hours} h {mins} min. Charged: {money(cost)}.{bal}")


async def credits_low(to: str, name: str, remaining: float, minutes_left: int):
    await send(to, "Your Productify credits are running low",
               _layout("Credits running low",
                       _p(f"Hi {name}, you have about {money(remaining)} of credit left, roughly {minutes_left} more minutes "
                          "at your instance's current price.") +
                       _p("When credits run out, your instance stops automatically and its files are deleted. "
                          "Save anything you need now."),
                       ("Open your instances", f"{SITE}/instances")),
               f"Hi {name},\n\nYou have about {money(remaining)} of credit left (~{minutes_left} min). "
               "When it runs out your instance stops and its files are deleted.")


async def gpu_available(to: str, gpu: str, rental_id: str):
    url = f"{SITE}/rental/{rental_id}"
    await send(to, f"A {gpu} is available on Productify",
               _layout("The GPU you wanted is available",
                       _p(f"The {gpu} you asked about is available right now. Machines are first come, first served.") +
                       _p("You asked to be told once; we won't email you about this machine again unless you ask."),
                       ("Rent it now", url)),
               f"The {gpu} you asked about is available now: {url}")
