# PradhaNet MikroTik Bot

Telegram bot for MikroTik router monitoring and management, built with Node.js.

## Features

- 📊 Real-time ISP bandwidth monitoring
- 👥 PPPoE/Hotspot client counts
- 🔴 Push alerts (ISP failover, high CPU/RAM/bandwidth, low disk)
- 🖥 Live dashboard with auto-refresh
- 🔧 Remote management (suspend/unsuspend clients)
- 🔐 Secure reboot with WhatsApp OTP

## Commands

| Command | Description |
|---------|-------------|
| `/stats` | Full router status |
| `/live` | Realtime auto-updating dashboard |
| `/stop` | Stop live monitor |
| `/isp` | ISP bandwidth only |
| `/clients` | Active client counts |
| `/uptime` | System CPU/RAM/uptime |
| `/top` | Top 10 bandwidth users |
| `/routes` | Active routes |
| `/isolir` | List suspended clients |
| `/isolir USERNAME` | Suspend a client |
| `/free USERNAME` | Unsuspend a client |
| `/reboot` | Reboot router (OTP via WhatsApp) |

## Requirements

- Node.js 18+
- MikroTik RouterOS 7.x (REST API enabled)
- Telegram Bot (via @BotFather)
- WAHA (WhatsApp HTTP API) for OTP
- PM2 (process manager)

## Setup

### 1. Clone repository
```bash
git clone https://github.com/PradhaID/mikrotik-bot.git
cd mikrotik-bot
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
nano .env
```

Fill in all required values in `.env`.

### 3. Enable MikroTik REST API
```routeros
/ip service set www disabled=no port=80
```

### 4. Register Telegram webhook
```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://yourdomain.com/tgbot/webhook","secret_token":"your_secret"}'
```

### 5. Run with PM2
```bash
pm2 start ecosystem.config.js
pm2 save
```

### 6. Nginx reverse proxy
```nginx
location /tgbot/ {
    proxy_pass http://127.0.0.1:3011/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

## Alert Thresholds

Configure in `.env`:
```env
BW_WARN_MBPS=300    # Bandwidth warning threshold (Mbps)
BW_CRIT_MBPS=380    # Bandwidth critical threshold (Mbps)
CPU_WARN=70         # CPU warning %
CPU_CRIT=90         # CPU critical %
RAM_WARN=80         # RAM warning %
RAM_CRIT=95         # RAM critical %
DISK_WARN=20        # Disk free warning %
DISK_CRIT=10        # Disk free critical %
```

## Architecture
