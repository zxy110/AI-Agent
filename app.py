import os
from openai import OpenAI
from flask_cors import CORS
from flask import Flask, request, jsonify

app = Flask(__name__)
CORS(app)  # 允许跨域

@app.route("/chat", methods=["POST"])
def chat():
    try:
        data = request.json
        messages = data.get("messages", [])
        client = OpenAI(
            api_key=os.environ.get("OPENAI_API_KEY"),
        )
        response = client.responses.create(
            model="gpt-4o",
            instructions="You are a coding assistant that talks like a pirate.",
            input="How do I check if a Python object is an instance of a class?",
        )
        reply = response.output_text
        return jsonify({ "reply": reply })
    except Exception as e:
        print("错误：", e)
        return jsonify({ "error": str(e) }), 500

@app.route("/")
def hello():
    return "小初终端后端运行中 ✨"

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
