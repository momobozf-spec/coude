"""
Hikmar AI — Backend Server
FastAPI backend with multi-model AI routing and smart home controls.
Run with: uvicorn main:app --reload --port 8000
"""

import os
import re
from typing import Optional, Union
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import anthropic
import httpx
from dotenv import load_dotenv

# Load .env file so API keys are available
load_dotenv()

# ─── APP SETUP ────────────────────────────────────────────────────────────────

app = FastAPI(title="Hikmar AI Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve the frontend — works both locally and on Railway
import pathlib
BASE_DIR = pathlib.Path(__file__).parent
FRONTEND_DIR = BASE_DIR.parent / "pwa"   # local: hikmar_deploy/pwa
if not FRONTEND_DIR.exists():
    FRONTEND_DIR = BASE_DIR / "pwa"      # Railway: if pwa folder is alongside backend
if not FRONTEND_DIR.exists():
    FRONTEND_DIR = BASE_DIR              # fallback: serve from same folder

if FRONTEND_DIR.exists():
    app.mount("/app", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")

@app.get("/ui")
def serve_ui():
    index = FRONTEND_DIR / "index.html"
    if index.exists():
        return FileResponse(str(index))
    return {"message": "Frontend not found. Place index.html in the pwa/ folder."}

# ─── API KEYS (set in environment or .env file) ───────────────────────────────

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
OPENAI_API_KEY    = os.getenv("OPENAI_API_KEY", "")
GEMINI_API_KEY    = os.getenv("GEMINI_API_KEY", "")

# ─── SMART HOME STATE (in-memory mock — replace with real HA API later) ───────

smart_home_state = {
    "lights": {
        "living_room": {"on": False, "brightness": 80, "color": "warm_white"},
        "bedroom":     {"on": False, "brightness": 50, "color": "warm_white"},
        "kitchen":     {"on": True,  "brightness": 100, "color": "daylight"},
        "bathroom":    {"on": False, "brightness": 70,  "color": "daylight"},
    },
    "thermostat": {
        "temperature": 21,
        "mode": "auto",  # heat / cool / auto / off
        "target": 21,
    },
    "music": {
        "playing": False,
        "song": "",
        "volume": 60,
    },
    "security": {
        "alarm": "disarmed",  # armed / disarmed
        "front_door": "locked",
        "back_door": "locked",
    }
}

# ─── MODELS ───────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str
    conversation_history: list = []

class SmartHomeCommand(BaseModel):
    device: str
    action: str
    value: Optional[Union[str, int, float]] = None

class StatusResponse(BaseModel):
    status: str
    api_keys: dict

# ─── AI ROUTING LOGIC ─────────────────────────────────────────────────────────

def classify_query(message: str) -> str:
    """
    Route queries to the best AI model based on content analysis.
    Returns: 'claude' | 'openai' | 'gemini' | 'local'
    """
    msg = message.lower()

    # Smart home commands → handled locally (no AI needed)
    smart_home_keywords = [
        "turn on", "turn off", "switch on", "switch off", "dim", "brighten",
        "set light", "lights", "thermostat", "temperature", "lock", "unlock",
        "alarm", "music", "play", "pause", "volume", "set temp"
    ]
    if any(kw in msg for kw in smart_home_keywords):
        return "local"

    # Real-time / search queries → Gemini
    realtime_keywords = [
        "news", "weather", "today", "right now", "currently", "latest",
        "search", "what time", "price of", "score", "who won", "traffic"
    ]
    if any(kw in msg for kw in realtime_keywords):
        return "gemini"

    # Code / math / structured tasks → GPT-4o
    code_keywords = [
        "code", "script", "function", "debug", "python", "javascript",
        "calculate", "formula", "equation", "sql", "api", "error", "bug",
        "algorithm", "regex", "json", "xml", "html", "css"
    ]
    if any(kw in msg for kw in code_keywords):
        return "openai"

    # Long reasoning, analysis, writing → Claude
    # Also fallback for anything else
    return "claude"


def parse_smart_home_command(message: str) -> dict:
    """Parse natural language smart home commands into structured actions."""
    msg = message.lower()
    result = {"device": None, "action": None, "value": None, "response": ""}

    # Lights
    if any(room in msg for room in ["living room", "bedroom", "kitchen", "bathroom"]):
        for room in ["living_room", "bedroom", "kitchen", "bathroom"]:
            if room.replace("_", " ") in msg:
                result["device"] = f"lights.{room}"
                break

        if "turn on" in msg or "switch on" in msg or "on" in msg:
            result["action"] = "on"
            result["response"] = f"Turning on the {result['device'].split('.')[1].replace('_', ' ')} lights."
        elif "turn off" in msg or "switch off" in msg or "off" in msg:
            result["action"] = "off"
            result["response"] = f"Turning off the {result['device'].split('.')[1].replace('_', ' ')} lights."

        # Brightness
        match = re.search(r'(\d+)\s*%', msg)
        if match:
            result["value"] = int(match.group(1))
            result["action"] = "brightness"
            result["response"] = f"Setting brightness to {result['value']}%."

    # All lights
    elif "all lights" in msg or "every light" in msg:
        result["device"] = "lights.all"
        if "turn on" in msg or "on" in msg:
            result["action"] = "on"
            result["response"] = "Turning on all lights."
        elif "turn off" in msg or "off" in msg:
            result["action"] = "off"
            result["response"] = "Turning off all lights."

    # Thermostat
    elif "temperature" in msg or "thermostat" in msg or "degrees" in msg or "warm" in msg or "cold" in msg:
        result["device"] = "thermostat"
        match = re.search(r'(\d+)', msg)
        if match:
            temp = int(match.group(1))
            result["action"] = "set_temp"
            result["value"] = temp
            result["response"] = f"Setting thermostat to {temp}°C."
        elif "warmer" in msg or "heat" in msg:
            result["action"] = "increase"
            result["response"] = "Increasing temperature by 1°C."
        elif "cooler" in msg or "cool" in msg:
            result["action"] = "decrease"
            result["response"] = "Decreasing temperature by 1°C."

    # Music
    elif "music" in msg or "play" in msg or "pause" in msg or "volume" in msg:
        result["device"] = "music"
        if "play" in msg or "music on" in msg:
            result["action"] = "play"
            result["response"] = "Playing music."
        elif "pause" in msg or "stop" in msg:
            result["action"] = "pause"
            result["response"] = "Pausing music."
        match = re.search(r'volume\s*(\d+)', msg)
        if match:
            result["action"] = "volume"
            result["value"] = int(match.group(1))
            result["response"] = f"Setting volume to {match.group(1)}%."

    # Security
    elif "lock" in msg or "arm" in msg or "alarm" in msg:
        result["device"] = "security"
        if "lock" in msg:
            result["action"] = "lock_all"
            result["response"] = "All doors locked."
        elif "arm" in msg:
            result["action"] = "arm"
            result["response"] = "Security alarm armed."
        elif "disarm" in msg:
            result["action"] = "disarm"
            result["response"] = "Security alarm disarmed."

    if not result["response"]:
        result["response"] = "I understood a smart home command but couldn't parse the details. Please try again."

    return result


def apply_smart_home_command(parsed: dict) -> str:
    """Apply parsed command to in-memory smart home state."""
    device = parsed.get("device", "")
    action = parsed.get("action", "")
    value  = parsed.get("value")

    try:
        if device == "lights.all":
            for room in smart_home_state["lights"]:
                smart_home_state["lights"][room]["on"] = (action == "on")

        elif device and device.startswith("lights."):
            room = device.split(".")[1]
            if room in smart_home_state["lights"]:
                if action in ("on", "off"):
                    smart_home_state["lights"][room]["on"] = (action == "on")
                elif action == "brightness" and value is not None:
                    smart_home_state["lights"][room]["brightness"] = int(value)
                    smart_home_state["lights"][room]["on"] = True

        elif device == "thermostat":
            if action == "set_temp" and value is not None:
                smart_home_state["thermostat"]["target"] = int(value)
                smart_home_state["thermostat"]["temperature"] = int(value)
            elif action == "increase":
                smart_home_state["thermostat"]["temperature"] += 1
                smart_home_state["thermostat"]["target"] += 1
            elif action == "decrease":
                smart_home_state["thermostat"]["temperature"] -= 1
                smart_home_state["thermostat"]["target"] -= 1

        elif device == "music":
            if action == "play":
                smart_home_state["music"]["playing"] = True
            elif action == "pause":
                smart_home_state["music"]["playing"] = False
            elif action == "volume" and value is not None:
                smart_home_state["music"]["volume"] = int(value)

        elif device == "security":
            if action == "lock_all":
                smart_home_state["security"]["front_door"] = "locked"
                smart_home_state["security"]["back_door"] = "locked"
            elif action == "arm":
                smart_home_state["security"]["alarm"] = "armed"
            elif action == "disarm":
                smart_home_state["security"]["alarm"] = "disarmed"

    except Exception as e:
        return f"Error applying command: {str(e)}"

    return parsed.get("response", "Done.")


# ─── AI MODEL CALLERS ─────────────────────────────────────────────────────────

async def call_claude(message: str, history: list) -> str:
    if not ANTHROPIC_API_KEY:
        return "[Claude] API key not set. Add ANTHROPIC_API_KEY to your .env file."
    try:
        client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
        messages = []
        for h in history[-10:]:
            messages.append({"role": h["role"], "content": h["content"]})
        messages.append({"role": "user", "content": message})

        response = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            system="You are Hikmar, an intelligent home assistant. Be concise, helpful, and friendly. You help with reasoning, analysis, writing, and general questions.",
            messages=messages
        )
        return response.content[0].text
    except Exception as e:
        return f"[Claude Error] {str(e)}"


async def call_openai(message: str, history: list) -> str:
    if not OPENAI_API_KEY:
        return "[GPT-4o] API key not set. Add OPENAI_API_KEY to your .env file."
    try:
        messages = [{"role": "system", "content": "You are Hikmar, an intelligent home assistant. You excel at code, math, and structured tasks. Be concise and accurate."}]
        for h in history[-10:]:
            messages.append({"role": h["role"], "content": h["content"]})
        messages.append({"role": "user", "content": message})

        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {OPENAI_API_KEY}", "Content-Type": "application/json"},
                json={"model": "gpt-4o", "messages": messages, "max_tokens": 1024},
                timeout=30
            )
            data = response.json()
            return data["choices"][0]["message"]["content"]
    except Exception as e:
        return f"[GPT-4o Error] {str(e)}"


async def call_gemini(message: str, history: list) -> str:
    if not GEMINI_API_KEY:
        return "[Gemini] API key not set. Add GEMINI_API_KEY to your .env file."
    try:
        contents = []
        for h in history[-10:]:
            role = "user" if h["role"] == "user" else "model"
            contents.append({"role": role, "parts": [{"text": h["content"]}]})
        contents.append({"role": "user", "parts": [{"text": message}]})

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}",
                json={
                    "contents": contents,
                    "systemInstruction": {"parts": [{"text": "You are Hikmar, an intelligent home assistant. You excel at real-time information, search, and current events. Be concise and helpful."}]}
                },
                timeout=30
            )
            data = response.json()
            return data["candidates"][0]["content"]["parts"][0]["text"]
    except Exception as e:
        return f"[Gemini Error] {str(e)}"


# ─── ROUTES ───────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"message": "Hikmar AI Backend is running", "version": "1.0.0"}


@app.get("/status", response_model=StatusResponse)
def get_status():
    return {
        "status": "online",
        "api_keys": {
            "anthropic": "✅ set" if ANTHROPIC_API_KEY else "❌ missing",
            "openai":    "✅ set" if OPENAI_API_KEY    else "❌ missing",
            "gemini":    "✅ set" if GEMINI_API_KEY     else "❌ missing",
        }
    }


@app.post("/chat")
async def chat(request: ChatRequest):
    message  = request.message.strip()
    history  = request.conversation_history

    if not message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    # Determine routing
    model_key = classify_query(message)

    # Handle smart home commands locally
    if model_key == "local":
        parsed   = parse_smart_home_command(message)
        response = apply_smart_home_command(parsed)
        return {
            "response": response,
            "model": "hikmar_local",
            "model_label": "Smart Home",
            "smart_home_state": smart_home_state,
            "command": parsed
        }

    # Call the appropriate AI model
    if model_key == "gemini":
        response = await call_gemini(message, history)
        model_label = "Gemini"
    elif model_key == "openai":
        response = await call_openai(message, history)
        model_label = "GPT-4o"
    else:
        response = await call_claude(message, history)
        model_label = "Claude"

    return {
        "response": response,
        "model": model_key,
        "model_label": model_label,
        "smart_home_state": smart_home_state,
        "command": None
    }


@app.get("/smart-home")
def get_smart_home_state():
    return smart_home_state


@app.post("/smart-home/command")
def smart_home_command(cmd: SmartHomeCommand):
    parsed   = {"device": cmd.device, "action": cmd.action, "value": cmd.value, "response": ""}
    response = apply_smart_home_command(parsed)
    return {"response": response, "state": smart_home_state}


@app.post("/smart-home/reset")
def reset_smart_home():
    """Reset smart home to default state."""
    smart_home_state["lights"] = {
        "living_room": {"on": False, "brightness": 80, "color": "warm_white"},
        "bedroom":     {"on": False, "brightness": 50, "color": "warm_white"},
        "kitchen":     {"on": True,  "brightness": 100, "color": "daylight"},
        "bathroom":    {"on": False, "brightness": 70,  "color": "daylight"},
    }
    smart_home_state["thermostat"] = {"temperature": 21, "mode": "auto", "target": 21}
    smart_home_state["music"]      = {"playing": False, "song": "", "volume": 60}
    smart_home_state["security"]   = {"alarm": "disarmed", "front_door": "locked", "back_door": "locked"}
    return {"response": "Smart home reset to defaults.", "state": smart_home_state}
