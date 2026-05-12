require('dotenv').config();

const ffmpegBin = require('ffmpeg-static');
const { spawn } = require('child_process');
const http = require('http');
const { Client, GatewayIntentBits, Events } = require('discord.js');
const { joinVoiceChannel, EndBehaviorType, createAudioPlayer, createAudioResource, StreamType } = require('@discordjs/voice');
const { OpusEncoder } = require('@discordjs/opus');
const { Readable } = require('stream');

console.log('✅ FFmpeg binary:', ffmpegBin);

// PCM frame constants: 48kHz, stereo, 16-bit = 20ms per frame
const SAMPLE_RATE = 48000;
const CHANNELS = 2;
const FRAME_SAMPLES = 960;
const BYTES_PER_SAMPLE = 2;
const FRAME_SIZE = FRAME_SAMPLES * CHANNELS * BYTES_PER_SAMPLE; // 3840 bytes

// Silence stream untuk establish Discord voice encryption
class Silence extends Readable {
  _read() {
    this.push(Buffer.alloc(FRAME_SIZE));
    this.push(null);
  }
}

// ---- HTTP Streaming Server (raw Node.js http, bukan Express) ----
let streamClients = [];
let chatClients = [];  // SSE clients untuk live chat

const streamServer = http.createServer((req, res) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': '*',
        });
        return res.end();
    }

    if (req.url === '/stream') {
        res.writeHead(200, {
            'Content-Type': 'audio/mpeg',
            'Cache-Control': 'no-cache, no-store',
            'Access-Control-Allow-Origin': '*',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',   // Disable Nginx/Koyeb proxy buffering
        });
        streamClients.push({ req, res });
        console.log(`🎧 Listener connected. Total: ${streamClients.length}`);

        req.socket.on('close', () => {
            streamClients = streamClients.filter(c => c.req !== req);
            console.log(`👋 Listener disconnected. Total: ${streamClients.length}`);
        });

    } else if (req.url === '/chat') {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'X-Accel-Buffering': 'no',   // Disable Nginx/Koyeb proxy buffering
        });
        res.write('data: {"type":"connected"}\n\n');
        chatClients.push(res);
        console.log(`💬 Chat client connected. Total: ${chatClients.length}`);
        req.socket.on('close', () => {
            chatClients = chatClients.filter(c => c !== res);
        });

    } else if (req.url === '/ping') {
        res.writeHead(200, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
        res.end('pong - bot is alive!');
    } else {
        res.writeHead(404);
        res.end();
    }
});

streamServer.listen(4000, () => {
    console.log('📻 Streaming Server on http://localhost:4000/stream');
});

// ---- FFmpeg: PCM -> MP3 ----
const ffmpegProcess = spawn(ffmpegBin, [
    '-fflags', 'nobuffer',        // Kurangi internal FFmpeg buffer
    '-f', 's16le',
    '-ar', '48000',
    '-ac', '2',
    '-i', 'pipe:0',
    '-f', 'mp3',
    '-b:a', '128k',
    '-ar', '44100',
    '-ac', '2',
    '-flush_packets', '1',        // Flush output segera tanpa tunggu buffer penuh
    'pipe:1'
], { stdio: ['pipe', 'pipe', 'pipe'] });

ffmpegProcess.stderr.on('data', (d) => {
    const msg = d.toString().trim();
    if (msg.includes('error') || msg.includes('Error') || msg.includes('Invalid')) {
        console.error('[FFmpeg ERROR]', msg);
    }
});

// Kirim MP3 output ke semua listener yang terhubung
ffmpegProcess.stdout.on('data', (chunk) => {
    streamClients.forEach(c => {
        try { c.res.write(chunk); } catch (_) {}
    });
});

ffmpegProcess.on('close', (code) => console.log('[FFmpeg] Closed with code', code));

// PCM Mixer: tulis silence saat tidak ada yang bicara
const speakingUsers = new Set();

setInterval(() => {
    if (speakingUsers.size === 0) {
        ffmpegProcess.stdin.write(Buffer.alloc(FRAME_SIZE));
    }
}, 20);

// Broadcast pesan chat ke semua SSE clients
function broadcastChat(payload) {
    const data = `data: ${JSON.stringify(payload)}\n\n`;
    chatClients.forEach(c => { try { c.write(data); } catch (_) {} });
}

// ---- Discord Bot ----
const discordClient = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

let currentConnection = null;
const userOpusDecoders = new Map();
const activeAudioStreams = new Map();

discordClient.once(Events.ClientReady, (readyClient) => {
    console.log(`🚀 Bot ready! Logged in as ${readyClient.user.tag}`);
});

discordClient.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    // Broadcast ke live chat jika pesan dari channel yang dikonfigurasi
    const chatChannelId = process.env.CHAT_CHANNEL_ID;
    if (chatChannelId && message.channelId === chatChannelId) {
        broadcastChat({
            type: 'message',
            id: message.id,
            author: message.member?.displayName || message.author.username,
            avatar: message.author.displayAvatarURL({ size: 64 }),
            content: message.content,
            timestamp: message.createdTimestamp,
        });
    }

    if (message.content === '!join') {
        const voiceChannel = message.member?.voice?.channel;
        if (!voiceChannel) {
            return message.reply('Kamu harus di dalam Voice Channel dulu!');
        }

        if (currentConnection) {
            currentConnection.destroy();
            userPCMQueues.clear();
            userOpusDecoders.clear();
            activeAudioStreams.clear();
        }

        currentConnection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: voiceChannel.guild.id,
            adapterCreator: voiceChannel.guild.voiceAdapterCreator,
            selfDeaf: false
        });

        message.reply(`✅ Bergabung ke **${voiceChannel.name}**! Streaming dimulai...`);

        // Mainkan silence untuk establish enkripsi Discord voice
        const player = createAudioPlayer();
        currentConnection.subscribe(player);
        const silenceResource = createAudioResource(new Silence(), { inputType: StreamType.Raw });
        player.play(silenceResource);

        // Dengarkan user yang bicara
        currentConnection.receiver.speaking.on('start', (userId) => {
            if (activeAudioStreams.has(userId)) return; // Sudah subscribe

            if (!userOpusDecoders.has(userId)) {
                userOpusDecoders.set(userId, new OpusEncoder(SAMPLE_RATE, CHANNELS));
            }
            const opusDecoder = userOpusDecoders.get(userId);

            const audioStream = currentConnection.receiver.subscribe(userId, {
                end: { behavior: EndBehaviorType.AfterSilence, duration: 500 }
            });
            activeAudioStreams.set(userId, audioStream);

            console.log(`🎤 User ${userId} mulai bicara | Clients: ${streamClients.length}`);
            speakingUsers.add(userId);

            audioStream.on('data', (packet) => {
                try {
                    const pcm = opusDecoder.decode(packet);
                    if (pcm) {
                        // Tulis langsung ke FFmpeg — timing dikendalikan Discord (20ms/packet)
                        ffmpegProcess.stdin.write(pcm);
                    }
                } catch (e) { /* skip paket rusak */ }
            });

            audioStream.on('error', (e) => console.error('AudioStream error:', e.message));

            audioStream.once('end', () => {
                activeAudioStreams.delete(userId);
                speakingUsers.delete(userId);
                console.log(`🔇 User ${userId} berhenti bicara`);
            });
        });
    }

    if (message.content === '!leave') {
        if (currentConnection) {
            currentConnection.destroy();
            currentConnection = null;
            speakingUsers.clear();
            userOpusDecoders.clear();
            activeAudioStreams.clear();
            message.reply('👋 Bot keluar dari channel.');
        }
    }
});

discordClient.login(process.env.DISCORD_TOKEN);
