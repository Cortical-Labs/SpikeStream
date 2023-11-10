function setupPongVisualisation() {
    const canvas = document.getElementById('game-canvas')
    canvas.setAttribute('height', canvas.clientHeight)
    canvas.setAttribute('width', canvas.clientWidth)
    
    const ctx = canvas.getContext('2d')
    ctx.scaleFactor = canvas.clientHeight / 600

    ctx.fillStyle = "black"
    ctx.fillRect(0, 0, 600 * ctx.scaleFactor, 600 * ctx.scaleFactor)

    ctx.fillStyle = "white"
    ctx.fillRect(0, 175 * ctx.scaleFactor, 10 * ctx.scaleFactor, 250 * ctx.scaleFactor)

    ctx.fillStyle = "white"
    ctx.fillRect(300 * ctx.scaleFactor, 300 * ctx.scaleFactor, 20 * ctx.scaleFactor, 20 * ctx.scaleFactor)
    return ctx
}

export function drawPongVis(ctx, replayBuffer) {
    ctx.fillStyle = "black"
    ctx.fillRect(0, 0, 600 * ctx.scaleFactor, 600 * ctx.scaleFactor)

    let batY = replayBuffer[0]
    let ballX = replayBuffer[1]
    let ballY = replayBuffer[2]
    
    ctx.fillStyle = "white"
    ctx.fillRect(0, batY * ctx.scaleFactor, 10 * ctx.scaleFactor, 250 * ctx.scaleFactor)

    ctx.fillStyle = "white"
    ctx.fillRect(ballX* ctx.scaleFactor, ballY * ctx.scaleFactor, 20 * ctx.scaleFactor, 20 * ctx.scaleFactor)
}

export default setupPongVisualisation