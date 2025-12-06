function populateVoices() {
  const voiceSelect = document.getElementById("voiceSelect");
  const voices = speechSynthesis.getVoices();
  voiceSelect.innerHTML = "";
  voices.filter(v => v.lang.startsWith("zh")).forEach((voice, i) => {
    const option = document.createElement("option");
    option.value = i;
    option.textContent = voice.name + " (" + voice.lang + ")";
    voiceSelect.appendChild(option);
  });
  selectedVoice = voices.find(v => v.lang.startsWith("zh"));
  voiceSelect.onchange = () => {
    selectedVoice = voices[voiceSelect.value];
  };
}

function speakText(text) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-CN";
  utterance.pitch = 1.1;
  utterance.rate = 1.0;
  if (selectedVoice) utterance.voice = selectedVoice;
  utterance.onstart = () => setAvatar("困惑");
  utterance.onend = () => setAvatar("平静");
  speechSynthesis.speak(utterance);
}

speechSynthesis.onvoiceschanged = populateVoices;

function startListening() {
  if (!('webkitSpeechRecognition' in window)) {
    alert("你的浏览器不支持语音识别，请使用Chrome浏览器～");
    return;
  }
  const recognition = new webkitSpeechRecognition();
  recognition.lang = "zh-CN";
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = function() {
    console.log("开始聆听...");
    setAvatar("困惑");
  };

  recognition.onresult = function(event) {
    const transcript = event.results[0][0].transcript;
    document.getElementById("userInput").value = transcript;
    sendMessage();
  };

  recognition.onerror = function(event) {
    console.error("语音识别错误：", event.error);
    setAvatar("困惑");
  };

  recognition.onend = function() {
    setAvatar("平静");
  };

  recognition.start();
}

// js调用
// speakText(assistantText);
// html调用
// <!--  <select id="voiceSelect"></select>-->
