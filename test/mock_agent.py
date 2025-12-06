import time

class BaseAgent:
    def chat(self, messages):
        """非流式回复"""
        raise NotImplementedError

    def stream_chat(self, messages):
        """流式回复，返回一个生成器 yield chunk"""
        raise NotImplementedError

class DevMockAgent(BaseAgent):
    """
    一个本地调试用的 Agent，不调用任何 LLM，
    而是从 txt 文件中按行 stream 输出。
    """

    def __init__(self, file_path, delay=1):
        """
        file_path: txt 文件路径
        delay: 每行/每段输出的延时（模拟 LLM 打字速度）
        """
        self.file_path = file_path
        self.delay = delay

    def stream_chat(self, messages=None):
        """
        模拟流式输出 txt 文件内容。
        每行输出一次（或者你想改成每 N 个字符输出一次也可以）。
        """

        with open(self.file_path, "r", encoding="utf-8") as f:
            for chunk in f.readlines():
                # # 如果需要按字符流式，这里可以改成循环：
                # for c in chunk:
                #     time.sleep(self.delay)
                #     yield c

                # 模拟 LLM 输出
                time.sleep(self.delay)
                yield chunk
