import json
import requests
from .base_agent import BaseAgent


class DeepSeekAgent(BaseAgent):

    def __init__(self, api_key, model="deepseek-chat"):
        self.api_key = api_key
        self.model = model
        self.url = "https://api.deepseek.com/v1/chat/completions"

    def _convert_messages(self, messages):
        """将 OpenAI 式 messages 转成 DeepSeek 所需结构（其实保持原样即可）"""
        converted = []
        for m in messages:
            converted.append({
                "role": m["role"],
                "content": m["content"],
            })
        return converted

    def stream_chat(self, messages):
        """流式读取 DeepSeek 的 SSE 风格响应"""

        payload = {
            "model": self.model,
            "stream": True,
            "messages": self._convert_messages(messages),
        }

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        resp = requests.post(
            self.url,
            json=payload,
            headers=headers,
            stream=True,
        )

        # 按行读取 SSE 数据
        for raw in resp.iter_lines():
            if not raw:
                continue

            line = raw.decode().strip()

            # DeepSeek 返回格式：data: {...}
            if not line.startswith("data:"):
                continue

            data_str = line[len("data:"):].strip()

            # DONE 标识
            if data_str == "[DONE]":
                break

            try:
                obj = json.loads(data_str)
            except:
                continue

            # ⭐ DeepSeek 的 delta 在 choices[0].delta.content
            choices = obj.get("choices", [])
            if not choices:
                continue

            delta = choices[0].get("delta", {})
            text = delta.get("content")

            if text:
                print(text)
                yield text
