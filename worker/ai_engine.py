"""
AI Engine — The brain of AI Company.

Provides intelligent text generation via:
1. Claude API (if ANTHROPIC_API_KEY is set) — highest quality
2. Local GPU model (Qwen2.5-3B-Instruct) — runs on RTX 2080 Super
3. CPU fallback — slower but always available

Each agent has a system prompt that shapes their personality and expertise.
"""

import os
import json
import hashlib
import logging
import asyncio
from typing import Optional
from functools import lru_cache

logger = logging.getLogger("ai-engine")

# Global model state
_local_model = None
_local_tokenizer = None
_model_loading = False
_model_name = os.environ.get("LOCAL_MODEL", "Qwen/Qwen2.5-3B-Instruct")
_cached_api_key = None


def _decrypt_aes_gcm(ciphertext: str) -> str:
    """Entschluesselt einen AES-256-GCM verschluesselten Wert (kompatibel mit frontend/src/lib/auth.ts)."""
    import binascii
    secret = os.environ.get("SESSION_SECRET", "aicompany-secret-change-me")
    key = hashlib.sha256(secret.encode()).digest()
    parts = ciphertext.split(":")
    if len(parts) != 3:
        return ""
    iv = binascii.unhexlify(parts[0])
    tag = binascii.unhexlify(parts[1])
    encrypted = binascii.unhexlify(parts[2])
    try:
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        aesgcm = AESGCM(key)
        # AESGCM expects nonce + ciphertext+tag combined
        decrypted = aesgcm.decrypt(iv, encrypted + tag, None)
        return decrypted.decode("utf-8")
    except ImportError:
        pass
    # Fallback: PyCryptodome
    try:
        from Crypto.Cipher import AES
        cipher = AES.new(key, AES.MODE_GCM, nonce=iv)
        decrypted = cipher.decrypt_and_verify(encrypted, tag)
        return decrypted.decode("utf-8")
    except ImportError:
        pass
    logger.error("Keine Crypto-Bibliothek verfuegbar (cryptography oder pycryptodome). API-Key kann nicht entschluesselt werden.")
    return ""


def _load_api_key_from_db() -> str:
    """Laedt den ANTHROPIC_API_KEY aus der users-Tabelle (verschluesselt gespeichert)."""
    global _cached_api_key
    if _cached_api_key:
        return _cached_api_key
    try:
        import psycopg2
        conn = psycopg2.connect(os.environ.get("DATABASE_URL", "postgresql://aicompany:aicompany@db:5432/aicompany"))
        cur = conn.cursor()
        cur.execute("SELECT api_keys FROM users WHERE api_keys IS NOT NULL AND api_keys != '[]'::jsonb LIMIT 1")
        row = cur.fetchone()
        cur.close()
        conn.close()
        if row and row[0]:
            keys = row[0] if isinstance(row[0], list) else json.loads(row[0])
            for entry in keys:
                if entry.get("name") == "ANTHROPIC_API_KEY" and entry.get("key_encrypted"):
                    decrypted = _decrypt_aes_gcm(entry["key_encrypted"])
                    if decrypted and decrypted.startswith("sk-"):
                        _cached_api_key = decrypted
                        logger.info("ANTHROPIC_API_KEY aus DB geladen")
                        return decrypted
    except Exception as e:
        logger.warning(f"API-Key aus DB laden fehlgeschlagen: {e}")
    return ""


def get_claude_client():
    """Get Anthropic client if API key is available (env or DB)"""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        api_key = _load_api_key_from_db()
    if not api_key:
        return None
    try:
        import anthropic
        return anthropic.Anthropic(api_key=api_key)
    except Exception as e:
        logger.warning(f"Failed to create Claude client: {e}")
        return None


def load_local_model():
    """Load local model onto GPU (or CPU fallback)"""
    global _local_model, _local_tokenizer, _model_loading

    if _local_model is not None:
        return _local_model, _local_tokenizer

    if _model_loading:
        return None, None

    _model_loading = True
    logger.info(f"Loading local model: {_model_name}")

    try:
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer

        _local_tokenizer = AutoTokenizer.from_pretrained(
            _model_name,
            trust_remote_code=True,
        )

        # Determine device and dtype
        if torch.cuda.is_available():
            device_map = "cuda"
            dtype = torch.float16
            vram = torch.cuda.get_device_properties(0).total_memory / 1e9
            logger.info(f"GPU available: {torch.cuda.get_device_name(0)} ({vram:.1f}GB)")

            _local_model = AutoModelForCausalLM.from_pretrained(
                _model_name,
                torch_dtype=dtype,
                device_map=device_map,
                trust_remote_code=True,
            )
        else:
            logger.info("No GPU, loading on CPU (will be slower)")
            _local_model = AutoModelForCausalLM.from_pretrained(
                _model_name,
                torch_dtype=torch.float32,
                device_map="cpu",
                trust_remote_code=True,
            )

        logger.info(f"Model loaded: {_model_name}")
        _model_loading = False
        return _local_model, _local_tokenizer

    except Exception as e:
        logger.error(f"Failed to load model: {e}")
        _model_loading = False
        return None, None


async def generate_with_claude(system_prompt: str, user_message: str, max_tokens: int = 2048) -> Optional[str]:
    """Generate text using Claude API"""
    client = get_claude_client()
    if not client:
        return None

    try:
        response = await asyncio.to_thread(
            client.messages.create,
            model="claude-sonnet-4-20250514",
            max_tokens=max_tokens,
            system=system_prompt,
            messages=[{"role": "user", "content": user_message}],
        )
        return response.content[0].text
    except Exception as e:
        logger.error(f"Claude API error: {e}")
        return None


async def generate_with_local(system_prompt: str, user_message: str, max_tokens: int = 1024) -> Optional[str]:
    """Generate text using local GPU model"""
    model, tokenizer = await asyncio.to_thread(load_local_model)
    if model is None or tokenizer is None:
        return None

    try:
        import torch

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ]

        text = tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True,
        )

        def _generate():
            inputs = tokenizer(text, return_tensors="pt").to(model.device)
            with torch.no_grad():
                outputs = model.generate(
                    **inputs,
                    max_new_tokens=max_tokens,
                    temperature=0.7,
                    top_p=0.9,
                    do_sample=True,
                    repetition_penalty=1.1,
                    pad_token_id=tokenizer.eos_token_id,
                )
            # Decode only the new tokens
            new_tokens = outputs[0][inputs["input_ids"].shape[1]:]
            return tokenizer.decode(new_tokens, skip_special_tokens=True)

        result = await asyncio.to_thread(_generate)
        return result

    except Exception as e:
        logger.error(f"Local model error: {e}")
        return None


async def think(system_prompt: str, user_message: str, max_tokens: int = 2048) -> str:
    """
    Main AI inference function. Tries Claude API first, falls back to local model.
    Always returns a response (never None).
    """
    result, _ = await think_with_meta(system_prompt, user_message, max_tokens)
    return result


async def think_with_meta(system_prompt: str, user_message: str, max_tokens: int = 2048) -> tuple:
    """
    Wie think(), gibt aber (text, meta) zurueck.
    meta = {"model": str, "backend": str, "tokens": int}
    """
    # Try Claude API first
    result = await generate_with_claude(system_prompt, user_message, max_tokens)
    if result:
        logger.info("Response generated via Claude API")
        meta = {"model": "claude-sonnet-4-20250514", "backend": "claude", "tokens": len(result.split())}
        return result, meta

    # Fall back to local model
    result = await generate_with_local(system_prompt, user_message, min(max_tokens, 2048))
    if result:
        logger.info("Response generated via local model")
        meta = {"model": _model_name, "backend": "local", "tokens": len(result.split())}
        return result, meta

    # Ultimate fallback
    logger.warning("All AI backends failed, returning fallback")
    fallback = f"[AI Engine Offline] Aufgabe empfangen: {user_message[:200]}. Weder Claude API noch lokales Modell verfügbar. Bitte ANTHROPIC_API_KEY setzen oder GPU prüfen."
    return fallback, {"model": "none", "backend": "offline", "tokens": 0}


async def think_structured(system_prompt: str, user_message: str, output_format: str = "json") -> dict:
    """
    Generate structured (JSON) output from the AI.
    """
    format_instruction = """

WICHTIG: Antworte NUR mit validem JSON, kein anderer Text davor oder danach."""

    raw = await think(system_prompt + format_instruction, user_message)

    # Try to extract JSON from the response
    try:
        # Try direct parse
        return json.loads(raw)
    except json.JSONDecodeError:
        pass

    # Try to find JSON block in response
    import re
    json_match = re.search(r'```(?:json)?\s*([\s\S]*?)```', raw)
    if json_match:
        try:
            return json.loads(json_match.group(1))
        except json.JSONDecodeError:
            pass

    # Try to find { ... } block
    json_match = re.search(r'\{[\s\S]*\}', raw)
    if json_match:
        try:
            return json.loads(json_match.group(0))
        except json.JSONDecodeError:
            pass

    # Try to find [ ... ] block
    json_match = re.search(r'\[[\s\S]*\]', raw)
    if json_match:
        try:
            return json.loads(json_match.group(0))
        except json.JSONDecodeError:
            pass

    return {"raw_response": raw}


async def test_claude_api() -> dict:
    """Testet die Claude API mit einer minimalen Anfrage. Gibt Ergebnis + Latenz zurueck."""
    import time
    client = get_claude_client()
    if not client:
        return {"success": False, "error": "Kein API-Key konfiguriert", "latency_ms": 0}
    try:
        start = time.time()
        response = await asyncio.to_thread(
            client.messages.create,
            model="claude-sonnet-4-20250514",
            max_tokens=10,
            messages=[{"role": "user", "content": "Antworte mit OK"}],
        )
        latency = round((time.time() - start) * 1000)
        text = response.content[0].text if response.content else ""
        return {
            "success": True,
            "response": text,
            "model": "claude-sonnet-4-20250514",
            "latency_ms": latency,
            "usage": {
                "input_tokens": response.usage.input_tokens,
                "output_tokens": response.usage.output_tokens,
            }
        }
    except Exception as e:
        return {"success": False, "error": str(e), "latency_ms": 0}


def get_engine_status() -> dict:
    """Get current AI engine status"""
    has_claude = get_claude_client() is not None
    has_local = _local_model is not None

    status = {
        "claude_api": "available" if has_claude else "no API key",
        "local_model": _model_name if has_local else ("loading..." if _model_loading else "not loaded"),
        "local_model_name": _model_name,
        "gpu_available": False,
        "active_backend": "claude" if has_claude else ("local" if has_local else "none"),
    }

    try:
        import torch
        status["gpu_available"] = torch.cuda.is_available()
        if torch.cuda.is_available():
            status["gpu_device"] = torch.cuda.get_device_name(0)
            status["gpu_vram_used"] = f"{torch.cuda.memory_allocated() / 1e9:.1f}GB"
            status["gpu_vram_total"] = f"{torch.cuda.get_device_properties(0).total_memory / 1e9:.1f}GB"
    except Exception:
        pass

    return status
