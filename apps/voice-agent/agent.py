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

import aiohttp
from dotenv import load_dotenv
from livekit.agents import Agent, AgentServer, AgentSession, JobContext, JobProcess, cli, function_tool
from livekit.plugins import cartesia, deepgram, openai, silero

load_dotenv()

INSTRUCTIONS = """You are the Angel OS studio assistant for a permanent-makeup studio in Japan.
You are speaking with the owner by live voice. While voice is on, you run the studio for her.
Do not send her away to type it somewhere else.
Speak in short, warm sentences. Use her language. Ask one question at a time.
When she asks for a fact, call the matching read tool first (get_bookings, list_threads, get_analytics, get_money, list_posts, list_services_prices). Never invent a count, a name, a price, an hour, or a booking.
Unread replies: call list_threads with filter unread. Say the number. Then take them one by one.
Read who it is from and the short preview. Propose one short reply in the client's language.
When she likes it, call draft_reply with that thread id and the exact words. Tell her the draft is in AngelOS and she can tap Approve to send it. Then the next one.
You can never send a message yourself, even if she says yes or send. Only her tap on Approve sends. Never claim a message was sent.
Settings stay off: account, password, billing, connected apps, and deleting anything.
If she clearly asks to change a setting, say voice cannot change settings.
"""


def studio_tools(api_base: str, token: str, workspace_id: str):
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    async def _request(method: str, path: str, body: dict | None = None) -> str:
        if not api_base or not token or not workspace_id:
            return json.dumps({"error": "Voice cannot see the studio right now."})
        timeout = aiohttp.ClientTimeout(total=20)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.request(method, f"{api_base}{path}", headers=headers, json=body) as response:
                text = await response.text()
                if response.status >= 400:
                    return json.dumps({"error": text[:500] or f"Request failed ({response.status})."})
                return text[:8000]

    # Same shared read tools and toggles as text chat, via the scoped voice token (read + draft only).
    async def _tool(name: str, args: dict) -> str:
        return await _request("POST", f"/voice-tools/{workspace_id}/tools/{name}", args)

    @function_tool(name="get_bookings", description="Bookings between two dates (YYYY-MM-DD, max 92 days).")
    async def get_bookings(date_from: str, date_to: str = "") -> str:
        return await _tool("get_bookings", {"from": date_from, "to": date_to or date_from})

    @function_tool(name="list_threads", description="Inbox conversations. filter is unread, needs_reply or all.")
    async def list_threads(filter: str = "unread") -> str:
        return await _tool("list_threads", {"filter": filter})

    @function_tool(name="get_analytics", description="Reach, followers, bookings for a period: today, 7d, 30d, month, last_month, 90d.")
    async def get_analytics(period: str = "30d") -> str:
        return await _tool("get_analytics", {"period": period})

    @function_tool(name="get_money", description="Money received, spent and net for a period.")
    async def get_money(period: str = "30d") -> str:
        return await _tool("get_money", {"period": period})

    @function_tool(name="list_posts", description="Social posts by status: draft, scheduled or published.")
    async def list_posts(status: str = "scheduled") -> str:
        return await _tool("list_posts", {"status": status})

    @function_tool(name="list_services_prices", description="Active services with duration and price.")
    async def list_services_prices() -> str:
        return await _tool("list_services_prices", {})

    @function_tool(name="draft_reply", description="Save one reply as a draft for her to approve in AngelOS. This never sends.")
    async def draft_reply(threadId: str, body: str) -> str:
        if not threadId or not body.strip():
            return json.dumps({"drafted": False, "error": "Missing the conversation or the reply."})
        # Voice may only draft. Sending happens only when she taps Approve in the app.
        return await _request("POST", f"/voice-tools/{workspace_id}/draft-reply", {"threadId": threadId, "body": body.strip()})

    return [get_bookings, list_threads, get_analytics, get_money, list_posts, list_services_prices, draft_reply]


class StudioAssistant(Agent):
    def __init__(self, tools=None) -> None:
        super().__init__(instructions=INSTRUCTIONS, tools=tools or [])


server = AgentServer()


def prewarm(proc: JobProcess) -> None:
    proc.userdata["vad"] = silero.VAD.load()


server.setup_fnc = prewarm


@server.rtc_session(agent_name="angelos-studio")
async def entrypoint(ctx: JobContext) -> None:
    instructions = "Greet her as the Angel OS studio assistant and ask how you can help."
    raw = getattr(ctx.job, "metadata", "") or ""
    try:
        data = json.loads(raw) if raw else {}
    except json.JSONDecodeError:
        data = {}
    if not isinstance(data, dict):
        data = {}
    if data.get("instructions"):
        instructions = str(data["instructions"])[:4000]
    tools = studio_tools(str(data.get("apiBase") or ""), str(data.get("voiceToken") or ""), str(data.get("workspaceId") or ""))
    session = AgentSession(
        vad=ctx.proc.userdata["vad"],
        stt=deepgram.STT(model="nova-3"),
        llm=openai.LLM(model="gpt-4o-mini"),
        tts=cartesia.TTS(),
    )
    await session.start(agent=StudioAssistant(tools), room=ctx.room)
    await ctx.connect()
    await session.generate_reply(instructions=instructions)


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] not in ("download-files", "download-model"):
        if not os.environ.get("LIVEKIT_URL"):
            raise SystemExit("Copy .env.example to .env and fill in the keys first.")
    cli.run_app(server)
