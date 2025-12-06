let lastUserText = "";
let nightMode = false;
let selectedVoice = null;
let controller = null;
let currentAvatar = null;
let messageHistory = [
  { role: "system", content: "你是一个Q萌可爱的小初AI终端" }
];
// 配置markdown解析的选项
marked.setOptions({
  gfm: true,
  breaks: true
});

function setAvatar(state) {
  if (currentAvatar === state) return; // 避免重复加载
  currentAvatar = state;

  const avatar = document.getElementById("avatar");
  const imgPath = "imgs/" + state + ".png";
  const defaultPath = "imgs/平静.png";

  const testImg = new Image();
  testImg.onload = () => { avatar.src = imgPath; };
  testImg.onerror = () => { avatar.src = defaultPath; };
  testImg.src = imgPath;
}

function stopStreaming() {
  if (controller) {
    controller.abort();  // 终止请求
    controller = null;
    document.getElementById("loading").style.display = "none";
    setAvatar("平静");
    const botMessage = document.createElement("div");
    botMessage.className = "message bot";
    botMessage.innerText = "（小初暂停发言啦～你可以随时再继续问我哦）";
    document.getElementById("chatlog").appendChild(botMessage);
  }
}

function createStreamParser() {
    let buffer = "";     // 累积的文本
    let emo = [];        // 已提取的情绪
    let content = "";    // 展示内容
    let inBracket = false; // 是否在读取 []
    let currentEmo = "";   // 当前正在读取的情绪
    let emoMap = {};       // 存放 char 下标 -> currentEmo
    let index = 0;

    return {
        feed(chunk) {
            buffer += chunk;
            for (let i = 0; i < chunk.length; i++) {
                const char = chunk[i];
                // 如果遇到 '[' → 开始读取情绪
                if (!inBracket && char === '[') {
                    inBracket = true;
                    currentEmo = "";
                    continue;
                }
                // 如果正在读取情绪
                if (inBracket) {
                    if (char === ']') {
                        // 情绪读取完毕
                        emo.push(currentEmo);
                        console.log(emo)
                        // 记录下标和情绪，即当前情绪插入位置
                        emoMap[index] = currentEmo;
                        inBracket = false;
                        currentEmo = "";
                    } else {
                        currentEmo += char;
                    }
                    continue;
                }
                // 普通文本直接加进 content
                content += char;
                index += 1;
            }
            return content;
        },
        getResult() {
            return content;
        },
        getEmoMap() {
            return emoMap;
        }
    };
}

async function smartRender(element, emoMap, text, speed = 100) {
  element.innerHTML = '';

  // 按段落分割，但保持Markdown结构
  const paragraphs = splitIntoSemanticBlocks(text);
  let totalChars = 0;

  for (const block of paragraphs) {
    if (block.type === 'plain') {
      // 纯文本逐字符显示
      await renderTextWithEmotions(element, block.content, emoMap, totalChars, speed);
      totalChars += block.content.length;
    } else {
      // Markdown块整体渲染
      const html = DOMPurify.sanitize(marked.parse(block.content));
      element.innerHTML += html;
      totalChars += block.content.length;
      // 更新滚动
      const log = document.getElementById("chatlog");
      log.scrollTop = log.scrollHeight;
    }
  }
}

function splitIntoSemanticBlocks(text) {
  const lines = text.split('\n');
  const blocks = [];
  let currentBlock = [];
  let currentType = 'plain'; // plain 或 markdown

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 判断是否是Markdown元素
    const isMarkdownElement =
      trimmed.startsWith('#') ||                    // 标题
      trimmed.match(/^[-*+]\s+/) ||                 // 无序列表
      trimmed.match(/^\d+\.\s+/) ||                 // 有序列表
      (trimmed.startsWith('|') && trimmed.endsWith('|')) || // 表格
      trimmed.startsWith('```') ||                  // 代码块
      trimmed.match(/^>{1,}\s+/) ||                 // 引用块
      trimmed.match(/^`{3,}/) ||                    // 代码块
      trimmed.match(/^-{3,}$/) ||                   // 分隔线
      trimmed.match(/^={3,}$/);                     // 分隔线

    if (isMarkdownElement) {
      // 如果之前的块是纯文本，先保存
      if (currentBlock.length > 0 && currentType === 'plain') {
        blocks.push({
          type: 'plain',
          content: currentBlock.join('\n')
        });
        currentBlock = [];
      }
      currentType = 'markdown';
      currentBlock.push(line);
    } else {
      // 空行分隔区块
      if (trimmed === '' && currentBlock.length > 0) {
        blocks.push({
          type: currentType,
          content: currentBlock.join('\n')
        });
        currentBlock = [];
        currentType = 'plain';
        continue;
      }

      if (currentType === 'markdown' && trimmed !== '') {
        // Markdown区块的延续（如表格的第二行、列表的续行）
        currentBlock.push(line);
      } else {
        // 纯文本
        if (currentType === 'markdown') {
          // 切换到纯文本
          blocks.push({
            type: 'markdown',
            content: currentBlock.join('\n')
          });
          currentBlock = [];
          currentType = 'plain';
        }
        currentBlock.push(line);
      }
    }
  }
  // 处理最后一个块
  if (currentBlock.length > 0) {
    blocks.push({
      type: currentType,
      content: currentBlock.join('\n')
    });
  }
  return blocks;
}

async function renderTextWithEmotions(element, text, emoMap, offset, speed) {
  // 渲染文本并处理表情
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const globalIndex = offset + i;
    // 检查表情
    if (emoMap[globalIndex]) {
      setAvatar(emoMap[globalIndex]);
    }
    // 处理换行符
    if (char === '\n') {
      element.innerHTML += '<br>';
    } else {
      element.innerHTML += char;
    }
    // 延迟
    if (speed > 0) {
      await new Promise(resolve => setTimeout(resolve, speed));
    }
    // 保持滚动
    const log = document.getElementById("chatlog");
    log.scrollTop = log.scrollHeight;
  }
}

async function sendMessage() {
  controller = new AbortController();
  const signal = controller.signal;
  const input = document.getElementById("userInput");
  const text = input.value.trim();
  if (text === "") return;
  const log = document.getElementById("chatlog");

  // 用户消息
  const userMessage = document.createElement("div");
  userMessage.className = "message user";
  userMessage.innerText = text;
  log.appendChild(userMessage);
  input.value = "";
  log.scrollTop = log.scrollHeight;
  lastUserText = text;
  document.getElementById("loading").style.display = "block";

  // 写入历史
  messageHistory.push({ role: "user", content: text });
  if (messageHistory.length > 21) messageHistory.splice(1, 2);

  let assistantText = "";

  try {
    const res = await fetch("http://172.20.10.9:5001/chat_stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: messageHistory }),
      signal: signal
    });

    if (!res.ok || !res.body) {
      throw new Error("服务器无响应");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    const botMessage = document.createElement("div");
    botMessage.className = "message bot";
    log.appendChild(botMessage);
    const parser = createStreamParser();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      parser.feed(chunk);
      const rawText = parser.getResult();
      const emoMap = parser.getEmoMap();
      await smartRender(botMessage, emoMap, rawText);
      log.scrollTop = log.scrollHeight;
    }
  } catch (err) {
    if (err.name === "AbortError") {
      console.log("用户中止了输出");
      return;
    }
    console.error("流式错误：", err);

    const botMessage = document.createElement("div");
    botMessage.className = "message bot";
    botMessage.innerText = "哎呀，小初迷路啦，网络好像断开了～";
    log.appendChild(botMessage);
    log.scrollTop = log.scrollHeight;

    document.getElementById("loading").style.display = "none";
    setAvatar("困惑");
  }
}
