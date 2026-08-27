import hashlib
import json
import os
import tempfile
from datetime import datetime, timezone
from functools import wraps
from pathlib import Path
from uuid import uuid4

import cv2
import jwt
import numpy as np
import torch
import torchvision.transforms as transforms
from flask import Flask, jsonify, request
from flask_cors import CORS
from google.cloud import firestore, pubsub_v1, storage
from jwt import PyJWKClient
from PIL import Image


app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": os.getenv("CORS_ORIGINS", "*")}})

PROJECT_ID = os.getenv("GCP_PROJECT")
BUCKET_NAME = os.environ["GCS_BUCKET"]
COLLECTION = os.getenv("FIRESTORE_COLLECTION", "media")
SUBSCRIPTIONS_COLLECTION = os.getenv("SUBSCRIPTIONS_COLLECTION", "subscriptions")
PUBSUB_TOPIC = os.getenv("PUBSUB_TOPIC", "tag-notifications")

COGNITO_REGION = os.getenv("COGNITO_REGION", "us-east-1")
COGNITO_USER_POOL_ID = os.environ["COGNITO_USER_POOL_ID"]
COGNITO_APP_CLIENT_ID = os.environ["COGNITO_APP_CLIENT_ID"]
COGNITO_TOKEN_USE = os.getenv("COGNITO_TOKEN_USE", "id")

COGNITO_ISSUER = (
    f"https://cognito-idp.{COGNITO_REGION}.amazonaws.com/{COGNITO_USER_POOL_ID}"
)
JWKS_URL = f"{COGNITO_ISSUER}/.well-known/jwks.json"

storage_client = storage.Client()
firestore_client = firestore.Client()
bucket = storage_client.bucket(BUCKET_NAME)
jwks_client = PyJWKClient(JWKS_URL)
publisher = pubsub_v1.PublisherClient()

# ── ML model setup ─────────────────────────────────────────────────────────────

_CLASSES = [
    'Alectura_lathami', 'Antechinus_agilis', 'Bos_taurus', 'Burhinus_grallarius',
    'Canis_familiaris', 'Chalcophaps_longirostris', 'Colluricincla_harmonica',
    'Corcorax_melanorhamphos', 'Dacelo_novaeguineae', 'Dama_dama',
    'Eopsaltria_australis', 'Felis_catus', 'Geopelia_humeralis', 'Gymnorhina_tibicen',
    'Homo_sapiens', 'Isoodon_macrourus', 'Lepus_europaeus', 'Macropus_giganteus',
    'Menura_novaehollandiae', 'Mus_musculus', 'Oryctolagus_cuniculus',
    'Perameles_nasuta', 'Pitta_versicolor', 'Rattus', 'Rattus_fuscipes',
    'Rattus_rattus', 'Strepera_graculina', 'Sus_scrofa', 'Tachyglossus_aculeatus',
    'Thylogale_stigmatica', 'Trichosurus_caninus', 'Trichosurus_cunninghami',
    'Trichosurus_vulpecula', 'Varanus_varius', 'Vombatus_ursinus', 'Vulpes_vulpes',
    'Wallabia_bicolor', 'Canis_dingo', 'Capra_hircus', 'Casuarius_casuarius',
    'Heteromyias_cinereifrons', 'Hypsiprymnodon_moschatus', 'Megapodius_reinwardt',
    'Notamacropus_rufogriseus', 'Orthonyx_spaldingii', 'Uromys_caudimaculatus',
]

_DEVICE = (
    "cuda" if torch.cuda.is_available()
    else "mps" if torch.backends.mps.is_available()
    else "cpu"
)

_TRANSFORM = transforms.Compose([
    transforms.Resize((480, 480)),
    transforms.ToTensor(),
])

_BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# In Cloud Run, download models to /tmp; locally use same directory as main.py
if os.getenv("K_SERVICE"):
    _MODELS_DIR = "/tmp/models"
    os.makedirs(_MODELS_DIR, exist_ok=True)
else:
    _MODELS_DIR = _BASE_DIR

# Both models cached globally — loaded once, reused across all requests
_species_model = None
_megadetector_model = None


def _ensure_models_downloaded():
    """Download ML models from GCS if not present locally (Cloud Run startup)."""
    models_bucket_name = os.getenv("MODELS_BUCKET", "aussie-ecolens-0ng5zo-models")
    models_to_download = {
        "model.pt": os.path.join(_MODELS_DIR, "model.pt"),
        "mdv5a.pt": os.path.join(_MODELS_DIR, "mdv5a.pt"),
    }
    models_bucket = storage_client.bucket(models_bucket_name)
    for blob_name, local_path in models_to_download.items():
        if not os.path.exists(local_path):
            app.logger.info(f"Downloading {blob_name} from GCS to {local_path}...")
            models_bucket.blob(blob_name).download_to_filename(local_path)
            app.logger.info(f"Downloaded {blob_name} successfully.")


# Download models on startup when running in Cloud Run
if os.getenv("K_SERVICE"):
    with app.app_context():
        _ensure_models_downloaded()


def _load_species_model():
    """Load SpeciesNet once and cache globally."""
    global _species_model
    if _species_model is not None:
        return _species_model
    model_path = os.getenv("MODEL_PATH", os.path.join(_MODELS_DIR, "model.pt"))
    if not os.path.exists(model_path):
        app.logger.warning(f"Species model not found at {model_path}")
        return None
    app.logger.info(f"Loading SpeciesNet from {model_path} on {_DEVICE}")
    _species_model = torch.load(model_path, map_location=_DEVICE, weights_only=False)
    _species_model.eval()
    _species_model.to(_DEVICE)
    return _species_model


def _load_megadetector():
    """Load MegaDetector once and cache globally — reuse across all requests."""
    global _megadetector_model
    if _megadetector_model is not None:
        return _megadetector_model
    md_path = os.getenv("MEGADETECTOR_PATH", os.path.join(_MODELS_DIR, "mdv5a.pt"))
    if not os.path.exists(md_path):
        app.logger.warning(f"MegaDetector model not found at {md_path}")
        return None
    app.logger.info(f"Loading MegaDetector from {md_path}")
    from megadetector.detection import run_detector
    _megadetector_model = run_detector.load_detector(md_path)
    app.logger.info("MegaDetector loaded successfully.")
    return _megadetector_model


def _classify_crop(crop_image):
    """Run SpeciesNet on a cropped PIL Image. Returns (species, confidence)."""
    model = _load_species_model()
    if model is None:
        return "unknown", 0.0
    img_t = _TRANSFORM(crop_image.convert("RGB"))
    img_t = img_t.unsqueeze(0).permute(0, 2, 3, 1).to(_DEVICE)
    with torch.no_grad():
        probs = torch.softmax(model(img_t), dim=1)[0].cpu().numpy()
    best_idx = int(np.argmax(probs))
    return _CLASSES[best_idx], float(probs[best_idx])


def process_and_tag_image(image_path, conf_threshold=0.05, snip_size=600):
    """
    Run MegaDetector (loaded once) + SpeciesNet on a single image.
    Returns dict of {species: count}.
    """
    md_model = _load_megadetector()
    tags = {}

    try:
        img = Image.open(image_path).convert("RGB")
        W, H = img.size

        if md_model is not None:
            # Use in-memory MegaDetector — no model reload per request
            md_result = md_model.generate_detections_one_image(img)
            detections = md_result.get("detections", [])
        else:
            detections = []

        crops = []
        for det in detections:
            if det.get("category") != "1" or det.get("conf", 0) < conf_threshold:
                continue
            x, y, w, h = det["bbox"]
            left   = max(0, int(x * W))
            top    = max(0, int(y * H))
            right  = min(W, int((x + w) * W))
            bottom = min(H, int((y + h) * H))
            if right <= left or bottom <= top:
                continue
            crop = img.crop((left, top, right, bottom))
            crops.append(crop.resize((snip_size, snip_size), Image.BILINEAR))

        # Fall back to full image if no animals detected
        if not crops:
            crops = [img]

        for crop in crops:
            species, conf = _classify_crop(crop)
            if conf >= 0.3:
                tags[species] = tags.get(species, 0) + 1

    except Exception as exc:
        app.logger.warning(f"ML detection failed for {image_path}: {exc}")
        return {"unknown": 1}

    return tags if tags else {"unknown": 1}

# ── end ML model setup ─────────────────────────────────────────────────────────


class ApiError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.message = message
        self.status = status


@app.errorhandler(ApiError)
def handle_api_error(error):
    return jsonify({"message": error.message}), error.status


@app.errorhandler(Exception)
def handle_unexpected_error(error):
    app.logger.exception("Unexpected API error")
    return jsonify({"message": str(error)}), 500


def verify_token(raw_token):
    if not raw_token:
        raise ApiError("Missing bearer token.", 401)
    try:
        signing_key = jwks_client.get_signing_key_from_jwt(raw_token)
        decode_kwargs = {
            "algorithms": ["RS256"],
            "issuer": COGNITO_ISSUER,
            "options": {"require": ["exp", "iat", "sub", "token_use"]},
        }
        if COGNITO_TOKEN_USE == "id":
            decode_kwargs["audience"] = COGNITO_APP_CLIENT_ID
        claims = jwt.decode(raw_token, signing_key.key, **decode_kwargs)
    except Exception as exc:
        raise ApiError(f"Token verification failed: {exc}", 401) from exc
    if claims.get("token_use") != COGNITO_TOKEN_USE:
        raise ApiError("Wrong token type.", 401)
    if COGNITO_TOKEN_USE == "access" and claims.get("client_id") != COGNITO_APP_CLIENT_ID:
        raise ApiError("Token client_id does not match.", 401)
    return claims


def require_auth(handler):
    @wraps(handler)
    def wrapper(*args, **kwargs):
        auth = request.headers.get("Authorization", "")
        token = auth[7:] if auth.lower().startswith("bearer ") else auth
        request.user = verify_token(token)
        return handler(*args, **kwargs)
    return wrapper


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def public_url(blob_name):
    return f"https://storage.googleapis.com/{BUCKET_NAME}/{blob_name}"


def blob_name_from_url(url):
    prefix = f"https://storage.googleapis.com/{BUCKET_NAME}/"
    if not url.startswith(prefix):
        return None
    return url[len(prefix):]


def file_type_for(filename, content_type=""):
    suffix = Path(filename).suffix.lower()
    if content_type.startswith("image/") or suffix in {".jpg", ".jpeg", ".png", ".webp"}:
        return "image"
    if content_type.startswith("video/") or suffix in {".mp4", ".mov", ".avi", ".mkv"}:
        return "video"
    raise ApiError("Only image and video files are supported.", 415)


def sha256_file(path):
    digest = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def upload_file(local_path, blob_name, content_type=None):
    blob = bucket.blob(blob_name)
    blob.upload_from_filename(local_path, content_type=content_type)
    return public_url(blob_name)


def make_image_thumbnail(input_path, output_path, max_size=(360, 360)):
    image = Image.open(input_path)
    image.thumbnail(max_size)
    image.convert("RGB").save(output_path, "JPEG", quality=78, optimize=True)


def make_video_thumbnail(input_path, output_path):
    capture = cv2.VideoCapture(input_path)
    ok, frame = capture.read()
    capture.release()
    if not ok:
        raise ApiError("Could not read video frame.", 422)
    frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    image = Image.fromarray(frame)
    image.thumbnail((360, 360))
    image.save(output_path, "JPEG", quality=78, optimize=True)


def extract_video_frames(input_path, out_dir, max_frames=5):
    """Extract 1 frame per second, capped at max_frames."""
    capture = cv2.VideoCapture(input_path)
    fps = capture.get(cv2.CAP_PROP_FPS) or 1
    frame_interval = max(int(round(fps)), 1)
    frame_index = 0
    saved = []
    while True:
        ok, frame = capture.read()
        if not ok:
            break
        if frame_index % frame_interval == 0:
            frame_path = os.path.join(out_dir, f"frame_{len(saved):04d}.jpg")
            cv2.imwrite(frame_path, frame)
            saved.append(frame_path)
            if len(saved) >= max_frames:
                break
        frame_index += 1
    capture.release()
    return saved


def detect_species(local_path, file_type):
    """Route to correct detection pipeline based on file type."""
    if file_type == "image":
        return process_and_tag_image(local_path)

    # Video: extract frames, run detection on each, take peak count per species
    with tempfile.TemporaryDirectory() as frame_dir:
        frames = extract_video_frames(local_path, frame_dir)
        peak = {}
        for frame in frames:
            frame_tags = process_and_tag_image(frame)
            for tag, count in frame_tags.items():
                peak[tag] = max(peak.get(tag, 0), count)
        return peak or {"unknown": 1}


def media_collection():
    return firestore_client.collection(COLLECTION)


def media_doc_from_snapshot(snapshot):
    data = snapshot.to_dict()
    data["id"] = snapshot.id
    return data


def format_result(doc):
    tags = doc.get("tags", {})
    label = ", ".join(f"{tag}: {count}" for tag, count in tags.items())
    return {
        "thumbnailUrl": doc.get("thumbnailUrl") or doc.get("fullUrl"),
        "fullUrl": doc.get("fullUrl"),
        "label": label,
    }


def find_by_url(url):
    matches = list(media_collection().where("fullUrl", "==", url).limit(1).stream())
    if matches:
        return matches[0]
    matches = list(media_collection().where("thumbnailUrl", "==", url).limit(1).stream())
    return matches[0] if matches else None


def notify_matching_subscribers(media_doc):
    if not PROJECT_ID:
        return
    topic_path = publisher.topic_path(PROJECT_ID, PUBSUB_TOPIC)
    tags = media_doc.get("tags", {})
    for tag in tags:
        message = {
            "tag": tag,
            "fullUrl": media_doc.get("fullUrl"),
            "thumbnailUrl": media_doc.get("thumbnailUrl"),
            "createdAt": media_doc.get("createdAt"),
        }
        publisher.publish(topic_path, json.dumps(message).encode("utf-8"), tag=tag)


@app.get("/health")
def health():
    return jsonify({"ok": True, "service": "aussie-ecolens-gcp-api"})


@app.post("/files")
@require_auth
def upload_media():
    uploaded = request.files.get("file")
    checksum = request.form.get("checksum")
    if not uploaded:
        raise ApiError("Missing file in multipart form.", 400)

    with tempfile.TemporaryDirectory() as tmp:
        original_path = os.path.join(tmp, uploaded.filename)
        uploaded.save(original_path)

        computed_checksum = sha256_file(original_path)
        if checksum and checksum != computed_checksum:
            raise ApiError("Provided checksum does not match uploaded file.", 400)
        checksum = computed_checksum

        duplicate = list(
            media_collection().where("checksum", "==", checksum).limit(1).stream()
        )
        if duplicate:
            doc = media_doc_from_snapshot(duplicate[0])
            return jsonify({"duplicate": True, **doc})

        file_type = file_type_for(uploaded.filename, uploaded.content_type or "")
        media_id = str(uuid4())
        extension = Path(uploaded.filename).suffix.lower() or ".bin"
        original_blob = f"media/{media_id}{extension}"
        thumb_blob = f"thumbnails/{media_id}.jpg"
        thumbnail_path = os.path.join(tmp, "thumbnail.jpg")

        if file_type == "image":
            make_image_thumbnail(original_path, thumbnail_path)
        else:
            make_video_thumbnail(original_path, thumbnail_path)

        full_url = upload_file(original_path, original_blob, uploaded.content_type)
        thumbnail_url = upload_file(thumbnail_path, thumb_blob, "image/jpeg")
        tags = detect_species(original_path, file_type)

        record = {
            "checksum": checksum,
            "fileType": file_type,
            "fullUrl": full_url,
            "thumbnailUrl": thumbnail_url,
            "tags": tags,
            "createdBy": request.user.get("sub"),
            "createdByEmail": request.user.get("email"),
            "createdAt": now_iso(),
            "updatedAt": now_iso(),
        }
        media_collection().document(media_id).set(record)
        notify_matching_subscribers(record)

        return jsonify({"duplicate": False, "id": media_id, **record})


@app.delete("/files")
@require_auth
def delete_files():
    urls = (request.get_json(silent=True) or {}).get("url", [])
    if not isinstance(urls, list) or not urls:
        raise ApiError("Body must include url as a non-empty list.", 400)

    deleted = 0
    failed = []
    for url in urls:
        snapshot = find_by_url(url)
        if not snapshot:
            failed.append({"url": url, "reason": "not found"})
            continue
        doc = media_doc_from_snapshot(snapshot)
        for key in ("fullUrl", "thumbnailUrl"):
            blob_name = blob_name_from_url(doc.get(key, ""))
            if blob_name:
                bucket.blob(blob_name).delete(if_generation_match=None)
        snapshot.reference.delete()
        deleted += 1

    return jsonify({"deleted": deleted, "failed": failed})


@app.post("/search/tags")
@require_auth
def search_by_tags():
    query = request.get_json(silent=True) or {}
    if not query:
        raise ApiError("Body must contain tag minimum counts.", 400)

    results = []
    for snapshot in media_collection().stream():
        doc = media_doc_from_snapshot(snapshot)
        tags = doc.get("tags", {})
        if all(tags.get(tag, 0) >= int(min_count) for tag, min_count in query.items()):
            results.append(format_result(doc))

    return jsonify({"results": results})


@app.post("/search/species")
@require_auth
def search_by_species():
    body = request.get_json(silent=True) or {}
    species = body.get("species", [])
    if not isinstance(species, list) or not species:
        raise ApiError("Body must include species as a non-empty list.", 400)

    results = []
    for snapshot in media_collection().stream():
        doc = media_doc_from_snapshot(snapshot)
        tags = doc.get("tags", {})
        if all(tags.get(tag, 0) >= 1 for tag in species):
            results.append(format_result(doc))

    return jsonify({"results": results})


@app.post("/resolve-thumbnail")
@require_auth
def resolve_thumbnail():
    thumbnail_url = (request.get_json(silent=True) or {}).get("thumbnailUrl")
    if not thumbnail_url:
        raise ApiError("Body must include thumbnailUrl.", 400)

    matches = list(
        media_collection().where("thumbnailUrl", "==", thumbnail_url).limit(1).stream()
    )
    if not matches:
        raise ApiError("Thumbnail URL not found.", 404)

    return jsonify({"fullUrl": matches[0].to_dict().get("fullUrl")})


@app.post("/search/by-file")
@require_auth
def search_by_uploaded_file():
    uploaded = request.files.get("file")
    if not uploaded:
        raise ApiError("Missing file in multipart form.", 400)

    with tempfile.TemporaryDirectory() as tmp:
        query_path = os.path.join(tmp, uploaded.filename)
        uploaded.save(query_path)
        file_type = file_type_for(uploaded.filename, uploaded.content_type or "")
        detected_tags = detect_species(query_path, file_type)

    results = []
    for snapshot in media_collection().stream():
        doc = media_doc_from_snapshot(snapshot)
        tags = doc.get("tags", {})
        if all(tags.get(tag, 0) >= count for tag, count in detected_tags.items()):
            results.append(format_result(doc))

    return jsonify({"detectedTags": detected_tags, "results": results})


@app.post("/tags")
@require_auth
def edit_tags():
    body = request.get_json(silent=True) or {}
    urls = body.get("url", [])
    tags = body.get("tags", [])
    operation = body.get("operation")
    if not isinstance(urls, list) or not urls:
        raise ApiError("Body must include url as a non-empty list.", 400)
    if not isinstance(tags, list) or not tags:
        raise ApiError("Body must include tags as a non-empty list.", 400)
    if operation not in (0, 1):
        raise ApiError("operation must be 1 for add or 0 for remove.", 400)

    updated = 0
    failed = []
    for url in urls:
        snapshot = find_by_url(url)
        if not snapshot:
            failed.append({"url": url, "reason": "not found"})
            continue
        doc = media_doc_from_snapshot(snapshot)
        current = dict(doc.get("tags", {}))
        if operation == 1:
            for tag in tags:
                current[tag] = max(int(current.get(tag, 0)), 1)
        else:
            for tag in tags:
                current.pop(tag, None)
        snapshot.reference.update({"tags": current, "updatedAt": now_iso()})
        updated += 1

    return jsonify({"updated": updated, "failed": failed})


@app.post("/notifications/subscribe")
@require_auth
def subscribe_notifications():
    tag = (request.get_json(silent=True) or {}).get("tag", "").strip()
    if not tag:
        raise ApiError("Body must include tag.", 400)

    email = request.user.get("email")
    sub = request.user.get("sub")
    firestore_client.collection(SUBSCRIPTIONS_COLLECTION).document(f"{sub}_{tag}").set(
        {
            "userSub": sub,
            "email": email,
            "tag": tag,
            "createdAt": now_iso(),
        }
    )

    return jsonify(
        {
            "subscribed": True,
            "tag": tag,
            "message": "You will receive email notifications when new media with this tag is added.",
        }
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "8080")))
