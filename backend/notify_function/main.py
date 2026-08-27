import base64
import json
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from google.cloud import firestore

GMAIL_USER = os.environ["GMAIL_USER"]
GMAIL_APP_PASSWORD = os.environ["GMAIL_APP_PASSWORD"]
SUBSCRIPTIONS_COLLECTION = os.getenv("SUBSCRIPTIONS_COLLECTION", "subscriptions")

firestore_client = firestore.Client()


def send_email(to_email, tag, full_url, thumbnail_url):
    subject = f"🦘 Aussie EcoLens — New {tag} detected!"

    html_body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #2d6a4f; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0;">🦘 Aussie EcoLens</h1>
        </div>
        <div style="padding: 20px; border: 1px solid #ddd; border-radius: 0 0 8px 8px;">
            <h2>New species detected: <strong>{tag}</strong></h2>
            <p>A new media file containing <strong>{tag}</strong> has been added to the system.</p>
            {"<img src='" + thumbnail_url + "' style='max-width:300px; border-radius:8px;'/><br/><br/>" if thumbnail_url else ""}
            <a href="{full_url}" style="
                background-color: #2d6a4f;
                color: white;
                padding: 12px 24px;
                text-decoration: none;
                border-radius: 6px;
                display: inline-block;
            ">View Full Image</a>
            <hr style="margin-top: 30px;"/>
            <p style="color: #888; font-size: 12px;">
                You received this because you subscribed to <strong>{tag}</strong> notifications on Aussie EcoLens.
            </p>
        </div>
    </body>
    </html>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = GMAIL_USER
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(GMAIL_USER, GMAIL_APP_PASSWORD)
        server.sendmail(GMAIL_USER, to_email, msg.as_string())


def notify_subscribers(event, context):
    """Triggered by a Pub/Sub message."""
    try:
        data = base64.b64decode(event["data"]).decode("utf-8")
        message = json.loads(data)
    except Exception as e:
        print(f"Failed to decode message: {e}")
        return

    tag = message.get("tag")
    full_url = message.get("fullUrl", "")
    thumbnail_url = message.get("thumbnailUrl", "")

    if not tag:
        print("No tag in message, skipping.")
        return

    print(f"Processing notification for tag: {tag}")

    # Find all subscribers for this tag
    subscribers = (
        firestore_client.collection(SUBSCRIPTIONS_COLLECTION)
        .where("tag", "==", tag)
        .stream()
    )

    sent = 0
    for sub in subscribers:
        sub_data = sub.to_dict()
        email = sub_data.get("email")
        if not email:
            continue
        try:
            send_email(email, tag, full_url, thumbnail_url)
            print(f"Email sent to {email} for tag {tag}")
            sent += 1
        except Exception as e:
            print(f"Failed to send email to {email}: {e}")

    print(f"Sent {sent} notifications for tag: {tag}")
