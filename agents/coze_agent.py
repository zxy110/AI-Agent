import json
import requests
from .base_agent import BaseAgent

class CozeAgent(BaseAgent):

    def __init__(self, api_key, bot_id):
        self.api_key = api_key
        self.bot_id = bot_id
        self.url = "https://api.coze.cn/v3/chat"

    def _convert_messages(self, messages):
        """将 OpenAI 格式 messages 转成 Coze 的 additional_messages"""
        converted = []
        for m in messages:
            converted.append({
                "role": m["role"],
                "content": m["content"],
                "content_type": "text"
            })
        return converted

    def stream_chat(self, messages):
        additional_messages = self._convert_messages(messages)

        payload = {
            "bot_id": self.bot_id,
            "user_id": "xiaoyu",
            "stream": True,
            "additional_messages": additional_messages,
        }

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        resp = requests.post(
            self.url,
            json=payload,
            headers=headers,
            stream=True
        )

        for line in resp.iter_lines():
            if not line:
                continue
            try:
                obj = json.loads(line.decode())
                text = obj.get("content", [{}])[0].get("text", "")
                if text:
                    yield text
            except:
                continue
