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
When she asks for a fact, call look_up_studio first. Never invent a count, a name, a price, an hour, or a booking.
Unread replies: call look_up_studio with topic unread. Say the number. Then take them one by one.
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

    @function_tool(name="look_up_studio", description="Read real studio records. topic is unread or today.")
    async def look_up_studio(topic: str) -> str:
        raw = await _request("GET", f"/workspaces/{workspace_id}/home/summary?period=day")
        try:
            home = json.loads(raw)
        except json.JSONDecodeError:
            return raw
        if topic == "today":
            schedule = home.get("schedule") or {}
            nxt = schedule.get("next")
            return json.dumps({
                "bookings": schedule.get("total"),
                "next": None if not nxt else {"client": nxt.get("client"), "service": nxt.get("service"), "start": nxt.get("start_at")},
                "items": [{"client": item.get("client"), "service": item.get("service"), "start": item.get("start_at")} for item in (schedule.get("items") or [])[:8]],
            })
        messages = home.get("messages") or {}
        conversations = [
            {"threadId": item.get("id"), "name": item.get("name"), "platform": item.get("platform"), "preview": item.get("preview"), "unread": item.get("unread"), "needsReply": item.get("needsReply")}
            for item in (messages.get("alerts") or []) if item.get("unread") or item.get("needsReply")
        ][:7]
        return json.dumps({"unread": messages.get("unread"), "needsReply": messages.get("needsReply"), "conversations": conversations})

    @function_tool(name="draft_reply", description="Save one reply as a draft for her to approve in AngelOS. This never sends.")
    async def draft_reply(threadId: str, body: str) -> str:
        if not threadId or not body.strip():
            return json.dumps({"drafted": False, "error": "Missing the conversation or the reply."})
        # Voice may only draft. Sending happens only when she taps Approve in the app.
        await _request("POST", f"/workspaces/{workspace_id}/messaging/threads/{threadId}/replies", {"body": body.strip(), "sendNow": False})
        return json.dumps({"drafted": True, "sent": False, "note": "Draft saved. Not sent until she taps Approve."})

    return [look_up_studio, draft_reply]


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
    tools = studio_tools(str(data.get("apiBase") or ""), str(data.get("accessToken") or ""), str(data.get("workspaceId") or ""))
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
