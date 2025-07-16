import os
os.environ['PYTHONHTTPSVERIFY'] = '0'

import io
import json
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from paddleocr import PaddleOCR
import google.generativeai as genai
from dotenv import load_dotenv
import re
# Load environment variables
load_dotenv()

# Configure the Gemini API
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    raise ValueError("GOOGLE_API_KEY not found in .env file")
genai.configure(api_key=GOOGLE_API_KEY)

# Initialize FastAPI app
app = FastAPI()

# Allow all origins for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize PaddleOCR
# This will download models on first run
print("Loading PaddleOCR models...")
ocr = PaddleOCR(use_angle_cls=True, lang='en')
print("PaddleOCR models loaded.")

# Configure the Generative Model
generation_config = {
    "temperature": 0.1,
    "top_p": 1,
    "top_k": 1,
    "max_output_tokens": 2048,
}
model = genai.GenerativeModel(
    model_name="gemini-1.5-flash",
    generation_config=generation_config
)

def clean_json_response(text):
    """Cleans the text response from Gemini to extract valid JSON."""
    match = re.search(r'```json\n({.*?})\n```', text, re.DOTALL)
    if match:
        return match.group(1)
    return text # Fallback if no markdown block is found

@app.post("/process-image/")
async def process_image(file: UploadFile = File(...)):
    """
    Receives an image, extracts text using PaddleOCR,
    and uses Gemini to structure the data.
    """
    try:
        # Read image file
        image_bytes = await file.read()
        
        # Perform OCR
        result = ocr.ocr(image_bytes, cls=True)
        if not result or not result[0]:
            raise HTTPException(status_code=400, detail="OCR could not detect any text.")

        # Extract all detected text
        extracted_text = " ".join([line[1][0] for line in result[0]])

        # Define the prompt for Gemini
        prompt = f"""
        Analyze the following text extracted from a product package and identify key specifications.
        Your response must be a valid JSON object only, with no other text or explanations.
        The JSON object should have the following keys: "item_weight", "item_volume", "voltage", "dimensions", or any other relevant spec.
        If a value is not found, set its key to null.
        Add a 'confidence_scores' object where you estimate your confidence (from 0.0 to 1.0) for each value you extracted.

        Extracted text: "{extracted_text}"

        Respond with only the JSON object. Example format:
        {{
          "item_weight": "150 gram",
          "item_volume": "500 ml",
          "voltage": null,
          "confidence_scores": {{
            "item_weight": 0.95,
            "item_volume": 0.98,
            "voltage": 0.0
          }}
        }}
        """

        # Call the Gemini API
        response = model.generate_content(prompt)
        
        # Clean the response to ensure it's valid JSON
        # Gemini sometimes wraps JSON in ```json ... ```
        cleaned_response_text = response.text.replace("```json", "").replace("```", "").strip()

        # Parse the JSON string into a Python dict
        json_data = json.loads(cleaned_response_text)

        return json_data

    except Exception as e:
        print(f"An error occurred: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
def read_root():
    return {"status": "ML Service is running"}

