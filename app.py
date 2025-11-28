import os
from flask import Flask, request, Response
from flask_cors import CORS
from agents.coze_agent import CozeAgent

app = Flask(__name__)
CORS(app)

agent = CozeAgent(
    api_key=os.getenv("COZE_API_KEY"),
    bot_id=os.getenv("COZE_BOT_ID")
)

@app.route("/chat_stream", methods=["POST"])
def chat_stream():
    messages = request.json.get("messages", [])

    def generate():
        for chunk in agent.stream_chat(messages):
            yield chunk

    return Response(generate(), mimetype="text/plain")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5001)))
