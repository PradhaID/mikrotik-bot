module.exports = {
    apps: [{
        name: 'mikrotik-bot',
        script: 'src/index.js',
        cwd: '/app/mikrotik',
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: '200M',
        env: {
            NODE_ENV: 'production'
        }
    }]
}
