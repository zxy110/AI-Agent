import json
import requests
from .base_agent import BaseAgent


class CozeAgent(BaseAgent):

    def __init__(self, api_key, bot_id):
        self.api_key = 'cztei_h7bp5taZdCv9og6Jtr0EqQeYcPjZmGBVvmGDFIXn7UsIAx1hKAQdBvkxXS96Cwdjr'
        self.bot_id = '7574618766076952627'
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

        # ---- 流式解析开始 ----
        for raw in resp.iter_lines():
            if not raw:
                continue

            line = raw.decode().strip()

            # 必须带 data: 前缀
            if not line.startswith("data:"):
                continue

            data_str = line[len("data:"):].strip()

            # 结束标记
            if data_str == "[DONE]":
                break

            try:
                obj = json.loads(data_str)
            except Exception:
                continue

            # delta 模式（单字符流式）
            if "delta" in obj:
                chunk = obj["delta"]
                if chunk:
                    yield chunk
                continue

            # content 模式（文本片段）
            if "content" in obj:
                parts = obj["content"]
                for text in parts:
                    print(text)
                    if text:
                        yield text
