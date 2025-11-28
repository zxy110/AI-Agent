from flask import Flask, request, jsonify
import openai
import os
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # 允许跨域

# 从环境变量读取 OpenAI API Key
openai.api_key = os.getenv("OPENAI_API_KEY")

@app.route("/chat", methods=["POST"])
def chat():
    try:
        data = request.json
        messages = data.get("messages", [])

        completion = openai.ChatCompletion.create(
            model="gpt-4o",
            messages=messages
        )

        reply = completion.choices[0].message["content"]
        return jsonify({ "reply": reply })

    except Exception as e:
        print("错误：", e)
        return jsonify({ "error": str(e) }), 500

@app.route("/")
def hello():
    return "小初终端后端运行中 ✨"

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
