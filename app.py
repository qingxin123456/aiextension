
from flask import Flask, request, jsonify
from sparkai.llm.llm import ChatSparkLLM, ChunkPrintHandler
from sparkai.core.messages import ChatMessage
import requests


app = Flask(__name__)

SPARKAI_URL = 'wss://spark-api.xf-yun.com/v1.1/chat'
SPARKAI_APP_ID = 'c5679d7b'
SPARKAI_API_SECRET = 'MGYyOWE4ZTcxODZiODAwYzhkNDQ1Yzdl'
SPARKAI_API_KEY = 'defb43d3e239f8fcbc0aab9a49f493d8'
SPARKAI_DOMAIN = 'lite'

spark = ChatSparkLLM(
    spark_api_url=SPARKAI_URL,
    spark_app_id=SPARKAI_APP_ID,
    spark_api_key=SPARKAI_API_KEY,
    spark_api_secret=SPARKAI_API_SECRET,
    spark_llm_domain=SPARKAI_DOMAIN,
    streaming=False,
)


@app.route('/query', methods=['POST'])
def query_sparkai():
    data = request.json
    user_input = data.get('query')

    if not user_input:
        return jsonify({"error": "No query provided"}), 400

    messages = [ChatMessage(role="user", content=user_input)]
    handler = ChunkPrintHandler()

    response = spark.generate([messages], callbacks=[handler])
    if response and response.generations:
        assistant_response = response.generations[0][0].text
        return jsonify({"response": assistant_response})
    else:
        return jsonify({"error": "No valid response received from the model"}), 500


@app.route('/upload', methods=['POST'])
def handle_file_upload():
    data = request.json
    filename = data.get('filename')
    content = data.get('content')

    if not content:
        return jsonify({"error": "空文件内容"}), 400

    try:
        prompt = f"请分析以下文件内容，文件名：{filename}\n\n文件内容：\n{content[:3000]}"
        messages = [ChatMessage(role="user", content=prompt)]

        handler = ChunkPrintHandler()
        response = spark.generate([messages], callbacks=[handler])

        if response and response.generations:
            summary = response.generations[0][0].text
            return jsonify({"summary": f"📄 文件分析结果：\n{summary}"})
        else:
            return jsonify({"error": "文件分析失败"}), 500

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
