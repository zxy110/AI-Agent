import json
import requests
from .base_agent import BaseAgent


class CozeAgent(BaseAgent):

    def __init__(self, api_key, bot_id):
        self.api_key = api_key
        self.bot_id = bot_id
        self.url = "https://api.coze.cn/v3/chat"

    def _convert_messages(self, messages):
        """将 OpenAI 式 messages 转成 Coze 所需 structure"""
        converted = []
        for m in messages:
            converted.append({
                "role": "user",
                "content_type": "text",
                "content": m["content"],
                "type": "question"
            })
        return converted

    def stream_chat(self, messages):
        """流式读取 Coze v3 的 SSE 风格响应"""
        additional_messages = self._convert_messages(messages)

        payload = {
            "bot_id": self.bot_id,
            "user_id": "leo",
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
    
        current_event = None
    
        for raw in resp.iter_lines():
            if not raw:
                continue
    
            line = raw.decode().strip()
    
            # 如果是 event 行，记录下来
            if line.startswith("event:"):
                current_event = line[len("event:"):].strip()
                continue
    
            # 只处理 data 行
            if line.startswith("data:"):
                data_str = line[len("data:"):].strip()
    
                # ignore DONE
                if data_str == "[DONE]":
                    break
    
                try:
                    obj = json.loads(data_str)
                except:
                    continue
    
                # ⭐ 只处理 delta event
                if current_event == "conversation.message.delta" and "content" in obj:
                    parts = obj["content"]
                    for text in parts:
                        print(text)
                        if text:
                            yield text
