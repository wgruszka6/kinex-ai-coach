import asyncio
import cv2
import numpy as np
import time
from aiohttp import web
import socketio
from aiortc import RTCPeerConnection, RTCSessionDescription
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
from PIL import Image
from google import genai

# ==========================================
# 0. KONFIGURACJA GEMINI API
# ==========================================
client = genai.Client(
    vertexai=True,
    location="us-central1",
)

# ==========================================
# 1. KONFIGURACJA SERWERA (AIOHTTP + SOCKET.IO)
# ==========================================
sio = socketio.AsyncServer(cors_allowed_origins='*', async_mode='aiohttp')
app = web.Application()
sio.attach(app)

# ==========================================
# 2. KONFIGURACJA MEDIAPIPE
# ==========================================
base_options = python.BaseOptions(model_asset_path='pose_landmarker_lite.task')
options = vision.PoseLandmarkerOptions(
    base_options=base_options,
    output_segmentation_masks=False,
    min_pose_detection_confidence=0.5,
    min_pose_presence_confidence=0.5,
    min_tracking_confidence=0.5
)
detector = vision.PoseLandmarker.create_from_options(options)

# Globalne zmienne stanu
pcs = set()
client_poses = {} # Słownik przechowujący wybraną pozę dla danego ID (sid)

# ==========================================
# 3. LOGIKA GEMINI (Analiza w tle z uwzględnieniem pozy)
# ==========================================
async def get_gemini_feedback(pil_img, target_pose, sid):
    try:
        prompt = (
            "To jest klatka z kamery przedstawiająca osobę ćwiczącą jogę. "
            "Na jej ciało nałożono zielone kropki oznaczające stawy szkieletu. "
            "Przeanalizuj jej aktualną pozę na podstawie obrazu i ułożenia kropek. "
            "Podaj jedną, bardzo krótką radę w języku polskim, co powinna poprawić, aby przyjąć postawę '{target_pose}'"
            "(np. wyprostuj plecy, obniż ramiona). Bądź zwięzły.Przyjmij dokładność 90 procent względem pozycji wzorowej. Nadawaj komunikaty w języku angielskim. Jeśli pozycja jest (w miarę) poprawna, napisz informację, że jest poprawna. Nie pisz nic o procentach ani tłumaczeniach, tylko odpowiedni komunikat w języku angielskim"
        )

        response = await client.aio.models.generate_content(
            model='gemini-2.5-flash-lite',
            contents=[prompt, pil_img]
        )
        
        # Wysyłamy poradę tylko do tego konkretnego użytkownika (room=sid)
        await sio.emit('Gemini_feedback', {'feedback': response.text}, room=sid)
        print(f"🧘 Porada Gemini dla {target_pose}: {response.text}")
        
    except Exception as e:
        print(f"❌ Błąd Gemini: {e}")

# ==========================================
# 4. GŁÓWNA LOGIKA AI (Odbiór klatek)
# ==========================================
async def process_track(track, sid):
    print(f"🎥 Rozpoczęto nasłuchiwanie klatek ze strumienia wideo (ID: {sid})")
    last_gemini_call = 0
    
    while True:
        try:
            frame = await track.recv()
            img = frame.to_ndarray(format="bgr24")
            rgb_frame = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
            
            detection_result = detector.detect(mp_image)
            
            if detection_result.pose_landmarks:
                landmarks = []
                annotated_image = rgb_frame.copy()
                h, w, _ = annotated_image.shape
                
                for lm in detection_result.pose_landmarks[0]:
                    landmarks.append({
                        'x': lm.x, 
                        'y': lm.y, 
                        'v': lm.visibility if hasattr(lm, 'visibility') else 1.0
                    })
                    cx, cy = int(lm.x * w), int(lm.y * h)
                    cv2.circle(annotated_image, (cx, cy), 5, (0, 255, 0), -1)
                
                # Wysyłka punktów szkieletu na front
                await sio.emit('pose_data', {'landmarks': landmarks}, room=sid)
                
                current_time = time.time()
                if current_time - last_gemini_call >= 5.0:
                    last_gemini_call = current_time
                    pil_img = Image.fromarray(annotated_image)
                    
                    # Pobieramy pozę wybraną przez użytkownika (jeśli nie wybrał, dajemy wartość domyślną)
                    target_pose = client_poses.get(sid, "dowolna pozycja jogi")
                    
                    asyncio.create_task(get_gemini_feedback(pil_img, target_pose, sid))
                
        except Exception as e:
            print(f"Błąd analizy wideo lub koniec strumienia (ID: {sid}): {e}")
            break

# ==========================================
# 5. SIGNALING (Zapoznawanie telefonu z Pythonem)
# ==========================================
@sio.event
async def connect(sid, environ):
    print(f"✅ Telefon podłączony do Socket.IO! (ID: {sid})")

# NOWY EVENT: Odbieranie wybranej pozy z frontendu
@sio.event
async def set_target_pose(sid, data):
    pose_name = data.get('pose', 'unknown')
    client_poses[sid] = pose_name
    print(f"🎯 Użytkownik {sid} ustawił docelową pozę na: {pose_name}")

@sio.event
async def webrtc_offer(sid, data):
    print(f"🤝 Otrzymano ofertę WebRTC (SDP) od telefonu {sid}. Konfiguruję połączenie...")
    
    pc = RTCPeerConnection()
    pcs.add(pc)

    @pc.on("track")
    def on_track(track):
        if track.kind == "video":
            # Przekazujemy sid do process_track, aby wiedzieć, czyje to wideo
            asyncio.ensure_future(process_track(track, sid))

    offer = RTCSessionDescription(sdp=data["sdp"], type=data["type"])
    await pc.setRemoteDescription(offer)

    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    
    await sio.emit('webrtc_answer', {
        'sdp': pc.localDescription.sdp,
        'type': pc.localDescription.type
    }, room=sid)

@sio.event
async def disconnect(sid):
    print(f"❌ Telefon rozłączony (ID: {sid})")
    # Usuwamy pozę użytkownika z pamięci
    if sid in client_poses:
        del client_poses[sid]
        
    coros = [pc.close() for pc in pcs]
    await asyncio.gather(*coros)
    pcs.clear()

# ==========================================
# START SERWERA
# ==========================================
if __name__ == '__main__':
    print("="*40)
    print("🧘 YOGA AI: WEBRTC + MEDIAPIPE + GEMINI STARTUJE 🧘")
    print("="*40)
    web.run_app(app, host='0.0.0.0', port=3000)