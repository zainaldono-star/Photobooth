from flask import Flask, render_template, request, jsonify
import os
import base64
from PIL import Image
from io import BytesIO

app = Flask(__name__, static_url_path='/static', static_folder='static')

# Konfigurasi Path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRAME_FOLDER = os.path.join(BASE_DIR, "static", "frames")

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/save_photos", methods=["POST"])
def save_photos():
    try:
        data = request.get_json()
        photos = data.get("photos", [])
        theme = data.get("theme", "1")

        if len(photos) != 8:
            return jsonify({"error": "Jumlah foto harus 8"}), 400

        # === 1. Decode & Resize 8 Foto ke ukuran slot 640x480 ===
        SLOT_W = 640
        SLOT_H = 480

        img_list = []
        for p in photos:
            if "," in p:
                header, encoded = p.split(",", 1)
            else:
                encoded = p

            img_data = base64.b64decode(encoded)
            img = Image.open(BytesIO(img_data)).convert("RGBA")
            img = img.resize((SLOT_W, SLOT_H), Image.Resampling.LANCZOS)
            img_list.append(img)

        # Muat gambar frame overlay sesuai tema (1280x960)
        frame_filename = f"frame_grid_{theme}.png"
        frame_path = os.path.join(FRAME_FOLDER, frame_filename)

        frame_overlay = None
        if os.path.exists(frame_path):
            frame_img = Image.open(frame_path).convert("RGBA")
            frame_overlay = frame_img.resize((1280, 960), Image.Resampling.LANCZOS)
        else:
            print(f"Warning: Frame {frame_filename} tidak ditemukan.")

        # Fungsi untuk membuat 1 Kartu Frame (4 foto 2x2) tanpa merusak proporsi frame
        def create_frame_card(photo_subset):
            card = Image.new("RGBA", (1280, 960), (255, 255, 255, 255))
            positions = [(0, 0), (640, 0), (0, 480), (640, 480)]
            for img, pos in zip(photo_subset, positions):
                card.paste(img, pos)

            if frame_overlay is not None:
                card = Image.alpha_composite(card, frame_overlay)
            return card

        # === 2. Buat Kartu 1 (Foto 1-4) & Kartu 2 (Foto 5-8) secara terpisah ===
        card1 = create_frame_card(img_list[:4])
        card2 = create_frame_card(img_list[4:])

        # === 3. Gabungkan Kartu 1 & Kartu 2 secara terpisah dengan jarak (Gap) ===
        GAP = 30
        final_width = 1280
        final_height = 960 * 2 + GAP

        # Background gelap yang elegan untuk batas pemisah antar kartu
        final_img = Image.new("RGBA", (final_width, final_height), (26, 26, 26, 255))
        final_img.paste(card1, (0, 0))
        final_img.paste(card2, (0, 960 + GAP))

        # === 4. Konversi Hasil ke Base64 (Vercel-compatible) ===
        buffered = BytesIO()
        rgb_img = final_img.convert("RGB")
        rgb_img.save(buffered, format="JPEG", quality=85)
        img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")

        full_data_uri = f"data:image/jpeg;base64,{img_str}"

        return jsonify({
            "success": True,
            "image_data": full_data_uri
        })

    except Exception as e:
        print(f"Error processing photos: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True, port=8080)