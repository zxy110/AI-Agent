class BaseAgent:
    def chat(self, messages):
        """非流式回复"""
        raise NotImplementedError

    def stream_chat(self, messages):
        """流式回复，返回一个生成器 yield chunk"""
        raise NotImplementedError
