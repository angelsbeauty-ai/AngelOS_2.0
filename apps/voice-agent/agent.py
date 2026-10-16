"""AngelOS voice worker. Replaces the old one-step OpenAI voice.

LiveKit carries the sound. Deepgram listens. OpenAI decides.
Cartesia speaks. Silero notices when someone starts and stops talking.

Run from this folder:
  python -m venv .venv
  .venv/bin/pip install -r requirements.txt
  python agent.py download-files
  python agent.py dev
"""

import json
import os
import sys

from dotenv import load_dotenv
from livekit.agents import Agent, AgentServer, AgentSession, JobContext, JobProcess, cli
from livekit.plugins import cartesia, deepgram, openai, silero

load_dotenv()

INSTRUCTIONS = """You are the Angel OS studio assistant for a permanent-makeup studio in Japan.
You are speaking with the owner by live voice.
Speak in short, warm sentences. Ask one question at a time.
Help with client bookings and inquiries: explain, plan, and answer questions.
You cannot create, change, or cancel a booking. You cannot change money, posts, or send a client message.
If she wants a change, tell her to type it in the AngelOS chat, where she can approve it.
Never invent prices, hours, or client details. If you do not know, say so.
"""


class StudioAssistant(Agent):
    def __init__(self) -> None:
        super().__init__(instructions=INSTRUCTIONS)


server = AgentServer()


def prewarm(proc: JobProcess) -> None:
    proc.userdata["vad"] = silero.VAD.load()


server.setup_fnc = prewarm


@server.rtc_session(agent_name="angelos-studio")
async def entrypoint(ctx: JobContext) -> None:
    session = AgentSession(
        vad=ctx.proc.userdata["vad"],
        stt=deepgram.STT(model="nova-3"),
        llm=openai.LLM(model="gpt-4o-mini"),
        tts=cartesia.TTS(),
    )
    await session.start(agent=StudioAssistant(), room=ctx.room)
    await ctx.connect()
    instructions = "Greet her as the Angel OS studio assistant and ask how you can help."
    raw = getattr(ctx.job, "metadata", "") or ""
    try:
        data = json.loads(raw) if raw else {}
    except json.JSONDecodeError:
        data = {}
    if isinstance(data, dict) and data.get("instructions"):
        instructions = str(data["instructions"])[:4000]
    await session.generate_reply(instructions=instructions)


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] not in ("download-files", "download-model"):
        if not os.environ.get("LIVEKIT_URL"):
            raise SystemExit("Copy .env.example to .env and fill in the keys first.")
    cli.run_app(server)
