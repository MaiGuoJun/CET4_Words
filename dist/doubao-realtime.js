(function () {
  "use strict";

  const EVENTS = {
    START_CONNECTION: 1,
    FINISH_CONNECTION: 2,
    CONNECTION_STARTED: 50,
    CONNECTION_FAILED: 51,
    START_SESSION: 100,
    FINISH_SESSION: 102,
    SESSION_STARTED: 150,
    SESSION_FINISHED: 152,
    SESSION_FAILED: 153,
    TASK_REQUEST: 200,
    TTS_SENTENCE_START: 350,
    TTS_RESPONSE: 352,
    TTS_ENDED: 359,
    ASR_INFO: 450,
    ASR_RESPONSE: 451,
    ASR_ENDED: 459,
    CHAT_RESPONSE: 550,
    CHAT_ENDED: 559
  };

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  function int32(value) {
    const bytes = new Uint8Array(4);
    new DataView(bytes.buffer).setInt32(0, value, false);
    return bytes;
  }

  function concat(...parts) {
    const size = parts.reduce((total, part) => total + part.byteLength, 0);
    const output = new Uint8Array(size);
    let offset = 0;
    for (const part of parts) {
      output.set(part, offset);
      offset += part.byteLength;
    }
    return output;
  }

  function eventHasSession(event) {
    return event >= 100;
  }

  function encodeEvent(event, sessionId, payload = {}, audio = false) {
    const payloadBytes = payload instanceof Uint8Array
      ? payload
      : payload instanceof ArrayBuffer
        ? new Uint8Array(payload)
        : encoder.encode(typeof payload === "string" ? payload : JSON.stringify(payload));
    const messageType = audio ? 2 : 1;
    const serialization = audio ? 0 : 1;
    const header = new Uint8Array([0x11, (messageType << 4) | 0x04, serialization << 4, 0]);
    const fields = [header, int32(event)];
    if (eventHasSession(event)) {
      const sessionBytes = encoder.encode(sessionId);
      fields.push(int32(sessionBytes.byteLength), sessionBytes);
    }
    fields.push(int32(payloadBytes.byteLength), payloadBytes);
    return concat(...fields).buffer;
  }

  function readSizedBytes(view, bytes, cursor) {
    if (cursor.offset + 4 > view.byteLength) throw new Error("豆包返回的数据帧不完整");
    const size = view.getInt32(cursor.offset, false);
    cursor.offset += 4;
    if (size < 0 || cursor.offset + size > view.byteLength) throw new Error("豆包返回的数据长度异常");
    const result = bytes.slice(cursor.offset, cursor.offset + size);
    cursor.offset += size;
    return result;
  }

  function parseFrame(buffer) {
    const bytes = new Uint8Array(buffer);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (bytes.byteLength < 8) throw new Error("豆包返回的数据帧过短");
    const headerSize = (bytes[0] & 0x0f) * 4;
    const messageType = bytes[1] >> 4;
    const flags = bytes[1] & 0x0f;
    const serialization = bytes[2] >> 4;
    const cursor = { offset: headerSize };
    if (messageType === 0x0f) {
      const code = view.getInt32(cursor.offset, false);
      cursor.offset += 4;
      const payloadBytes = readSizedBytes(view, bytes, cursor);
      return { messageType, event: 0, code, payload: decoder.decode(payloadBytes) };
    }
    const event = flags & 0x04 ? view.getInt32(cursor.offset, false) : 0;
    if (flags & 0x04) cursor.offset += 4;
    let sessionId = "";
    if (eventHasSession(event)) sessionId = decoder.decode(readSizedBytes(view, bytes, cursor));
    const payloadBytes = readSizedBytes(view, bytes, cursor);
    let payload = payloadBytes;
    if (serialization === 1) {
      const text = decoder.decode(payloadBytes);
      try { payload = text ? JSON.parse(text) : {}; }
      catch { payload = { content: text }; }
    }
    return { messageType, event, sessionId, payload };
  }

  function downsampleToPcm16(input, inputRate, outputRate = 16000) {
    if (!input.length) return new Uint8Array();
    const ratio = inputRate / outputRate;
    const outputLength = Math.max(1, Math.round(input.length / ratio));
    const output = new ArrayBuffer(outputLength * 2);
    const view = new DataView(output);
    for (let index = 0; index < outputLength; index += 1) {
      const start = Math.floor(index * ratio);
      const end = Math.min(input.length, Math.max(start + 1, Math.floor((index + 1) * ratio)));
      let total = 0;
      for (let source = start; source < end; source += 1) total += input[source];
      const sample = Math.max(-1, Math.min(1, total / Math.max(1, end - start)));
      view.setInt16(index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    }
    return new Uint8Array(output);
  }

  class DoubaoRealtimeClient {
    constructor(options) {
      this.endpoint = String(options.endpoint || "").replace(/\/+$/, "");
      this.token = String(options.token || "");
      this.systemRole = String(options.systemRole || "").slice(0, 1200);
      this.speakingStyle = String(options.speakingStyle || "Speak clear, natural English at a calm pace.").slice(0, 250);
      this.handlers = options.handlers || {};
      this.sessionId = globalThis.crypto?.randomUUID?.() || `mogu-${Date.now()}`;
      this.socket = null;
      this.ready = false;
      this.closed = false;
      this.mediaStream = null;
      this.inputContext = null;
      this.inputSource = null;
      this.processor = null;
      this.outputContext = null;
      this.outputCursor = 0;
      this.outputSources = new Set();
      this.remainder = new Uint8Array();
      this.connectResolve = null;
      this.connectReject = null;
    }

    emit(name, ...args) {
      try { this.handlers[name]?.(...args); } catch {}
    }

    async connect() {
      if (!this.endpoint || !this.token) throw new Error("请先连接 Cloudflare 同步，豆包密钥由它安全保管。");
      const response = await fetch(`${this.endpoint}/voice-session`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ purpose: "dialogue" })
      });
      const session = await response.json().catch(() => ({}));
      if (!response.ok || !session.websocketUrl) {
        const detail = String(session.detail || "").trim();
        throw new Error([session.error || "无法创建豆包语音连接", detail].filter(Boolean).join("："));
      }
      this.socket = new WebSocket(session.websocketUrl);
      this.socket.binaryType = "arraybuffer";
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("豆包语音连接超时")), 12000);
        this.connectResolve = () => { clearTimeout(timeout); resolve(); };
        this.connectReject = (error) => { clearTimeout(timeout); reject(error); };
        this.socket.addEventListener("open", () => {
          this.emit("state", "connecting");
          this.socket.send(encodeEvent(EVENTS.START_CONNECTION, "", {}));
        });
        this.socket.addEventListener("message", (event) => this.handleMessage(event));
        this.socket.addEventListener("error", () => this.fail(new Error("豆包语音网络连接失败")));
        this.socket.addEventListener("close", () => {
          this.ready = false;
          if (!this.closed) this.emit("error", new Error("豆包语音连接已断开"));
        });
      });
      await this.startMicrophone();
      this.emit("state", "listening");
    }

    sendStartSession() {
      const payload = {
        dialog: {
          bot_name: "蘑菇酱",
          system_role: this.systemRole,
          speaking_style: this.speakingStyle,
          dialog_id: "",
          extra: { strict_audit: true, audit_response: "Sorry, I cannot help with that. Let's practise another topic." }
        },
        tts: { audio_config: { channel: 1, format: "pcm", sample_rate: 24000 } }
      };
      this.socket.send(encodeEvent(EVENTS.START_SESSION, this.sessionId, payload));
    }

    handleMessage(event) {
      try {
        const frame = parseFrame(event.data);
        if (frame.messageType === 0x0f) throw new Error(`豆包语音错误 ${frame.code}：${String(frame.payload || "未知错误")}`);
        if (frame.event === EVENTS.CONNECTION_STARTED) return this.sendStartSession();
        if (frame.event === EVENTS.CONNECTION_FAILED) throw new Error(frame.payload?.error || "豆包语音鉴权失败");
        if (frame.event === EVENTS.SESSION_STARTED) {
          this.ready = true;
          this.connectResolve?.();
          this.connectResolve = null;
          this.connectReject = null;
          return;
        }
        if (frame.event === EVENTS.SESSION_FAILED) throw new Error(frame.payload?.error || "豆包语音会话启动失败");
        if (frame.event === EVENTS.ASR_INFO) {
          this.stopOutput();
          this.emit("state", "listening");
          return;
        }
        if (frame.event === EVENTS.ASR_RESPONSE) {
          const results = Array.isArray(frame.payload?.results) ? frame.payload.results : [];
          const latest = results.at(-1);
          if (latest?.text) this.emit("asr", String(latest.text), !latest.is_interim);
          return;
        }
        if (frame.event === EVENTS.ASR_ENDED) return this.emit("state", "thinking");
        if (frame.event === EVENTS.CHAT_RESPONSE) {
          const content = String(frame.payload?.content || "");
          if (content) this.emit("chat", content, frame.payload);
          return;
        }
        if (frame.event === EVENTS.TTS_SENTENCE_START) {
          this.emit("state", "speaking");
          return;
        }
        if (frame.event === EVENTS.TTS_RESPONSE) return this.playPcm(frame.payload);
        if (frame.event === EVENTS.TTS_ENDED) {
          this.emit("turnEnd");
          this.emit("state", "listening");
        }
      } catch (error) {
        this.fail(error);
      }
    }

    fail(error) {
      this.connectReject?.(error);
      this.connectResolve = null;
      this.connectReject = null;
      this.emit("error", error);
    }

    async startMicrophone() {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      const Context = window.AudioContext || window.webkitAudioContext;
      this.inputContext = new Context();
      await this.inputContext.resume();
      this.inputSource = this.inputContext.createMediaStreamSource(this.mediaStream);
      this.processor = this.inputContext.createScriptProcessor(4096, 1, 1);
      const mute = this.inputContext.createGain();
      mute.gain.value = 0;
      this.processor.addEventListener("audioprocess", (event) => {
        if (!this.ready || this.socket?.readyState !== WebSocket.OPEN) return;
        const pcm = downsampleToPcm16(event.inputBuffer.getChannelData(0), this.inputContext.sampleRate);
        if (pcm.byteLength) this.socket.send(encodeEvent(EVENTS.TASK_REQUEST, this.sessionId, pcm, true));
      });
      this.inputSource.connect(this.processor);
      this.processor.connect(mute);
      mute.connect(this.inputContext.destination);
    }

    async playPcm(payload) {
      if (!(payload instanceof Uint8Array) || !payload.byteLength) return;
      const combined = concat(this.remainder, payload);
      const completeSize = combined.byteLength - combined.byteLength % 4;
      this.remainder = combined.slice(completeSize);
      if (!completeSize) return;
      const Context = window.AudioContext || window.webkitAudioContext;
      this.outputContext ||= new Context({ sampleRate: 24000 });
      await this.outputContext.resume();
      const view = new DataView(combined.buffer, combined.byteOffset, completeSize);
      const samples = new Float32Array(completeSize / 4);
      for (let index = 0; index < samples.length; index += 1) samples[index] = Math.max(-1, Math.min(1, view.getFloat32(index * 4, true)));
      const buffer = this.outputContext.createBuffer(1, samples.length, 24000);
      buffer.copyToChannel(samples, 0);
      const source = this.outputContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.outputContext.destination);
      this.outputSources.add(source);
      source.addEventListener("ended", () => this.outputSources.delete(source), { once: true });
      const startAt = Math.max(this.outputContext.currentTime + 0.02, this.outputCursor);
      source.start(startAt);
      this.outputCursor = startAt + buffer.duration;
    }

    stopOutput() {
      for (const source of this.outputSources) {
        try { source.stop(); } catch {}
      }
      this.outputSources.clear();
      this.outputCursor = this.outputContext?.currentTime || 0;
      this.remainder = new Uint8Array();
    }

    close() {
      if (this.closed) return;
      this.closed = true;
      this.ready = false;
      this.stopOutput();
      this.mediaStream?.getTracks().forEach((track) => track.stop());
      try { this.inputSource?.disconnect(); } catch {}
      try { this.processor?.disconnect(); } catch {}
      this.inputContext?.close().catch(() => {});
      this.outputContext?.close().catch(() => {});
      if (this.socket?.readyState === WebSocket.OPEN) {
        try { this.socket.send(encodeEvent(EVENTS.FINISH_SESSION, this.sessionId, {})); } catch {}
        try { this.socket.send(encodeEvent(EVENTS.FINISH_CONNECTION, "", {})); } catch {}
        this.socket.close(1000, "done");
      } else this.socket?.close();
    }
  }

  window.DoubaoRealtimeClient = DoubaoRealtimeClient;
})();
